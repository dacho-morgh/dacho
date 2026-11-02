import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, readdirSync, readFileSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { runner } from 'node-pg-migrate'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { collectMigrationReconciliation } from '../../src/db/migration-reconciliation.js'
import { runMigrations } from '../../src/db/migrate.js'
import { PrivateDocumentStorage } from '../../src/documents/storage.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../../../..')
const MIGRATIONS_DIR = path.resolve(here, '../../migrations')
const BACKEND_MIGRATIONS = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.ts')).sort()

// The levels of the two migration streams on `main`, the production branch.
const MAIN_CMS_MIGRATION = '20261022_200000_add_service_ordering'
const MAIN_BACKEND_MIGRATIONS = 5

// Every database this spec may create, restore into or drop. The working test
// database is only ever read, to prove the rehearsal left it alone.
const LEGACY = 'dacho_t41_legacy'
const CMS_FIRST = 'dacho_t41_cms_first'
const BACKEND_FIRST = 'dacho_t41_backend_first'
const RESTORED = 'dacho_t41_restored'
const DATABASES = [LEGACY, CMS_FIRST, BACKEND_FIRST, RESTORED]

const workingUrl = process.env.DATABASE_URL!
const urlOf = (database: string) => {
  if (!DATABASES.includes(database)) throw new Error('Not a rehearsal database.')
  const url = new URL(workingUrl)
  url.pathname = `/${database}`
  return url.toString()
}
const fileRoot = path.join(process.env.PAYLOAD_MEDIA_DIR!, 't41-rehearsal')

const cmsRequire = createRequire(path.join(repo, 'packages/cms-core/package.json'))
const { PgDialect } = createRequire(cmsRequire.resolve('@payloadcms/db-postgres'))('drizzle-orm/pg-core')

type CmsMigration = { name: string; up: (args: unknown) => Promise<void> }

async function cmsMigrations(): Promise<CmsMigration[]> {
  // The CMS package does not compile under the backend's module resolution.
  const index = path.join(repo, 'packages/cms-core/src/migrations/index.ts')
  return (await import(/* @vite-ignore */ index)).migrations
}

async function withClient<T>(database: string | null, work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: database ? urlOf(database) : workingUrl })
  await client.connect()
  try {
    return await work(client)
  } finally {
    await client.end()
  }
}

/** Applies CMS migrations like Payload: in order, one transaction each, journaled. */
async function migrateCms(database: string, through?: string): Promise<void> {
  const dialect = new PgDialect()
  await withClient(database, async (client) => {
    const journal = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public.payload_migrations') IS NOT NULL AS exists",
    )
    const applied = journal.rows[0]!.exists
      ? new Set((await client.query<{ name: string }>('SELECT name FROM public.payload_migrations')).rows.map(({ name }) => name))
      : new Set<string>()
    const db = {
      execute: (statement: unknown) => {
        const query = dialect.sqlToQuery(statement)
        return client.query(query.sql, query.params)
      },
    }
    // Only content migrations before the main level call the Local API. They run
    // while building the empty legacy schema, where no event documents exist yet.
    const payload = { find: async () => ({ docs: [] }) }
    for (const migration of await cmsMigrations()) {
      if (!applied.has(migration.name)) {
        await client.query('BEGIN')
        await migration.up({ db, payload, req: undefined })
        await client.query('INSERT INTO public.payload_migrations (name, batch) VALUES ($1, 1)', [migration.name])
        await client.query('COMMIT')
      }
      if (migration.name === through) return
    }
  })
}

const migrateBackend = (database: string, count: number) => runner({
  databaseUrl: urlOf(database),
  dir: MIGRATIONS_DIR,
  direction: 'up',
  count,
  migrationsTable: 'pgmigrations',
  schema: 'dashboard',
  createSchema: true,
  advisoryLockMode: 'wait',
  log: () => undefined,
})

async function recreate(database: string): Promise<void> {
  urlOf(database)
  await withClient(null, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
    await client.query(`CREATE DATABASE ${database}`)
  })
}

/** Row and sequence digest of every application table, to prove sameness. */
async function fingerprint(database: string | null): Promise<Record<string, string>> {
  return withClient(database, async (client) => {
    const result: Record<string, string> = {}
    const tables = await client.query<{ name: string }>(`
      SELECT format('%I.%I', table_schema, table_name) AS name FROM information_schema.tables
      WHERE table_schema IN ('public', 'dashboard') AND table_type = 'BASE TABLE' ORDER BY 1`)
    for (const { name } of tables.rows) {
      const { rows } = await client.query<{ digest: string }>(`
        SELECT count(*) || ':' || md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS digest
        FROM ${name} t`)
      result[name] = rows[0]!.digest
    }
    const sequences = await client.query<{ name: string; value: string | null }>(`
      SELECT format('%I.%I', schemaname, sequencename) AS name, last_value::text AS value
      FROM pg_sequences WHERE schemaname IN ('public', 'dashboard')`)
    for (const { name, value } of sequences.rows) result[`sequence ${name}`] = String(value)
    return result
  })
}

/** Runs a client tool in the disposable Postgres container, matching its version. */
function pgTool(args: string[], streams: { input?: string; output?: string }): Promise<void> {
  const container = process.env.PHASE0_PG_CONTAINER
  if (!container) throw new Error('PHASE0_PG_CONTAINER must name the disposable Postgres container.')
  const child = spawn('docker', ['exec', ...(streams.input ? ['-i'] : []), container, ...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let errors = ''
  child.stderr.on('data', (chunk) => { errors += chunk })
  const finished = new Promise<void>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${args[0]} exited ${code}: ${errors}`)))
  })
  const piped = [
    streams.input ? pipeline(createReadStream(streams.input), child.stdin) : (child.stdin.end(), Promise.resolve()),
    streams.output ? pipeline(child.stdout, createWriteStream(streams.output)) : Promise.resolve(child.stdout.resume()),
  ]
  return Promise.all([finished, ...piped]).then(() => undefined)
}

const dump = (database: string, file: string) => {
  urlOf(database)
  return pgTool(['pg_dump', '-U', 'phase0_test', '-d', database, '-Fc'], { output: file })
}

async function restore(file: string, database: string): Promise<void> {
  await recreate(database)
  await pgTool(
    ['pg_restore', '-U', 'phase0_test', '-d', database, '--no-owner', '--no-privileges', '--exit-on-error'],
    { input: file },
  )
}

const LEGACY_FIXTURE = `
  INSERT INTO public.users (id, name, phone, hash, salt) VALUES
    (1, 'Old admin', '09000000001', 'hash-1', 'salt-1'),
    (2, 'Old editor', '09000000002', 'hash-2', 'salt-2'),
    (3, 'Old admin and editor', '09000000003', 'hash-3', 'salt-3'),
    (4, 'Single company representative', '09000000004', 'hash-4', 'salt-4'),
    (5, 'Two company representative', '09000000005', 'hash-5', 'salt-5'),
    (6, 'Old referee', '09000000006', 'hash-6', 'salt-6'),
    (7, 'Old referee and editor', '09000000007', 'hash-7', 'salt-7'),
    (8, 'Representative and referee', '09000000008', 'hash-8', 'salt-8'),
    (9, 'No role', '09000000009', 'hash-9', 'salt-9');
  INSERT INTO public.users (id, name, phone, hash, salt, company_name, company_national_id) VALUES
    (10, 'Duplicate national id one', '09000000010', 'hash-10', 'salt-10', 'Duplicate', 'duplicate-id'),
    (11, 'Duplicate national id two', '09000000011', 'hash-11', 'salt-11', 'Duplicate', 'duplicate-id');
  INSERT INTO public.users_roles ("order", parent_id, value) VALUES
    (1, 1, 'admin'), (1, 2, 'editor'), (1, 3, 'admin'), (2, 3, 'editor'),
    (1, 4, 'representative'), (1, 5, 'representative'), (1, 6, 'referee'),
    (1, 7, 'referee'), (2, 7, 'editor'), (1, 8, 'representative'), (2, 8, 'referee'),
    (1, 10, 'representative'), (1, 11, 'representative');
  INSERT INTO public.companies (id, name, national_id, representative_id, created_at, updated_at) VALUES
    (501, 'Single', 'national-501', 4, '2026-01-01', '2026-01-01'),
    (502, 'Two A', 'national-502', 5, '2026-01-01', '2026-01-01'),
    (503, 'Two B', 'national-503', 5, '2026-01-01', '2026-01-01');
  INSERT INTO dashboard.requests (id, tracking_code, title, service_id, service_key, owner_id, status) VALUES
    ('00000000-0000-4000-8000-000000000041', 'DCH-2026-000041', 'Closed and owned', '1', 'old', '4', 'approved'),
    ('00000000-0000-4000-8000-000000000042', 'DCH-2026-000042', 'Ambiguous owner', '1', 'old', '5', 'in_review'),
    ('00000000-0000-4000-8000-000000000043', 'OLD-FORMAT-A', 'Owner without company', '1', 'old', '10', 'action_needed'),
    ('00000000-0000-4000-8000-000000000044', 'OLD-FORMAT-B', 'Unknown owner', '1', 'old', '999999', 'draft');
  INSERT INTO dashboard.letters (type, title, body, recipient_id, request_id) VALUES
    ('official', 'Linked letter', 'Body', '4', '00000000-0000-4000-8000-000000000041'),
    ('notification', 'Unknown recipient', 'Body', '999999', NULL);
  INSERT INTO dashboard.activities (owner_id, request_id, type, title) VALUES
    ('4', '00000000-0000-4000-8000-000000000041', 'old', 'Old activity');
  INSERT INTO dashboard.support_tickets (requester_id, subject, message) VALUES
    ('4', 'Known requester', 'Body'), ('999999', 'Unknown requester', 'Body');
`

const EXPECTED_REPORT = {
  accounts: {
    editorial_only: 1,
    mapped_role: 6,
    review_conflicting_roles: 1,
    review_legacy_admin: 2,
    review_no_role: 1,
  },
  activeRoles: { representative: 4, reviewer: 2 },
  requestOwnership: {
    company_linked: 1,
    review_ambiguous_owner: 1,
    review_owner_without_company: 1,
    review_unknown_owner: 1,
  },
  requestScope: { legacy_closed: 1, legacy_open: 3 },
  evidence: {
    duplicate_national_id_groups: 1,
    accounts_with_unlinked_company_data: 2,
    representatives_with_several_companies: 1,
    letters_with_unknown_recipient: 1,
    tickets_with_unknown_requester: 1,
  },
  pending: { accounts: 4, requests: 3, systemOwnerMissing: true },
}

const reconcile = (database: string) => withClient(database, collectMigrationReconciliation)

/** Every legacy table and column, read back from another database. */
async function legacyRows(source: string, tables: { table: string; columns: string[] }[]) {
  return withClient(source, async (client) => {
    const rows: Record<string, string[]> = {}
    for (const { table, columns } of tables) {
      const list = columns.map((column) => `"${column}"`).join(', ')
      const result = await client.query<{ row: string }>(
        `SELECT row_to_json(t)::text AS row FROM (SELECT ${list} FROM ${table}) t ORDER BY 1`,
      )
      rows[table] = result.rows.map(({ row }) => row)
    }
    return rows
  })
}

async function legacyShape() {
  return withClient(LEGACY, async (client) => {
    const { rows } = await client.query<{ table: string; columns: string[] }>(`
      SELECT format('%I.%I', c.table_schema, c.table_name) AS table,
             array_agg(c.column_name::text ORDER BY c.ordinal_position) AS columns
      FROM information_schema.columns c
      JOIN information_schema.tables t USING (table_schema, table_name)
      WHERE c.table_schema IN ('public', 'dashboard') AND t.table_type = 'BASE TABLE'
      GROUP BY 1 ORDER BY 1`)
    return rows
  })
}

describe('migration rehearsal on separate populated data (T41)', () => {
  let workingBefore: Record<string, string>
  let legacyBefore: Record<string, string>
  const legacyDump = path.join(fileRoot, 'legacy.dump')

  beforeAll(async () => {
    workingBefore = await fingerprint(null)
    await rm(fileRoot, { recursive: true, force: true })
    await mkdir(fileRoot, { recursive: true })

    await recreate(LEGACY)
    await migrateCms(LEGACY, MAIN_CMS_MIGRATION)
    await migrateBackend(LEGACY, MAIN_BACKEND_MIGRATIONS)
    await withClient(LEGACY, async (client) => {
      await client.query(readFileSync(path.join(repo, 'scripts/phase0-test-db-init.sql'), 'utf8'))
      await client.query(LEGACY_FIXTURE)
    })
    legacyBefore = await fingerprint(LEGACY)
    await dump(LEGACY, legacyDump)
  }, 180_000)

  afterAll(async () => {
    await withClient(null, async (client) => {
      for (const database of DATABASES) await client.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
    })
    await rm(fileRoot, { recursive: true, force: true })
  }, 60_000)

  it('starts from the journal levels on main, with data already present', async () => {
    const counts = await withClient(LEGACY, async (client) => (await client.query(`SELECT
      (SELECT count(*)::int FROM public.users) AS users,
      (SELECT count(*)::int FROM dashboard.requests) AS requests,
      (SELECT count(*)::int FROM dashboard.pgmigrations) AS backend,
      (SELECT max(name) FROM public.payload_migrations) AS cms`)).rows[0])
    expect(counts).toEqual({ users: 11, requests: 4, backend: MAIN_BACKEND_MIGRATIONS, cms: MAIN_CMS_MIGRATION })
    await expect(withClient(LEGACY, (client) => client.query('SELECT company_id FROM dashboard.requests')))
      .rejects.toThrow(/company_id/)
  })

  it('upgrades a restored copy, keeps old values and sorts every account and case', async () => {
    await restore(legacyDump, CMS_FIRST)
    await migrateCms(CMS_FIRST)
    await runMigrations(urlOf(CMS_FIRST))

    const report = await reconcile(CMS_FIRST)
    expect(report).toMatchObject(EXPECTED_REPORT)
    expect(report.journals).toEqual({
      cms_applied: (await cmsMigrations()).length,
      cms_latest: (await cmsMigrations()).at(-1)!.name,
      backend_applied: BACKEND_MIGRATIONS.length,
      backend_latest: BACKEND_MIGRATIONS.at(-1)!.slice(0, -3),
    })
    const total = (group: Record<string, number>) => Object.values(group).reduce((sum, count) => sum + count, 0)
    expect(total(report.accounts)).toBe(11)
    expect(total(report.requestOwnership)).toBe(4)
    expect(total(report.requestScope)).toBe(4)
    expect(JSON.stringify(report)).not.toMatch(/0900000|hash-|salt-|DCH-|duplicate-id|Old admin/)

    // The role projection is the one table this upgrade rebuilds on purpose.
    const shape = (await legacyShape()).filter(({ table }) => ![
      'public.users_roles', 'public.payload_migrations', 'dashboard.pgmigrations',
    ].includes(table))
    expect(await legacyRows(CMS_FIRST, shape)).toEqual(await legacyRows(LEGACY, shape))

    await withClient(CMS_FIRST, async (client) => {
      const users = await client.query(`SELECT id, operational_role::text AS role, is_active AS active,
        content_editor AS editor, legacy_roles AS legacy FROM public.users ORDER BY id`)
      expect(users.rows).toEqual([
        { id: 1, role: null, active: false, editor: false, legacy: ['admin'] },
        { id: 2, role: null, active: true, editor: true, legacy: ['editor'] },
        { id: 3, role: null, active: false, editor: true, legacy: ['admin', 'editor'] },
        { id: 4, role: 'representative', active: true, editor: false, legacy: ['representative'] },
        { id: 5, role: 'representative', active: true, editor: false, legacy: ['representative'] },
        { id: 6, role: 'reviewer', active: true, editor: false, legacy: ['referee'] },
        { id: 7, role: 'reviewer', active: true, editor: true, legacy: ['referee', 'editor'] },
        { id: 8, role: null, active: false, editor: false, legacy: ['representative', 'referee'] },
        { id: 9, role: null, active: false, editor: false, legacy: [] },
        { id: 10, role: 'representative', active: true, editor: false, legacy: ['representative'] },
        { id: 11, role: 'representative', active: true, editor: false, legacy: ['representative'] },
      ])
      const requests = await client.query(`SELECT tracking_code AS code, company_id AS company, status::text AS status
        FROM dashboard.requests ORDER BY tracking_code`)
      expect(requests.rows).toEqual([
        { code: 'DCH-2026-000041', company: '501', status: 'approved' },
        { code: 'DCH-2026-000042', company: null, status: 'in_review' },
        { code: 'OLD-FORMAT-A', company: null, status: 'action_needed' },
        { code: 'OLD-FORMAT-B', company: null, status: 'draft' },
      ])
      // New tracking codes continue after the old high-water mark.
      const next = await client.query('SELECT last_value::int AS value, is_called AS called FROM dashboard.request_tracking_code_seq')
      expect(next.rows[0]).toEqual({ value: 43, called: false })
    })
  }, 180_000)

  it('changes nothing when the same migrations start again', async () => {
    const before = await fingerprint(CMS_FIRST)
    await migrateCms(CMS_FIRST)
    await runMigrations(urlOf(CMS_FIRST))
    expect(await fingerprint(CMS_FIRST)).toEqual(before)
  }, 120_000)

  it('reaches the same outcome when the backend starts before the CMS', async () => {
    await restore(legacyDump, BACKEND_FIRST)
    await runMigrations(urlOf(BACKEND_FIRST))
    await migrateCms(BACKEND_FIRST)
    expect(await reconcile(BACKEND_FIRST)).toEqual(await reconcile(CMS_FIRST))
  }, 180_000)

  it('recovers the database and private files together after a damaged rollout', async () => {
    const liveFiles = path.join(fileRoot, 'files')
    const backupFiles = path.join(fileRoot, 'backup-files')
    const restoredFiles = path.join(fileRoot, 'restored-files')
    const body = Buffer.from('t41-synthetic-private-document')
    const storageKey = await new PrivateDocumentStorage(liveFiles).save(body, '.pdf')
    await withClient(CMS_FIRST, (client) => client.query(`INSERT INTO dashboard.private_documents
      (storage_key, category, original_filename, mime_type, size_bytes, request_id, uploader_id)
      VALUES ($1, 'proposal', 'synthetic.pdf', 'application/pdf', $2, '00000000-0000-4000-8000-000000000041', '4')`,
    [storageKey, body.length]))

    const beforeDamage = await fingerprint(CMS_FIRST)
    const backup = path.join(fileRoot, 'migrated.dump')
    await dump(CMS_FIRST, backup)
    await cp(liveFiles, backupFiles, { recursive: true })

    await withClient(CMS_FIRST, async (client) => {
      await client.query('DELETE FROM dashboard.private_documents')
      await client.query("UPDATE public.users SET hash = 'damaged' WHERE id = 4")
      await client.query("DELETE FROM dashboard.requests WHERE tracking_code = 'OLD-FORMAT-A'")
    })
    await new PrivateDocumentStorage(liveFiles).remove(storageKey)

    await restore(backup, RESTORED)
    await cp(backupFiles, restoredFiles, { recursive: true })

    expect(await fingerprint(RESTORED)).toEqual(beforeDamage)
    expect(await reconcile(RESTORED)).toMatchObject(EXPECTED_REPORT)
    const row = await withClient(RESTORED, async (client) => (await client.query(`SELECT d.storage_key, r.tracking_code
      FROM dashboard.private_documents d JOIN dashboard.requests r ON r.id = d.request_id`)).rows)
    expect(row).toEqual([{ storage_key: storageKey, tracking_code: 'DCH-2026-000041' }])
    const restoredBody = await new PrivateDocumentStorage(restoredFiles).read(storageKey)
    const sha = (bytes: Buffer | null) => createHash('sha256').update(bytes ?? '').digest('hex')
    expect(sha(restoredBody)).toBe(sha(body))
    // A database-only restore would point at bytes the damaged store has lost.
    expect(await new PrivateDocumentStorage(liveFiles).read(storageKey)).toBeNull()
    expect((await fingerprint(CMS_FIRST))['public.users']).not.toBe(beforeDamage['public.users'])
  }, 180_000)

  it('leaves the source copy and the working test database untouched', async () => {
    expect(await fingerprint(LEGACY)).toEqual(legacyBefore)
    expect(await fingerprint(null)).toEqual(workingBefore)
  }, 60_000)
})
