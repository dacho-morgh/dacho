import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { runMigrations } from '../../src/db/migrate.js'
import { PostgresBoothCatalogueRepository } from '../../src/exhibitions/catalogue-repo.js'
import { PostgresBoothReservationRepository } from '../../src/exhibitions/reservation-repo.js'
import { notifyBoothStep } from '../../src/dashboard/next-role.js'
import { PostgresNotificationOutbox } from '../../src/dashboard/notification-outbox.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:***@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 's1-inbox-booth-steps' })
const exhibitionId = 'inbox-booth-int-test'
const catalogue = new PostgresBoothCatalogueRepository(pool)
const reservations = new PostgresBoothReservationRepository(pool)

async function clearFixtures() {
  // Booth notice letters keep their row when the booth goes (ON DELETE SET NULL), so clear them by exhibition.
  await pool.query('DELETE FROM dashboard.letters WHERE exhibition_id = $1', [exhibitionId])
  await pool.query('DELETE FROM dashboard.booth_receipt_files WHERE reservation_id IN (SELECT id FROM dashboard.booth_reservations WHERE exhibition_id = $1)', [exhibitionId])
  await pool.query('DELETE FROM dashboard.booth_payment_receipts WHERE reservation_id IN (SELECT id FROM dashboard.booth_reservations WHERE exhibition_id = $1)', [exhibitionId])
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
    specification: 'تست غرفه',
    location: null,
    status: 'available',
    active: true,
    priceAmount: 10_000_000,
    priceUnit: 'toman',
    createdBy: 'owner',
  })
  if (!result.ok) throw new Error('fixture creation failed')
  return result.booth
}

type StepLetter = { recipient_id: string; next_step: string | null; done: boolean; exhibition_id: string | null }

const stepsOf = async (reservationId: string) =>
  (await pool.query<StepLetter>(
    `SELECT recipient_id, next_step, next_step_done_at IS NOT NULL AS done, exhibition_id
     FROM dashboard.letters WHERE booth_reservation_id = $1 ORDER BY sent_at, id`,
    [reservationId],
  )).rows

describe('S1: booth request next steps (int)', () => {
  const outbox = new PostgresNotificationOutbox(pool)

  beforeAll(async () => {
    await runMigrations(connectionString)
  })
  beforeEach(clearFixtures)
  afterAll(async () => {
    await clearFixtures()
    await pool.end()
  })

  async function reserved() {
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 3, guideMapReference: null }, 'owner')
    const booth = await createBooth('INB-01')
    const res = await reservations.reserve({ exhibitionId, boothId: booth.id, companyId: 'company-a', actorId: 'user-a' })
    if (!res.ok) throw new Error('reservation fixture failed')
    return res.reservation.id
  }

  it('asks the company for its receipt after approval, and again after a return', async () => {
    const id = await reserved()

    await notifyBoothStep(pool, outbox, { reservationId: id, actorId: 'secretariat-1', action: 'booth_attendance_approve' })
    expect(await stepsOf(id)).toEqual([
      { recipient_id: 'user-a', next_step: 'booth_receipt', done: false, exhibition_id: exhibitionId },
    ])

    // Sending the receipt is the company's answer; Secretariat (from public.users) is asked next.
    await notifyBoothStep(pool, outbox, { reservationId: id, actorId: 'user-a', action: 'booth_receipt_submit' })
    expect((await stepsOf(id)).filter((letter) => letter.recipient_id === 'user-a')).toEqual([
      { recipient_id: 'user-a', next_step: 'booth_receipt', done: true, exhibition_id: exhibitionId },
    ])

    await notifyBoothStep(pool, outbox, { reservationId: id, actorId: 'secretariat-1', action: 'booth_receipt_return', reason: 'مبلغ ناخوانا' })
    const company = (await stepsOf(id)).filter((letter) => letter.recipient_id === 'user-a')
    expect(company.map((letter) => [letter.next_step, letter.done])).toEqual([
      ['booth_receipt', true],
      ['booth_receipt', false],
    ])
    // Every pending receipt-decision step is settled by the return.
    expect((await stepsOf(id)).filter((letter) => letter.next_step === 'receipt_decision' && !letter.done)).toEqual([])
  })

  it('records booth jobs against the booth request, never a dashboard request', async () => {
    const id = await reserved()
    const jobIds = await notifyBoothStep(pool, outbox, { reservationId: id, actorId: 'secretariat-1', action: 'booth_attendance_reject', reason: 'ظرفیت تکمیل' })
    expect(jobIds).toHaveLength(1)
    const job = await outbox.findById(jobIds[0]!)
    expect(job).toMatchObject({ requestId: null, boothReservationId: id, status: 'delivered', nextStep: null })
  })

  it('never throws for an unknown booth request', async () => {
    expect(await notifyBoothStep(pool, outbox, {
      reservationId: '00000000-0000-0000-0000-000000000000', actorId: 'x', action: 'booth_request',
    })).toEqual([])
  })
})
