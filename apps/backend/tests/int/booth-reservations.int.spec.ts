import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { runMigrations } from '../../src/db/migrate.js'
import { PostgresBoothCatalogueRepository } from '../../src/exhibitions/catalogue-repo.js'
import { BoothReservationRepository } from '../../src/exhibitions/reservation-repo.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 'booth-reservations-integration' })
const exhibitionId = 'reservation-concurrency-test'
const catalogue = new PostgresBoothCatalogueRepository(pool)
const reservations = new BoothReservationRepository(pool)

describe('booth reservation concurrency', () => {
  beforeAll(async () => { await runMigrations(connectionString) })
  afterAll(async () => {
    await pool.query('DELETE FROM dashboard.booth_reservations WHERE exhibition_id = $1', [exhibitionId])
    await pool.query('UPDATE dashboard.exhibition_booths SET price_version_id = NULL WHERE exhibition_id = $1', [exhibitionId])
    await pool.query('DELETE FROM dashboard.booth_price_versions WHERE exhibition_id = $1', [exhibitionId])
    await pool.query('DELETE FROM dashboard.exhibition_booths WHERE exhibition_id = $1', [exhibitionId])
    await pool.query('DELETE FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id = $1', [exhibitionId])
    await pool.end()
  })

  it('allows only one simultaneous reservation per booth and enforces the company limit across booths', async () => {
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 1, guideMapReference: null }, 'owner')
    const create = (identifier: string) => catalogue.createBooth({ exhibitionId, identifier, specification: 'test', location: null, status: 'available', active: true, priceAmount: 100, priceUnit: 'toman', createdBy: 'owner' })
    const [first, second, third] = await Promise.all([create('one'), create('two'), create('three')])
    if (!first.ok || !second.ok || !third.ok) throw new Error('fixture creation failed')
    const reserve = (boothId: string, companyId: string) => reservations.reserve({ exhibitionId, boothId, companyId, actorId: companyId })
    const sameBooth = await Promise.all([reserve(first.booth.id, 'a'), reserve(first.booth.id, 'b')])
    expect(sameBooth.filter((result) => result.ok)).toHaveLength(1)
    expect(sameBooth.filter((result) => !result.ok && result.error === 'booth_unavailable')).toHaveLength(1)
    const sameCompany = await Promise.all([reserve(second.booth.id, 'c'), reserve(third.booth.id, 'c')])
    expect(sameCompany.filter((result) => result.ok)).toHaveLength(1)
    expect(sameCompany.filter((result) => !result.ok && result.error === 'company_limit_reached')).toHaveLength(1)
    await pool.query(`UPDATE dashboard.booth_reservations SET created_at = now() - interval '10 years' WHERE exhibition_id = $1`, [exhibitionId])
    const active = await pool.query<{ count: string }>('SELECT count(*) FROM dashboard.booth_reservations WHERE exhibition_id = $1 AND active', [exhibitionId])
    expect(active.rows[0]?.count).toBe('2')
  })
})
