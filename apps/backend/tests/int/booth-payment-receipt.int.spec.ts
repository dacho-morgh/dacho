import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { runMigrations } from '../../src/db/migrate.js'
import { PostgresBoothCatalogueRepository } from '../../src/exhibitions/catalogue-repo.js'
import { PostgresBoothReservationRepository } from '../../src/exhibitions/reservation-repo.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:***@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 'booth-payment-receipt-integration' })
const exhibitionId = 'receipt-int-test'
const catalogue = new PostgresBoothCatalogueRepository(pool)
const reservations = new PostgresBoothReservationRepository(pool)

async function clearFixtures() {
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

describe('T50: Booth payment receipt PostgreSQL integration', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })
  beforeEach(clearFixtures)
  afterAll(async () => {
    await clearFixtures()
    await pool.end()
  })

  it('persists receipt and files, sets payment_status to pending_verification in PostgreSQL', async () => {
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 3, guideMapReference: null }, 'owner')
    const booth = await createBooth('REC-01')

    const reserveRes = await reservations.reserve({
      exhibitionId,
      boothId: booth.id,
      companyId: 'company-a',
      actorId: 'user-a',
    })
    expect(reserveRes.ok).toBe(true)
    if (!reserveRes.ok) return
    const reservationId = reserveRes.reservation.id

    // Initially payment_status is unpaid
    expect(reserveRes.reservation.paymentStatus).toBe('unpaid')

    // Approve attendance
    const approveRes = await reservations.decideAttendance({
      id: reservationId,
      action: 'approve',
      actorId: 'secretariat-1',
    })
    expect(approveRes.ok).toBe(true)

    // Submit receipt
    const submitRes = await reservations.submitReceipt({
      reservationId,
      companyId: 'company-a',
      actorId: 'user-a',
      trackingCode: 'TRK-PG-001',
      amountToman: 10_000_000,
      description: 'فیش پرداخت اولیه',
      files: [
        {
          filename: 'fish.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          storageKey: 'key-fish-pdf-1',
          fileHash: 'hash-abc-123',
        },
      ],
    })

    expect(submitRes.ok).toBe(true)
    if (!submitRes.ok) return
    expect(submitRes.receipt.version).toBe(1)
    expect(submitRes.receipt.trackingCode).toBe('TRK-PG-001')
    expect(submitRes.receipt.status).toBe('pending_verification')
    expect(submitRes.reservation.paymentStatus).toBe('pending_verification')
    expect(submitRes.reservation.active).toBe(true)

    // Verify row in database
    const dbReceipt = await pool.query(
      'SELECT * FROM dashboard.booth_payment_receipts WHERE reservation_id = $1',
      [reservationId],
    )
    expect(dbReceipt.rows).toHaveLength(1)
    expect(dbReceipt.rows[0].tracking_code).toBe('TRK-PG-001')
    expect(dbReceipt.rows[0].status).toBe('pending_verification')

    const dbFiles = await pool.query(
      'SELECT * FROM dashboard.booth_receipt_files WHERE reservation_id = $1',
      [reservationId],
    )
    expect(dbFiles.rows).toHaveLength(1)
    expect(dbFiles.rows[0].file_hash).toBe('hash-abc-123')
    expect(dbFiles.rows[0].storage_key).toBe('key-fish-pdf-1')
  })

  it('enforces duplicate tracking code and duplicate file rejection across distinct reservations', async () => {
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 3, guideMapReference: null }, 'owner')
    const booth1 = await createBooth('REC-DUP-1')
    const booth2 = await createBooth('REC-DUP-2')

    // Reserve booth1 and approve attendance
    const res1 = await reservations.reserve({
      exhibitionId,
      boothId: booth1.id,
      companyId: 'company-a',
      actorId: 'user-a',
    })
    if (!res1.ok) throw new Error('res1 failed')
    await reservations.decideAttendance({ id: res1.reservation.id, action: 'approve', actorId: 'sec' })

    // Reserve booth2 and approve attendance
    const res2 = await reservations.reserve({
      exhibitionId,
      boothId: booth2.id,
      companyId: 'company-b',
      actorId: 'user-b',
    })
    if (!res2.ok) throw new Error('res2 failed')
    await reservations.decideAttendance({ id: res2.reservation.id, action: 'approve', actorId: 'sec' })

    // Submit receipt on res1
    const sub1 = await reservations.submitReceipt({
      reservationId: res1.reservation.id,
      companyId: 'company-a',
      actorId: 'user-a',
      trackingCode: 'PG-DUP-TRACKING',
      files: [
        {
          filename: 'original.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          storageKey: 'key-orig-1',
          fileHash: 'sha-original-hash',
        },
      ],
    })
    expect(sub1.ok).toBe(true)

    // Attempt reusing same tracking code on res2 -> rejected
    const dupTrack = await reservations.submitReceipt({
      reservationId: res2.reservation.id,
      companyId: 'company-b',
      actorId: 'user-b',
      trackingCode: 'PG-DUP-TRACKING',
      files: [
        {
          filename: 'other.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4096,
          storageKey: 'key-other-2',
          fileHash: 'sha-different-hash',
        },
      ],
    })
    expect(dupTrack).toEqual({
      ok: false,
      error: 'duplicate_receipt',
      reason: 'tracking_code_already_used',
    })

    // Attempt reusing same file hash on res2 -> rejected
    const dupHash = await reservations.submitReceipt({
      reservationId: res2.reservation.id,
      companyId: 'company-b',
      actorId: 'user-b',
      trackingCode: 'UNIQUE-TRACK-2',
      files: [
        {
          filename: 'reused.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          storageKey: 'key-reused-2',
          fileHash: 'sha-original-hash',
        },
      ],
    })
    expect(dupHash).toEqual({
      ok: false,
      error: 'duplicate_receipt',
      reason: 'file_already_used',
    })
  })

  it('increments version on subsequent submissions for the same reservation', async () => {
    await catalogue.upsertSettings(exhibitionId, { companyBoothLimit: 3, guideMapReference: null }, 'owner')
    const booth = await createBooth('REC-VER-1')

    const res = await reservations.reserve({
      exhibitionId,
      boothId: booth.id,
      companyId: 'company-a',
      actorId: 'user-a',
    })
    if (!res.ok) throw new Error('res failed')
    await reservations.decideAttendance({ id: res.reservation.id, action: 'approve', actorId: 'sec' })

    // V1
    const sub1 = await reservations.submitReceipt({
      reservationId: res.reservation.id,
      companyId: 'company-a',
      actorId: 'user-a',
      trackingCode: 'V1-TRACK',
      files: [
        {
          filename: 'v1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1000,
          storageKey: 'key-v1',
          fileHash: 'hash-v1',
        },
      ],
    })
    expect(sub1.ok).toBe(true)
    if (!sub1.ok) return
    expect(sub1.receipt.version).toBe(1)

    // V2 (correction)
    const sub2 = await reservations.submitReceipt({
      reservationId: res.reservation.id,
      companyId: 'company-a',
      actorId: 'user-a',
      trackingCode: 'V2-TRACK',
      files: [
        {
          filename: 'v2.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1200,
          storageKey: 'key-v2',
          fileHash: 'hash-v2',
        },
      ],
    })
    expect(sub2.ok).toBe(true)
    if (!sub2.ok) return
    expect(sub2.receipt.version).toBe(2)

    // List all versions
    const all = await reservations.listReceipts(res.reservation.id)
    expect(all).toHaveLength(2)
    expect(all[0]?.version).toBe(1)
    expect(all[1]?.version).toBe(2)

    // Find file
    const fileId = all[0]?.files[0]?.id
    expect(fileId).toBeDefined()
    if (!fileId) return
    const fileRecord = await reservations.findReceiptFile(fileId)
    expect(fileRecord).toMatchObject({
      id: fileId,
      filename: 'v1.pdf',
      storageKey: 'key-v1',
      reservationId: res.reservation.id,
      companyId: 'company-a',
    })
  })
})
