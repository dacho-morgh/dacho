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

async function setup() {
  const testApp = await createTestApp()
  const owner = await testApp.userStore.findOrCreateByPhone('09120000001')
  owner.operationalRole = 'system-owner'
  owner.roles = ['admin']

  const secretariat = await testApp.userStore.findOrCreateByPhone('09120000002')
  secretariat.operationalRole = 'central-secretariat'
  secretariat.roles = ['admin']

  const representative = await testApp.userStore.findOrCreateByPhone('09120000003')
  representative.operationalRole = 'representative'
  representative.roles = ['representative']

  const reviewer = await testApp.userStore.findOrCreateByPhone('09120000004')
  reviewer.operationalRole = 'reviewer'
  reviewer.roles = ['referee']

  // Setup company for representative
  await testApp.companyStore.create({
    name: 'توسعه فناوری پارس',
    nationalId: '10101010101',
    representativeId: representative.id,
  })

  // Setup catalogue settings and booth
  await testApp.boothCatalogue.upsertSettings(
    EXHIBITION,
    { companyBoothLimit: 3, guideMapReference: null },
    owner.id,
  )
  const boothResult = await testApp.boothCatalogue.createBooth({
    exhibitionId: EXHIBITION,
    identifier: 'B-101',
    specification: '۱۲ متر مربع',
    location: 'سالن شماره ۱',
    status: 'available',
    active: true,
    priceAmount: 20_000_000,
    priceUnit: 'toman',
    createdBy: owner.id,
  })
  if (!boothResult.ok) throw new Error('booth fixture setup failed')

  return { ...testApp, owner, secretariat, representative, reviewer, booth: boothResult.booth }
}

describe('T55: Booth attendance approval and receipt gating', () => {
  it('creates reservation with pending attendance and denies receipt submission', async () => {
    const { app, representative, booth } = await setup()

    // 1. Representative reserves booth
    const reserveRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth.id}/reserve`)
      .set(headers(representative))
      .send()

    expect(reserveRes.status).toBe(201)
    expect(reserveRes.body.reservation).toMatchObject({
      boothId: booth.id,
      exhibitionId: EXHIBITION,
      active: true,
      attendanceStatus: 'pending',
      attendanceReason: null,
      attendanceDecidedBy: null,
      attendanceDecidedAt: null,
    })
    const reservationId = reserveRes.body.reservation.id

    // 2. Try submitting receipt before attendance approval -> rejected
    const receiptRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(representative))
      .send()

    expect(receiptRes.status).toBe(403)
    expect(receiptRes.body).toMatchObject({
      error: 'attendance_not_approved',
      attendanceStatus: 'pending',
    })
  })

  it('prohibits non-administrators from accessing or deciding attendance queue', async () => {
    const { app, representative, reviewer, booth } = await setup()

    const reserveRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth.id}/reserve`)
      .set(headers(representative))
      .send()
    const reservationId = reserveRes.body.reservation.id

    // Representative cannot access admin queue
    const repQueueRes = await request(app)
      .get(`/admin/exhibitions/${EXHIBITION}/reservations`)
      .set(headers(representative))

    expect(repQueueRes.status).toBe(403)

    // Reviewer cannot decide attendance
    const reviewerDecisionRes = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(reviewer))
      .send({ action: 'approve' })

    expect(reviewerDecisionRes.status).toBe(403)
  })

  it('allows Secretariat to approve attendance and unlocks receipt submission', async () => {
    const { app, secretariat, representative, booth } = await setup()

    const reserveRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth.id}/reserve`)
      .set(headers(representative))
      .send()
    const reservationId = reserveRes.body.reservation.id

    // Secretariat inspects queue
    const queueRes = await request(app)
      .get(`/admin/exhibitions/${EXHIBITION}/reservations?status=pending`)
      .set(headers(secretariat))

    expect(queueRes.status).toBe(200)
    expect(queueRes.body.items).toHaveLength(1)
    expect(queueRes.body.items[0]).toMatchObject({
      id: reservationId,
      attendanceStatus: 'pending',
      allowedActions: expect.arrayContaining(['approve', 'reject']),
    })

    // Secretariat approves attendance
    const approveRes = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })

    expect(approveRes.status).toBe(200)
    expect(approveRes.body.reservation).toMatchObject({
      id: reservationId,
      attendanceStatus: 'approved',
      attendanceDecidedBy: secretariat.id,
      active: true,
    })

    // Receipt submission is now allowed
    const receiptRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(representative))
      .send()

    expect(receiptRes.status).toBe(200)
    expect(receiptRes.body).toMatchObject({
      ok: true,
      message: 'receipt_eligible',
      reservationId,
    })
  })

  it('requires reason on rejection, marks reservation rejected and releases booth to catalogue', async () => {
    const { app, secretariat, representative, booth, boothCatalogue } = await setup()

    const reserveRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth.id}/reserve`)
      .set(headers(representative))
      .send()
    const reservationId = reserveRes.body.reservation.id

    // Booth is unavailable in catalogue while reserved
    const catalogueBefore = await boothCatalogue.getBooth(EXHIBITION, booth.id)
    expect(catalogueBefore?.available).toBe(false)

    // Rejection without reason is rejected
    const noReasonRes = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'reject', reason: '   ' })

    expect(noReasonRes.status).toBe(400)
    expect(noReasonRes.body.error).toBe('reason_required')

    // Rejection with valid reason
    const rejectRes = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'reject', reason: 'عدم تطابق زمینه فعالیت با محورهای نمایشگاه' })

    expect(rejectRes.status).toBe(200)
    expect(rejectRes.body.reservation).toMatchObject({
      id: reservationId,
      attendanceStatus: 'rejected',
      attendanceReason: 'عدم تطابق زمینه فعالیت با محورهای نمایشگاه',
      attendanceDecidedBy: secretariat.id,
      active: false,
    })

    // Receipt submission is denied
    const receiptRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(representative))
      .send()

    expect(receiptRes.status).toBe(403)
    expect(receiptRes.body.error).toBe('attendance_rejected')

    // Booth availability is restored in catalogue!
    const catalogueAfter = await boothCatalogue.getBooth(EXHIBITION, booth.id)
    expect(catalogueAfter?.available).toBe(true)
  })

  it('prevents company verification from bypassing attendance approval', async () => {
    const { app, representative, booth, companyStore } = await setup()

    // Mark company as verified
    const company = await companyStore.findByRepresentative(representative.id)
    expect(company).toBeDefined()
    // Even with a verified company in system:
    const reserveRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth.id}/reserve`)
      .set(headers(representative))
      .send()
    const reservationId = reserveRes.body.reservation.id

    // Receipt upload must be denied because attendance approval is independent
    const receiptRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/reservations/${reservationId}/receipt`)
      .set(headers(representative))
      .send()

    expect(receiptRes.status).toBe(403)
    expect(receiptRes.body.error).toBe('attendance_not_approved')
  })

  it('rejects duplicate attendance decisions on already decided reservations', async () => {
    const { app, secretariat, representative, booth } = await setup()

    const reserveRes = await request(app)
      .post(`/exhibitions/${EXHIBITION}/booths/${booth.id}/reserve`)
      .set(headers(representative))
      .send()
    const reservationId = reserveRes.body.reservation.id

    const firstDecision = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'approve' })
    expect(firstDecision.status).toBe(200)

    const secondDecision = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/reservations/${reservationId}/attendance`)
      .set(headers(secretariat))
      .send({ action: 'reject', reason: 'دوباره رد شود' })
    expect(secondDecision.status).toBe(409)
    expect(secondDecision.body.error).toBe('invalid_state')
  })
})
