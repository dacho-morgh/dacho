import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { runner } from 'node-pg-migrate'
import { Pool } from 'pg'

import { RequestRepository } from '../../src/dashboard/request-repo.js'
import { runMigrations } from '../../src/db/migrate.js'

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const repo = new RequestRepository(pool)
const input = {
  serviceId: '1', serviceKey: 'test', serviceName: 'Test service',
  title: 'Tracking migration fixture', ownerId: 'tracking-migration', answers: {},
}

describe('request tracking migration on isolated synthetic data', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM dashboard.requests')
    // Rehearse only this migration against the pre-sequence schema. The shared
    // integration setup has already verified the disposable database marker.
    const reverted = await runner({
      databaseUrl: connectionString,
      dir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations'),
      direction: 'down',
      file: '1780511400005_safe-request-tracking',
      count: 1,
      migrationsTable: 'pgmigrations',
      schema: 'dashboard',
      advisoryLockMode: 'wait',
      log: () => undefined,
    })
    expect(reverted.map((migration) => migration.name)).toEqual(['1780511400005_safe-request-tracking'])
  })

  afterEach(async () => {
    await runMigrations(connectionString)
    await pool.query('DELETE FROM dashboard.requests')
  })

  afterAll(async () => {
    await pool.end()
  })

  it('starts at one on an empty database and can run again without resetting allocation', async () => {
    await runMigrations(connectionString)
    const first = await repo.create(input)
    expect(first.trackingCode).toBe(`DCH-${new Date().getFullYear()}-1`)
    await runMigrations(connectionString)
    const second = await repo.create(input)
    expect(second.trackingCode).toBe(`DCH-${new Date().getFullYear()}-2`)
  })

  it('preserves legacy rows and allocates above the largest suffix across years without precision loss', async () => {
    for (const code of ['DCH-2024-2', 'DCH-2025-9007199254740993', 'DCH-2026-42', 'LEGACY-custom']) {
      await pool.query(
        `INSERT INTO dashboard.requests (tracking_code, title, service_id, service_key, owner_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [code, input.title, input.serviceId, input.serviceKey, input.ownerId],
      )
    }
    const before = await pool.query('SELECT * FROM dashboard.requests ORDER BY tracking_code')
    await runMigrations(connectionString)
    const after = await pool.query('SELECT * FROM dashboard.requests ORDER BY tracking_code')
    expect(after.rows).toEqual(before.rows)
    expect((await repo.create(input)).trackingCode).toBe(`DCH-${new Date().getFullYear()}-9007199254740994`)
  })
})
