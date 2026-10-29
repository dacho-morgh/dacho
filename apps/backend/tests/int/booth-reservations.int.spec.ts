import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { runMigrations } from '../../src/db/migrate.js'
import { PostgresBoothCatalogueRepository } from '../../src/exhibitions/catalogue-repo.js'
import { PostgresBoothReservationRepository } from '../../src/exhibitions/reservation-repo.js'
import { PostgresVerificationStore } from '../../src/dashboard/verification-repo.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:***@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 'booth-reservations-integration' })
const exhibitionId = 'reservation-concurrency-test'
const catalogue = new PostgresBoothCatalogueRepository(pool)
const reservations = new PostgresBoothReservationRepository(pool)

async function clearFixtures() {
  await pool.query('DELETE FROM dashboard.booth_reservations WHERE exhibition_id = $1', [exhibitionId])
  await pool.query('UPDATE dashboard.exhibition_booths SET price_version_id = NULL WHERE exhibition_id = $1', [exhibitionId])
  await pool.query('DELETE FROM dashboard.booth_price_versions WHERE exhibition_id = $1', [exhibitionId])
  await pool.query('DELETE FROM dashboard.exhibition_booths WHERE exhibition_id = $1', [exhibitionId])
  await pool.query('DELETE FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id = $1', [exhibitionId])
  await pool.query("DELETE FROM dashboard.company_verifications WHERE company_id = 'booth-eligibility-fixture'")
  await pool.query("DELETE FROM dashboard.activities WHERE owner_id = 'booth-eligibility-representative'")
}

async function createBooth(identifier: string) {
  const result = await catalogue.createBooth({ exhibitionId, identifier, specification: 'test', location: null,
    status: 'available', active: true, priceAmount: 100, priceUnit: 'toman', createdBy: 'owner' })
  if (!result.ok) throw new Error('fixture creation failed')
  return result.booth
}

// Internal repository coverage only. No endpoint may invoke this before T15 eligibility exists.
describe('booth reservation concurrency', () => {
  beforeAll(async () => { await runMigrations(connectionString) })
  beforeEach(clearFixtures)
  afterAll(async () => {
    await clearFixtures()
    await pool.end()
  })

  it('enforces current verification inside the reservation transaction', async () => {
    const companyId = 'booth-eligibility-fixture'
    const actorId = 'booth-eligibility-representative'
    const verification = new PostgresVerificationStore(pool)
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 2, guideMapReference: null }, 'owner')
    const booth = await createBooth('verified-only')
    const reserve = (boothId = booth.id) => reservations.reserve({
      exhibitionId, boothId, companyId, actorId, requireVerification: true,
    })
    expect(await reserve()).toEqual({ ok: false, error: 'company_not_verified' })
    const submitted = await verification.submit({ companyId, representativeId: actorId, snapshot: {} })
    if (!submitted.ok) throw new Error('Verification fixture failed')
    expect(await reserve()).toEqual({ ok: false, error: 'company_not_verified' })
    await verification.decide({ id: submitted.verification.id, action: 'approve', reviewerId: 'secretariat' })
    expect(await reserve()).toMatchObject({ ok: true })
    await verification.invalidateApproval(companyId, 'Changed registration')
    const secondBooth = await createBooth('after-invalidation')
    expect(await reserve(secondBooth.id)).toEqual({ ok: false, error: 'company_not_verified' })
    expect(await reservations.listByCompany(companyId)).toHaveLength(1)
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

  it('keeps reserved booths unavailable across catalogue reads and price edits, and preserves the captured price', async () => {
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 2, guideMapReference: null }, 'owner')
    const booth = await createBooth('captured-price')
    const result = await reservations.reserve({ exhibitionId, boothId: booth.id, companyId: 'price-company', actorId: 'representative' })
    if (!result.ok) throw new Error('reservation failed')
    expect((await catalogue.getBooth(exhibitionId, booth.id))?.available).toBe(false)
    expect((await catalogue.listBooths(exhibitionId))[0]?.available).toBe(false)
    const edited = await catalogue.updateBooth({ exhibitionId, boothId: booth.id, priceAmount: 200, priceUnit: 'toman', updatedBy: 'owner' })
    expect(edited).toMatchObject({ ok: true, booth: { available: false, status: 'available', priceAmount: 200 } })
    expect(await catalogue.findPriceVersion(result.reservation.priceVersionId)).toMatchObject({ priceAmount: 100, priceUnit: 'toman' })
    // Synthetic release models a later authorized transition; it is not an exposed command.
    await pool.query('UPDATE dashboard.booth_reservations SET active = false WHERE id = $1', [result.reservation.id])
    expect((await catalogue.getBooth(exhibitionId, booth.id))?.available).toBe(true)
    await catalogue.updateBooth({ exhibitionId, boothId: booth.id, status: 'unavailable', updatedBy: 'owner' })
    expect((await catalogue.getBooth(exhibitionId, booth.id))?.available).toBe(false)
  })

  it('returns each request cost at creation and retains its version through price edits and attendance decisions', async () => {
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 2, guideMapReference: null }, 'owner')
    const firstBooth = await createBooth('cost-one')
    const secondBooth = await createBooth('cost-two')
    await catalogue.updateBooth({ exhibitionId, boothId: secondBooth.id, priceAmount: 350, priceUnit: 'toman', updatedBy: 'owner' })
    const first = await reservations.reserve({ exhibitionId, boothId: firstBooth.id, companyId: 'cost-company', actorId: 'representative' })
    const second = await reservations.reserve({ exhibitionId, boothId: secondBooth.id, companyId: 'cost-company', actorId: 'representative' })
    if (!first.ok || !second.ok) throw new Error('reservation failed')
    const firstCost = { id: first.reservation.id, priceVersionId: firstBooth.priceVersionId, priceAmount: 100, priceUnit: 'toman' }
    const secondCost = { id: second.reservation.id, priceVersionId: second.reservation.priceVersionId, priceAmount: 350, priceUnit: 'toman' }
    expect(first.reservation).toMatchObject(firstCost)
    expect(second.reservation).toMatchObject(secondCost)
    expect(first.reservation.id).not.toBe(second.reservation.id)
    expect(first.reservation.priceVersionId).not.toBe(second.reservation.priceVersionId)
    await catalogue.updateBooth({ exhibitionId, boothId: firstBooth.id, priceAmount: 900, priceUnit: 'toman', updatedBy: 'owner' })
    expect(await reservations.findById(first.reservation.id)).toMatchObject(firstCost)
    expect(await reservations.listByCompany('cost-company')).toEqual(expect.arrayContaining([
      expect.objectContaining(firstCost), expect.objectContaining(secondCost),
    ]))
    expect(await reservations.listByExhibition(exhibitionId)).toEqual(expect.arrayContaining([
      expect.objectContaining(firstCost), expect.objectContaining(secondCost),
    ]))
    const approved = await reservations.decideAttendance({ id: first.reservation.id, action: 'approve', actorId: 'secretariat' })
    expect(approved).toMatchObject({ ok: true, reservation: { ...firstCost, attendanceStatus: 'approved' } })
    const rejected = await reservations.decideAttendance({ id: second.reservation.id, action: 'reject', reason: 'Unavailable', actorId: 'secretariat' })
    expect(rejected).toMatchObject({ ok: true, reservation: { ...secondCost, attendanceStatus: 'rejected', active: false } })
    expect(await reservations.findById(second.reservation.id)).toMatchObject(secondCost)
    await catalogue.updateBooth({ exhibitionId, boothId: secondBooth.id, priceAmount: 700, priceUnit: 'toman', updatedBy: 'owner' })
    const newer = await reservations.reserve({ exhibitionId, boothId: secondBooth.id, companyId: 'next-company', actorId: 'next-representative' })
    expect(newer).toMatchObject({ ok: true, reservation: { priceAmount: 700, priceUnit: 'toman' } })
    if (!newer.ok) throw new Error('reservation failed')
    expect(newer.reservation.id).not.toBe(second.reservation.id)
    expect(newer.reservation.priceVersionId).not.toBe(second.reservation.priceVersionId)
    expect(await reservations.findById(second.reservation.id)).toMatchObject(secondCost)
  })

  it('does not reserve a booth from another exhibition', async () => {
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 1, guideMapReference: null }, 'owner')
    const booth = await createBooth('scope')
    const otherExhibition = `${exhibitionId}-other`
    await catalogue.upsertSettings(otherExhibition, { companyBoothLimit: 1, guideMapReference: null }, 'owner')
    try {
      const result = await reservations.reserve({ exhibitionId: otherExhibition, boothId: booth.id, companyId: 'company', actorId: 'representative' })
      expect(result).toEqual({ ok: false, error: 'booth_unavailable' })
      expect((await pool.query('SELECT id FROM dashboard.booth_reservations WHERE booth_id = $1', [booth.id])).rows).toHaveLength(0)
    } finally {
      await pool.query('DELETE FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id = $1', [otherExhibition])
    }
  })

})
