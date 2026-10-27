import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { MigrationBuilder, runner } from 'node-pg-migrate'
import { Pool } from 'pg'

import { up } from '../../migrations/1780511400013_company_owned_requests.js'
import { runMigrations } from '../../src/db/migrate.js'

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const OWNERSHIP = '1780511400013_company_owned_requests'
const STAGING_TAIL = [
  '1780511400011_create-event-configurations',
  '1780511400012_event-audit-and-revision',
]
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations')
const LATER = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => file.slice(0, -3))
  .filter((name) => name > OWNERSHIP)
  .sort()

const migration = (file: string, direction: 'up' | 'down') => runner({
  databaseUrl: connectionString,
  dir: MIGRATIONS_DIR,
  direction,
  file,
  count: 1,
  migrationsTable: 'pgmigrations',
  schema: 'dashboard',
  advisoryLockMode: 'wait',
  log: () => undefined,
})

const journal = async () => (await pool.query<{ name: string }>(
  'SELECT name FROM dashboard.pgmigrations ORDER BY run_on, id',
)).rows.map(({ name }) => name)

describe('company ownership migration on isolated synthetic data', () => {
  afterAll(async () => { await pool.end() })

  it('upgrades existing staging bookkeeping without inserting before applied migrations', async () => {
    await runMigrations(connectionString)
    try {
      for (const later of [...LATER].reverse()) await migration(later, 'down')
      expect((await migration(OWNERSHIP, 'down')).map(({ name }) => name)).toEqual([OWNERSHIP])
      const before = await journal()
      expect(before.slice(-2)).toEqual(STAGING_TAIL)
      // Exercise normal ordered startup, not a fake journal or checkOrder:false.
      await runMigrations(connectionString)
      expect(await journal()).toEqual([...before, OWNERSHIP, ...LATER])
    } finally {
      await migration(OWNERSHIP, 'up')
      for (const later of LATER) await migration(later, 'up')
    }
  })

  it('maps only unique representatives; preserves unknown, ambiguous and already-owned requests', async () => {
    await runMigrations(connectionString)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // Keep existing CMS data, foreign keys and names intact after rollback.
      // No IF NOT EXISTS: a collision must fail rather than reuse another fixture.
      await client.query(`DO $$ BEGIN
        IF to_regclass('public.companies') IS NOT NULL THEN
          ALTER TABLE public.companies RENAME TO company_ownership_migration_saved;
        END IF;
      END $$`)
      await client.query(`CREATE TABLE public.companies (
        id serial PRIMARY KEY,
        representative_id integer NOT NULL,
        created_at timestamp(3) with time zone NOT NULL DEFAULT now()
      )`)
      // Duplicate representatives exist in CMS schema: index is not UNIQUE.
      // Include equal timestamps and unequal timestamps, in reverse id order.
      await client.query(`INSERT INTO public.companies (id, representative_id, created_at) VALUES
        (101, 910001, '2026-01-01'),
        (103, 910002, '2026-01-01'), (102, 910002, '2026-01-01'),
        (105, 910003, '2026-02-01'), (104, 910003, '2026-01-01')`)
      await client.query(`INSERT INTO dashboard.requests
        (tracking_code, title, service_id, service_key, owner_id, company_id) VALUES
        ('OWNERSHIP-unique', 'fixture', '1', 'test', '910001', NULL),
        ('OWNERSHIP-unmapped', 'fixture', '1', 'test', '910004', NULL),
        ('OWNERSHIP-tied', 'fixture', '1', 'test', '910002', NULL),
        ('OWNERSHIP-duplicate', 'fixture', '1', 'test', '910003', NULL),
        ('OWNERSHIP-preserved', 'fixture', '1', 'test', '910001', 'existing-company')`)
      const before = (await client.query(`SELECT * FROM dashboard.requests
        WHERE tracking_code LIKE 'OWNERSHIP-%' ORDER BY tracking_code`)).rows
      // Use actual MigrationBuilder and execute real migration SQL inside one
      // rollback transaction; runner owns commits, so cannot isolate CMS fixtures.
      const pgm = new MigrationBuilder({
        query: client.query.bind(client),
        select: async (sql, values?: unknown[]) => (await client.query(sql, values)).rows,
      }, undefined, false, console)
      await up(pgm)
      for (const sql of pgm.getSqlSteps()) await client.query(sql)
      const after = (await client.query(`SELECT * FROM dashboard.requests
        WHERE tracking_code LIKE 'OWNERSHIP-%' ORDER BY tracking_code`)).rows
      expect(after).toEqual(before.map((row) => ({
        ...row,
        company_id: row.tracking_code === 'OWNERSHIP-unique' ? '101' : row.company_id,
      })))
    } finally {
      try { await client.query('ROLLBACK') } finally { client.release() }
    }
  })
})
