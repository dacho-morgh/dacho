import { afterAll, describe, expect, it } from 'vitest'
import { runner } from 'node-pg-migrate'
import { Pool } from 'pg'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMigrations } from '../../src/db/migrate.js'

const databaseUrl = process.env.DATABASE_URL!
const pool = new Pool({ connectionString: databaseUrl })
const files = ['1780511400014_subtopics_rfp', '1780511400015_rfp_versions', '1780511400016_request_rfp_context']
const migration = (file: string, direction: 'up' | 'down') => runner({ databaseUrl, direction, file, count: 1, dir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations'), schema: 'dashboard', migrationsTable: 'pgmigrations', advisoryLockMode: 'wait', log: () => undefined })
const journal = async () => (await pool.query<{ name: string }>('SELECT name FROM dashboard.pgmigrations ORDER BY run_on,id')).rows.map(({ name }) => name)

describe('T17/T18 guarded migration rehearsal', () => {
  afterAll(async () => { await pool.end() })
  it('upgrades normal staging journal in order and reverses additive schema', async () => {
    await runMigrations(databaseUrl)
    try {
      for (const file of [...files].reverse()) await migration(file, 'down')
      const staging = await journal()
      expect(staging.at(-1)).toBe('1780511400013_company_owned_requests')
      const before = (await pool.query('SELECT count(*)::text AS count FROM dashboard.requests')).rows[0]
      await runMigrations(databaseUrl)
      expect(await journal()).toEqual([...staging, ...files])
      expect((await pool.query('SELECT count(*)::text AS count FROM dashboard.requests')).rows[0]).toEqual(before)
      for (const table of ['technology_categories', 'subtopics', 'rfp_versions', 'rfp_files', 'request_rfps']) {
        expect((await pool.query('SELECT to_regclass($1) AS name', [`dashboard.${table}`])).rows[0].name).not.toBeNull()
      }
    } finally { await runMigrations(databaseUrl) }
  })
})
