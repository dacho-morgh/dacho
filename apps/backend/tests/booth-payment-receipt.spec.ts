import { describe, expect, it } from 'vitest'
import request from 'supertest'

import type { User } from '../src/auth/user-store.js'
import { createTestApp } from './helpers.js'

const EXHIBITION = 'exhibition-1'

function headers(user: User) {
  return {
    'x-internal-proxy-secret': 'test-proxy-secret',
    'x-user-id': user.id,
    'x-user-roles': user.roles?.join(',') ?? '',
  }
}

const pdf = (size = 64) => {
  const body = Buffer.alloc(size)
  body.write('%PDF-1.7\n%fake-pdf-content', 0, 'ascii')
  return body
}

const docx = (size = 64) => {
  const body = Buffer.alloc(size)
  body.set([0x50, 0x4b, 0x03, 0x04])
  return body
}

async function setup() {
  const verifiedCompanies = new Set<string>()
  const testApp = await createTestApp({
    boothCompanyEligibility: {
      isVerified: async (companyId) => verifiedCompanies.has(companyId),
    },
  })

  const owner = await testApp.userStore.findOrCreateByPhone('09120000001')
  owner.operationalRole = 'system-owner'
  owner.roles = ['admin']

  const secretariat = await testApp.userStore.findOrCreateByPhone('09120000002')
  secretariat.operationalRole = 'central-secretariat'
  secretariat.roles = ['admin']

  const repA = await testApp.userStore.findOrCreateByPhone('09120000003')
  repA.operationalRole = 'representative'
  repA.roles = ['representative']

  const repB = await testApp.userStore.findOrCreateByPhone('09120000004')
  repB.operationalRole = 'representative'
  repB.roles = ['representative']

  const reviewer = await testApp.userStore.findOrCreateByPhone('09120000005')
  reviewer.operationalRole = 'reviewer'
  reviewer.roles = ['referee']

  const companyA = await testApp.companyStore.create({
    name: 'شرکت آلفا',
    nationalId: '10101010001',
    representativeId: repA.id,
  })
  verifiedCompanies.add(companyA.id)

  const companyB = await testApp.companyStore.create({
    name: 'شرکت بتا',
    nationalId: '10101010002',
    representativeId: repB.id,
  })
  verifiedCompanies.add(companyB.id)

  await testApp.boothCatalogue.upsertSettings(
    EXHIBITION,
    { companyBoothLimit: 5, guideMapReference: null },
    owner.id,
  )

  const booth1Res = await testApp.boothCatalogue.createBooth({
    exhibitionId: EXHIBITION,
    identifier: 'B-101',
    specification: '۱۲ متر مربع',
    location: 'سالن ۱',
    status: 'available',
    active: true,
    priceAmount: 15_000_000,
    priceUnit: 'toman',
    createdBy: owner.id,
  })
  if (!booth1Res.ok) throw new Error('booth 1 setup failed')

  const booth2Res = await testApp.boothCatalogue.createBooth({
    exhibitionId: EXHIBITION,
    identifier: 'B-102',
    specification: '۲۴ متر مربع',
    location: 'سالن ۱',
    status: 'available',
    active: true,
    priceAmount: 30_000_000,
    priceUnit: 'toman',
    createdBy: owner.id,
  })
  if (!booth2Res.ok) throw new Error('booth 2 setup failed')

  return {
    ...testApp,
    owner,
    secretariat,
    repA,
    repB,
    reviewer,
    companyA,
    companyB,
    booth1: booth1Res.booth,
    booth2: booth2Res.booth,
  }
}

describe('T50: Booth payment receipt and payment history', () => {
  it('denies receipt upload when attendance is not approved or reservation is inactive', async () => {
    const { app, repA, secretariat, booth1 } = await setup()

    // Reserve booth1 -> attendanceStatus is pending
    const resReserve = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth1.id}/reserve`)
      .set(headers(repA))
      .send()
    expect(resReserve.status).toBe(201)
    const reservationId = resReserve.body.reservation.id

    // 1. Pending attendance -> rejected
    const pendingRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(), 'receipt.pdf')
      .field('trackingCode', 'TRK-001')

    expect(pendingRes.status).toBe(403)
    expect(pendingRes.body).toMatchObject({
      error: 'attendance_not_approved',
      attendanceStatus: 'pending',
    })

    // 2. Reject attendance -> rejected
    const rejectRes = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'reject', reason: 'عدم تطابق با شرایط حضور' })
    expect(rejectRes.status).toBe(200)

    const rejectedUploadRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(), 'receipt.pdf')

    expect(rejectedUploadRes.status).toBe(403)
    expect(rejectedUploadRes.body).toMatchObject({
      error: 'attendance_rejected',
      attendanceStatus: 'rejected',
    })
  })

  it('enforces role and ownership boundaries for receipt upload', async () => {
    const { app, repA, repB, reviewer, secretariat, booth1 } = await setup()

    const resReserve = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth1.id}/reserve`)
      .set(headers(repA))
      .send()
    const reservationId = resReserve.body.reservation.id

    // Approve attendance
    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })

    // Reviewer role cannot upload receipt
    const reviewerRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(reviewer))
      .attach('file', pdf(), 'receipt.pdf')
    expect(reviewerRes.status).toBe(403)

    // Another company representative cannot upload to company A reservation
    const strangerRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repB))
      .attach('file', pdf(), 'receipt.pdf')
    expect(strangerRes.status).toBe(403)

    // Non-existent reservation returns 404
    const notFoundRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/00000000-0000-0000-0000-000000000000/receipt`)
      .set(headers(repA))
      .attach('file', pdf(), 'receipt.pdf')
    expect(notFoundRes.status).toBe(404)
  })

  it('validates file formats, sizes and empty bodies per Q39 / D12', async () => {
    const { app, repA, secretariat, booth1 } = await setup()

    const resReserve = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth1.id}/reserve`)
      .set(headers(repA))
      .send()
    const reservationId = resReserve.body.reservation.id

    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })

    // No files
    const noFileRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .send()
    expect(noFileRes.status).toBe(400)
    expect(noFileRes.body.error).toBe('invalid_file')

    // Empty file
    const emptyRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', Buffer.alloc(0), 'receipt.pdf')
    expect(emptyRes.status).toBe(400)
    expect(emptyRes.body.error).toBe('empty_file')

    // Disallowed extension (e.g. png)
    const pngRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', Buffer.from('png-data'), 'receipt.png')
    expect(pngRes.status).toBe(400)
    expect(pngRes.body.error).toBe('invalid_file_type')

    // Spoofed content (pdf extension with non-pdf body)
    const spoofedRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', Buffer.from('Not a PDF content at all'), 'receipt.pdf')
    expect(spoofedRes.status).toBe(400)
    expect(spoofedRes.body.error).toBe('invalid_file_content')

    // Oversized (>10MB)
    const bigBody = Buffer.alloc(10_000_001)
    bigBody.write('%PDF-1.7', 0, 'ascii')
    const largeRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', bigBody, 'large.pdf')
    expect(largeRes.status).toBe(413)
    expect(largeRes.body.error).toBe('file_too_large')
  })

  it('submits receipt, transitions paymentStatus to pending_verification without confirming payment', async () => {
    const { app, repA, secretariat, booth1 } = await setup()

    const resReserve = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth1.id}/reserve`)
      .set(headers(repA))
      .send()
    const reservationId = resReserve.body.reservation.id

    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })

    const uploadRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(), 'fish-variz.pdf')
      .field('trackingCode', 'TRK-987654')
      .field('amountToman', '15000000')

    expect(uploadRes.status).toBe(201)
    expect(uploadRes.body.receipt).toMatchObject({
      reservationId,
      version: 1,
      trackingCode: 'TRK-987654',
      status: 'pending_verification',
      files: expect.arrayContaining([
        expect.objectContaining({
          filename: 'fish-variz.pdf',
          mimeType: 'application/pdf',
        }),
      ]),
    })

    // Reservation paymentStatus moved to pending_verification, but NOT confirmed
    expect(uploadRes.body.reservation).toMatchObject({
      id: reservationId,
      attendanceStatus: 'approved',
      paymentStatus: 'pending_verification',
      active: true,
    })

    // Check detail endpoint
    const detailRes = await request(app)
      .get(`/exhibitions/${EXHIBITION}/reservations/${reservationId}`)
      .set(headers(repA))

    expect(detailRes.status).toBe(200)
    expect(detailRes.body.reservation.paymentStatus).toBe('pending_verification')
    expect(detailRes.body.reservation.active).toBe(true)
  })

  it('attaches Word and PDF representations together to one receipt version', async () => {
    const { app, repA, secretariat, booth1 } = await setup()

    const resReserve = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth1.id}/reserve`)
      .set(headers(repA))
      .send()
    const reservationId = resReserve.body.reservation.id

    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })

    const uploadRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('files', pdf(), 'receipt.pdf')
      .attach('files', docx(), 'receipt.docx')
      .field('trackingCode', 'TRK-MULTI-1')

    expect(uploadRes.status).toBe(201)
    expect(uploadRes.body.receipt.version).toBe(1)
    expect(uploadRes.body.receipt.files).toHaveLength(2)
    expect(uploadRes.body.receipt.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ filename: 'receipt.pdf', mimeType: 'application/pdf' }),
        expect.objectContaining({
          filename: 'receipt.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ]),
    )
  })

  it('rejects reuse of tracking code or file contents across different booth requests', async () => {
    const { app, repA, repB, secretariat, booth1, booth2 } = await setup()

    // 1. Company A reserves booth1 and submits receipt
    const resA = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth1.id}/reserve`)
      .set(headers(repA))
      .send()
    const resIdA = resA.body.reservation.id
    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${resIdA}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })

    const receiptBody = pdf(128)
    const uploadARes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${resIdA}/receipt`)
      .set(headers(repA))
      .attach('file', receiptBody, 'payment-a.pdf')
      .field('trackingCode', 'SHARED-TRACKING-123')
    expect(uploadARes.status).toBe(201)

    // 2. Company B reserves booth2 and gets approved
    const resB = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth2.id}/reserve`)
      .set(headers(repB))
      .send()
    const resIdB = resB.body.reservation.id
    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${resIdB}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })

    // Attempt 1: Reusing the same trackingCode on different reservation -> rejected
    const dupTrackingRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${resIdB}/receipt`)
      .set(headers(repB))
      .attach('file', pdf(256), 'different-file.pdf')
      .field('trackingCode', 'SHARED-TRACKING-123')

    expect(dupTrackingRes.status).toBe(409)
    expect(dupTrackingRes.body).toMatchObject({
      error: 'duplicate_receipt',
      reason: 'tracking_code_already_used',
    })

    // Attempt 2: Reusing the exact same file on different reservation -> rejected
    const dupFileRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${resIdB}/receipt`)
      .set(headers(repB))
      .attach('file', receiptBody, 'payment-reused.pdf')
      .field('trackingCode', 'UNIQUE-TRK-999')

    expect(dupFileRes.status).toBe(409)
    expect(dupFileRes.body).toMatchObject({
      error: 'duplicate_receipt',
      reason: 'file_already_used',
    })
  })

  it('preserves correction versions and receipt history on the same reservation', async () => {
    const { app, repA, secretariat, booth1 } = await setup()

    const resReserve = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth1.id}/reserve`)
      .set(headers(repA))
      .send()
    const reservationId = resReserve.body.reservation.id

    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })

    // Initial submission -> Version 1
    const v1Res = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(), 'receipt-v1.pdf')
      .field('trackingCode', 'TRK-CORRECTION-1')
      .field('description', 'فیش اولیه')
    expect(v1Res.status).toBe(201)
    expect(v1Res.body.receipt.version).toBe(1)

    // A second upload waits for the Secretariat's decision on version 1.
    const early = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(80), 'receipt-early.pdf')
    expect(early.status).toBe(409)
    expect(early.body.error).toBe('receipt_pending')

    const returned = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt/decision`)
      .set(headers(secretariat))
      .send({ action: 'return', receiptId: v1Res.body.receipt.id, reason: 'مهر بانک خوانا نیست' })
    expect(returned.status).toBe(200)

    // Correction submission -> Version 2 (same reservation can update)
    const v2Res = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(96), 'receipt-v2-corrected.pdf')
      .field('trackingCode', 'TRK-CORRECTION-2')
      .field('description', 'فیش اصلاح‌شده با مهر بانک')
    expect(v2Res.status).toBe(201)
    expect(v2Res.body.receipt.version).toBe(2)

    // Fetch receipts history
    const historyRes = await request(app)
      .get(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipts`)
      .set(headers(repA))

    expect(historyRes.status).toBe(200)
    expect(historyRes.body.items).toHaveLength(2)
    expect(historyRes.body.items[0]).toMatchObject({
      version: 1,
      trackingCode: 'TRK-CORRECTION-1',
      description: 'فیش اولیه',
      status: 'returned',
      decisionReason: 'مهر بانک خوانا نیست',
    })
    expect(historyRes.body.items[1]).toMatchObject({
      version: 2,
      trackingCode: 'TRK-CORRECTION-2',
      description: 'فیش اصلاح‌شده با مهر بانک',
    })
  })

  it('lets the Secretariat confirm a pending receipt once, without a second financial effect', async () => {
    const { app, repA, secretariat, reviewer, booth1 } = await setup()
    const reserve = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth1.id}/reserve`)
      .set(headers(repA))
      .send()
    const reservationId = reserve.body.reservation.id
    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })
    const upload = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(), 'receipt.pdf')
    const receiptId = upload.body.receipt.id
    const decisionUrl = `/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt/decision`

    const byCompany = await request(app).post(decisionUrl).set(headers(repA)).send({ action: 'confirm', receiptId })
    expect(byCompany.status).toBe(403)
    const byReviewer = await request(app).post(decisionUrl).set(headers(reviewer)).send({ action: 'confirm', receiptId })
    expect(byReviewer.status).toBe(403)

    const noReason = await request(app).post(decisionUrl).set(headers(secretariat)).send({ action: 'return', receiptId })
    expect(noReason.status).toBe(400)
    expect(noReason.body.error).toBe('reason_required')

    const confirmed = await request(app).post(decisionUrl).set(headers(secretariat)).send({ action: 'confirm', receiptId })
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.receipt.status).toBe('confirmed')
    expect(confirmed.body.reservation).toMatchObject({ paymentStatus: 'confirmed', active: true })

    const again = await request(app).post(decisionUrl).set(headers(secretariat)).send({ action: 'confirm', receiptId })
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('invalid_state')

    const afterConfirm = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(90), 'receipt-2.pdf')
    expect(afterConfirm.status).toBe(409)
    expect(afterConfirm.body.error).toBe('payment_confirmed')

    const mine = await request(app).get(`/exhibitions/${EXHIBITION}/my-reservations`).set(headers(repA))
    expect(mine.body.items[0]).toMatchObject({ paymentStatus: 'confirmed', allowedActions: ['read'] })
    expect(mine.body.items[0].latestReceipt).toMatchObject({ id: receiptId, status: 'confirmed' })
  })

  it('rejects a decision on a receipt version that is no longer the latest', async () => {
    const { app, repA, secretariat, booth1 } = await setup()
    const reserve = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth1.id}/reserve`)
      .set(headers(repA))
      .send()
    const reservationId = reserve.body.reservation.id
    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })
    const v1 = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(), 'v1.pdf')
    const decisionUrl = `/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt/decision`
    await request(app).post(decisionUrl).set(headers(secretariat))
      .send({ action: 'return', receiptId: v1.body.receipt.id, reason: 'مبلغ ناخوانا' })
    await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(70), 'v2.pdf')

    const stale = await request(app).post(decisionUrl).set(headers(secretariat))
      .send({ action: 'confirm', receiptId: v1.body.receipt.id })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toBe('stale_receipt')

    const list = await request(app).get(`/admin/exhibitions/${EXHIBITION}/reservations`).set(headers(secretariat))
    expect(list.status).toBe(200)
    expect(list.body.items[0]).toMatchObject({
      companyName: 'شرکت آلفا',
      paymentStatus: 'pending_verification',
      allowedActions: expect.arrayContaining(['verify_receipt', 'return_receipt']),
    })
    expect(list.body.items[0].latestReceipt.version).toBe(2)
  })

  it('authorizes receipt file download with private security headers', async () => {
    const { app, repA, repB, secretariat, booth1 } = await setup()

    const resReserve = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth1.id}/reserve`)
      .set(headers(repA))
      .send()
    const reservationId = resReserve.body.reservation.id

    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })

    const uploadRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(repA))
      .attach('file', pdf(), 'private-receipt.pdf')
      .field('trackingCode', 'TRK-DL-1')

    expect(uploadRes.status).toBe(201)
    const fileId = uploadRes.body.receipt.files[0].id

    // Owning representative downloads file
    const downloadRes = await request(app)
      .get(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt/files/${fileId}/download`)
      .set(headers(repA))

    expect(downloadRes.status).toBe(200)
    expect(downloadRes.headers['content-type']).toBe('application/pdf')
    expect(downloadRes.headers['cache-control']).toBe('private, no-store')
    expect(downloadRes.headers['x-content-type-options']).toBe('nosniff')
    expect(downloadRes.headers['content-security-policy']).toBe("default-src 'none'; sandbox")

    // Secretariat downloads file
    const secDownloadRes = await request(app)
      .get(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt/files/${fileId}/download`)
      .set(headers(secretariat))
    expect(secDownloadRes.status).toBe(200)

    // Unrelated company representative is denied
    const strangerDownloadRes = await request(app)
      .get(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt/files/${fileId}/download`)
      .set(headers(repB))
    expect(strangerDownloadRes.status).toBe(404)
  })
})
