import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { runMigrations } from '../../src/db/migrate.js'
import { PostgresBoothCatalogueRepository } from '../../src/exhibitions/catalogue-repo.js'
import { PostgresBoothReservationRepository } from '../../src/exhibitions/reservation-repo.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:***@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 'booth-attendance-integration' })
const exhibitionId = 'attendance-approval-int-test'
const catalogue = new PostgresBoothCatalogueRepository(pool)
const reservations = new PostgresBoothReservationRepository(pool)

async function clearFixtures() {
  await pool.query('DELETE FROM dashboard.booth_attendance_decisions WHERE reservation_id IN (SELECT id FROM dashboard.booth_reservations WHERE exhibition_id = $1)', [exhibitionId])
  await pool.query('DELETE FROM dashboard.booth_reservations WHERE exhibition_id = $1', [exhibitionId])
  await pool.query('UPDATE dashboard.exhibition_booths SET price_version_id = NULL WHERE exhibition_id = $1', [exhibitionId])
  await pool.query('DELETE FROM dashboard.booth_price_versions WHERE exhibition_id = $1', [exhibitionId])
  await pool.query('DELETE FROM dashboard.exhibition_booths WHERE exhibition_id = $1', [exhibitionId])
  await pool.query('DELETE FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id = $1', [exhibitionId])
}

async function createBooth(identifier: string) {
  const result = await catalogue.createBooth({
    exhibitionId,
    identifier,
    specification: 'test specification',
    location: null,
    status: 'available',
    active: true,
    priceAmount: 500,
    priceUnit: 'toman',
    createdBy: 'owner',
  })
  if (!result.ok) throw new Error('fixture creation failed')
  return result.booth
}

describe('T55: Booth attendance approval integration', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })
  beforeEach(clearFixtures)
  afterAll(async () => {
    await clearFixtures()
    await pool.end()
  })

  it('records attendance decision and history in PostgreSQL and locks concurrent decisions', async () => {
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 2, guideMapReference: null }, 'owner')
    const booth = await createBooth('att-1')

    const reserveRes = await reservations.reserve({
      exhibitionId,
      boothId: booth.id,
      companyId: 'company-a',
      actorId: 'user-a',
    })
    expect(reserveRes.ok).toBe(true)
    if (!reserveRes.ok) return
    const reservationId = reserveRes.reservation.id

    // Check receipt gating before decision
    const preCheck = await reservations.canSubmitReceipt(reservationId, 'company-a')
    expect(preCheck).toEqual({
      ok: false,
      error: 'attendance_not_approved',
      attendanceStatus: 'pending',
    })

    // Concurrent attendance decisions: only one can succeed
    const [dec1, dec2] = await Promise.all([
      reservations.decideAttendance({ id: reservationId, action: 'approve', actorId: 'secretariat-1' }),
      reservations.decideAttendance({ id: reservationId, action: 'reject', reason: 'رد شد', actorId: 'secretariat-2' }),
    ])

    const successes = [dec1, dec2].filter((d) => d.ok)
    const failures = [dec1, dec2].filter((d) => !d.ok)
    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatchObject({ ok: false, error: 'invalid_state' })

    // Check decisions history table
    const history = await reservations.listDecisionsHistory(reservationId)
    expect(history).toHaveLength(1)
    expect(history[0]?.reservationId).toBe(reservationId)

    // Check receipt gating after approval
    if (successes[0]?.ok && successes[0].reservation.attendanceStatus === 'approved') {
      const postCheck = await reservations.canSubmitReceipt(reservationId, 'company-a')
      expect(postCheck.ok).toBe(true)
    }
  })

  it('rejecting attendance deactivates reservation and releases booth so another company can reserve it', async () => {
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 2, guideMapReference: null }, 'owner')
    const booth = await createBooth('att-2')

    // Company A reserves booth
    const reserveA = await reservations.reserve({
      exhibitionId,
      boothId: booth.id,
      companyId: 'company-a',
      actorId: 'user-a',
    })
    expect(reserveA.ok).toBe(true)
    if (!reserveA.ok) return

    // Company B tries to reserve same booth -> fails
    const reserveBBlocked = await reservations.reserve({
      exhibitionId,
      boothId: booth.id,
      companyId: 'company-b',
      actorId: 'user-b',
    })
    expect(reserveBBlocked).toEqual({ ok: false, error: 'booth_unavailable' })

    // Secretariat rejects Company A's attendance
    const rejectRes = await reservations.decideAttendance({
      id: reserveA.reservation.id,
      action: 'reject',
      reason: 'مدارک نامعتبر',
      actorId: 'secretariat-1',
    })
    expect(rejectRes.ok).toBe(true)
    if (!rejectRes.ok) return
    expect(rejectRes.reservation.active).toBe(false)
    expect(rejectRes.reservation.attendanceStatus).toBe('rejected')

    // Booth is now released in catalogue!
    const catalogueBooth = await catalogue.getBooth(exhibitionId, booth.id)
    expect(catalogueBooth?.available).toBe(true)

    // Company B can now reserve the booth successfully!
    const reserveBSuccess = await reservations.reserve({
      exhibitionId,
      boothId: booth.id,
      companyId: 'company-b',
      actorId: 'user-b',
    })
    expect(reserveBSuccess.ok).toBe(true)
  })
})
