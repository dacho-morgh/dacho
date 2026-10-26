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

const migration = (file: string, direction: 'up' | 'down') =>
  runner({
    databaseUrl: connectionString,
    dir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations'),
    direction,
    file,
    count: 1,
    migrationsTable: 'pgmigrations',
    schema: 'dashboard',
    advisoryLockMode: 'wait',
    log: () => undefined,
  })

const TRACKING = '1780511400005_safe-request-tracking'
const LATER_MIGRATIONS = [
  '1780511400010_company_owned_requests',
  '1780511400006_shared_access_and_private_documents',
]

/**
 * Rehearse the tracking migration against the pre-sequence schema. Later
 * migrations are temporarily reverted too: node-pg-migrate rejects an unapplied
 * earlier migration when a later one is recorded, even for a file-scoped run.
 * The disposable suite restores all migrations after each case.
 */
const trackingMigration = (direction: 'up' | 'down') => migration(TRACKING, direction)

describe('request tracking migration on isolated synthetic data', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM dashboard.requests')
    // The shared integration setup has already verified the disposable marker.
    for (const later of LATER_MIGRATIONS) {
      await migration(later, 'down')
    }
    const reverted = await trackingMigration('down')
    expect(reverted.map((entry) => entry.name)).toEqual([TRACKING])
  })

  afterEach(async () => {
    await trackingMigration('up')
    for (const later of [...LATER_MIGRATIONS].reverse()) {
      await migration(later, 'up')
    }
    await pool.query('DELETE FROM dashboard.requests')
  })

  afterAll(async () => {
    await pool.end()
  })

  it('starts at one on an empty database and can run again without resetting allocation', async () => {
    await trackingMigration('up')
    const first = await repo.create(input)
    expect(first.trackingCode).toBe(`DCH-${new Date().getFullYear()}-1`)
    await trackingMigration('up')
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
    await trackingMigration('up')
    const after = await pool.query('SELECT * FROM dashboard.requests ORDER BY tracking_code')
    expect(after.rows).toEqual(before.rows)
    expect((await repo.create(input)).trackingCode).toBe(`DCH-${new Date().getFullYear()}-9007199254740994`)
  })
})
