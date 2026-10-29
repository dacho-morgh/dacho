import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { PrivateDocumentStorage } from '../../src/documents/storage.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { clearVerifiedCompanies, seedVerifiedCompanies } from './verified-company-fixtures.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://phase0_test:phase0_test_only@127.0.0.1:55439/dacho_phase0_test'
const pool = new Pool({ connectionString, application_name: 't19-subtopic-requests' })

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'company-user-2', phone: 'company-user-2', operationalRole: 'representative', isActive: true },
  { id: 'other-company-user', phone: 'other-company-user', operationalRole: 'representative', isActive: true },
  { id: 'employer-1', phone: 'employer-1', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'employer-2', phone: 'employer-2', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
]

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت آلفا', nationalId: 'T19-alpha', representativeId: 'company-user-1' },
  { name: 'شرکت بتا', nationalId: 'T19-beta', representativeId: 'other-company-user' },
])

const auth = (id = 'owner') => ({ 'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': id })

const makeApp = async () =>
  createApp({
    pool,
    userStore,
    companyStore,
    jwt: await JwtSigner.create('test'),
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    serviceCatalog: new InMemoryServiceCatalog([
      {
        id: 'event-service',
        key: 'event-application',
        title: 'درخواست رویداد',
        workflow: [{ title: 'بررسی اولیه', role: '1', roleName: 'دبیرخانه', order: 0 }],
        formFields: null,
      },
    ]),
    proxySecret: 'test-proxy-secret',
  })

const eventPayload = (title = 'رویداد اصلی') => ({
  title,
  description: 'توضیحات رویداد',
  registrationOpenAt: '2020-01-01T00:00:00Z',
  registrationCloseAt: '2099-01-01T00:00:00Z',
  responsibleChiefId: 'chief',
  responsibleInvestmentId: 'investment',
})

async function cleanup() {
  const files = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.rfp_files')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all(files.map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)))
}

describe('T19: Independent application per subtopic', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await cleanup()
    await seedVerifiedCompanies(pool, companyStore)
  })

  afterAll(async () => {
    await cleanup()
    await clearVerifiedCompanies(pool)
    await pool.end()
  })

  it('allows a company to create independent applications for multiple subtopics under the same event', async () => {
    const app = await makeApp()

    // 1. Setup Event 1 with 2 subtopics and published RFPs
    const event1Id = (await request(app).post('/admin/events').set(auth()).send(eventPayload('رویداد فناوری')).expect(201)).body.event.id
    const cat1Id = (await request(app).post(`/admin/events/${event1Id}/categories`).set(auth()).send({ title: 'دسته نرم‌افزار' }).expect(201)).body.category.id

    const subtopic1Id = (await request(app).post(`/admin/events/${event1Id}/subtopics`).set(auth()).send({ title: 'زیرعنوان هوش مصنوعی', categoryId: cat1Id, employerId: 'employer-1' }).expect(201)).body.subtopic.id
    const subtopic2Id = (await request(app).post(`/admin/events/${event1Id}/subtopics`).set(auth()).send({ title: 'زیرعنوان اینترنت اشیا', categoryId: cat1Id, employerId: 'employer-2' }).expect(201)).body.subtopic.id

    const rfp1 = (await request(app)
      .post(`/admin/events/${event1Id}/subtopics/${subtopic1Id}/rfp`)
      .set(auth())
      .field('expectedVersionId', '')
      .field('reason', 'RFP 1')
      .attach('files', Buffer.from('%PDF-RFP1'), { filename: 'rfp1.pdf', contentType: 'application/pdf' })
      .expect(201)).body.version

    const rfp2 = (await request(app)
      .post(`/admin/events/${event1Id}/subtopics/${subtopic2Id}/rfp`)
      .set(auth())
      .field('expectedVersionId', '')
      .field('reason', 'RFP 2')
      .attach('files', Buffer.from('%PDF-RFP2'), { filename: 'rfp2.pdf', contentType: 'application/pdf' })
      .expect(201)).body.version

    // 2. Company A applies to subtopic 1
    const res1 = await request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({
        serviceId: 'event-service',
        title: 'درخواست برای هوش مصنوعی',
        eventId: event1Id,
        subtopicId: subtopic1Id,
        rfpVersionId: rfp1.id,
      })
      .expect(201)

    const req1 = res1.body.request
    expect(req1.id).toBeDefined()
    expect(req1.trackingCode).toMatch(/^DCH-\d{4}-\d+$/)
    expect(req1.status).toBe('draft')
    expect(req1.companyId).toBe('1')
    expect(req1.ownerId).toBe('company-user-1')

    // 3. Company A applies to subtopic 2
    const res2 = await request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({
        serviceId: 'event-service',
        title: 'درخواست برای اینترنت اشیا',
        eventId: event1Id,
        subtopicId: subtopic2Id,
        rfpVersionId: rfp2.id,
      })
      .expect(201)

    const req2 = res2.body.request
    expect(req2.id).toBeDefined()
    expect(req2.id).not.toBe(req1.id)
    expect(req2.trackingCode).not.toBe(req1.trackingCode)
    expect(req2.status).toBe('draft')
    expect(req2.companyId).toBe('1')

    // A replacement representative submits; company and creator stay unchanged.
    const company = (await companyStore.findById('1'))!
    company.representativeId = 'company-user-2'
    try {
      await request(app).get(`/requests/${req1.id}`).set(auth('company-user-1')).expect(404)
      const submit1 = await request(app)
        .post(`/requests/${req1.id}/submit`)
        .set(auth('company-user-2'))
        .expect(200)

      expect(submit1.body.request.status).toBe('in_review')
      expect(submit1.body.request.companyId).toBe('1')
      expect(submit1.body.request.ownerId).toBe('company-user-1')
      expect(submit1.body.request.submittedBy).toBe('company-user-2')
      const retry = await request(app).post(`/requests/${req1.id}/submit`).set(auth('company-user-2')).expect(409)
      expect(retry.body).toEqual({ error: 'already_submitted' })
      const persisted = await pool.query('SELECT company_id, owner_id, submitted_by FROM dashboard.requests WHERE id = $1', [req1.id])
      expect(persisted.rows[0]).toEqual({ company_id: '1', owner_id: 'company-user-1', submitted_by: 'company-user-2' })
    } finally {
      company.representativeId = 'company-user-1'
    }

    // Verify req2 is still draft and unchanged
    const get2 = await request(app)
      .get(`/requests/${req2.id}`)
      .set(auth('company-user-1'))
      .expect(200)
    expect(get2.body.request.status).toBe('draft')
  })

  it('rejects duplicate applications for the same event subtopic by the same company with 409 duplicate_subtopic_request', async () => {
    const app = await makeApp()

    const eventId = (await request(app).post('/admin/events').set(auth()).send(eventPayload()).expect(201)).body.event.id
    const catId = (await request(app).post(`/admin/events/${eventId}/categories`).set(auth()).send({ title: 'دسته' }).expect(201)).body.category.id
    const subtopicId = (await request(app).post(`/admin/events/${eventId}/subtopics`).set(auth()).send({ title: 'زیرعنوان یکتا', categoryId: catId, employerId: 'employer-1' }).expect(201)).body.subtopic.id

    const rfp = (await request(app)
      .post(`/admin/events/${eventId}/subtopics/${subtopicId}/rfp`)
      .set(auth())
      .field('expectedVersionId', '')
      .field('reason', 'Initial RFP')
      .attach('files', Buffer.from('%PDF-RFP'), { filename: 'rfp.pdf', contentType: 'application/pdf' })
      .expect(201)).body.version

    const create = () => request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({ serviceId: 'event-service', title: 'ثبت همزمان', eventId, subtopicId, rfpVersionId: rfp.id })
    const concurrent = await Promise.all([create(), create()])
    expect(concurrent.map((res) => res.status).sort()).toEqual([201, 409])
    expect(concurrent.find((res) => res.status === 409)!.body).toEqual({ error: 'duplicate_subtopic_request' })
    const persisted = await pool.query(
      'SELECT r.id FROM dashboard.requests r JOIN dashboard.request_rfps f ON f.request_id = r.id WHERE f.company_id = $1 AND f.event_id = $2 AND f.subtopic_id = $3',
      ['1', eventId, subtopicId],
    )
    expect(persisted.rows).toHaveLength(1)

    // Second application by Company A for SAME subtopic fails with 409
    const dupRes = await request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({
        serviceId: 'event-service',
        title: 'ثبت تکراری',
        eventId,
        subtopicId,
        rfpVersionId: rfp.id,
      })
      .expect(409)

    expect(dupRes.body).toEqual({ error: 'duplicate_subtopic_request' })
  })

  it('allows a different company to apply for the same subtopic without conflict', async () => {
    const app = await makeApp()

    const eventId = (await request(app).post('/admin/events').set(auth()).send(eventPayload()).expect(201)).body.event.id
    const catId = (await request(app).post(`/admin/events/${eventId}/categories`).set(auth()).send({ title: 'دسته' }).expect(201)).body.category.id
    const subtopicId = (await request(app).post(`/admin/events/${eventId}/subtopics`).set(auth()).send({ title: 'زیرعنوان مشترک', categoryId: catId, employerId: 'employer-1' }).expect(201)).body.subtopic.id

    const rfp = (await request(app)
      .post(`/admin/events/${eventId}/subtopics/${subtopicId}/rfp`)
      .set(auth())
      .field('expectedVersionId', '')
      .field('reason', 'Initial RFP')
      .attach('files', Buffer.from('%PDF-RFP'), { filename: 'rfp.pdf', contentType: 'application/pdf' })
      .expect(201)).body.version

    // Company A applies
    const resA = await request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({
        serviceId: 'event-service',
        title: 'درخواست شرکت الف',
        eventId,
        subtopicId,
        rfpVersionId: rfp.id,
      })
      .expect(201)

    // Company B applies for the exact same subtopic -> succeeds
    const resB = await request(app)
      .post('/requests')
      .set(auth('other-company-user'))
      .send({
        serviceId: 'event-service',
        title: 'درخواست شرکت ب',
        eventId,
        subtopicId,
        rfpVersionId: rfp.id,
      })
      .expect(201)

    expect(resA.body.request.id).not.toBe(resB.body.request.id)
    expect(resA.body.request.companyId).toBe('1')
    expect(resB.body.request.companyId).toBe('2')
  })

  it('rejects cross-event subtopic misuse with 400 invalid_event_subtopic', async () => {
    const app = await makeApp()

    // Event 1
    const event1Id = (await request(app).post('/admin/events').set(auth()).send(eventPayload('رویداد اول')).expect(201)).body.event.id

    // Event 2 with its own subtopic
    const event2Id = (await request(app).post('/admin/events').set(auth()).send(eventPayload('رویداد دوم')).expect(201)).body.event.id
    const cat2Id = (await request(app).post(`/admin/events/${event2Id}/categories`).set(auth()).send({ title: 'دسته ۲' }).expect(201)).body.category.id
    const subtopic2Id = (await request(app).post(`/admin/events/${event2Id}/subtopics`).set(auth()).send({ title: 'زیرعنوان رویداد ۲', categoryId: cat2Id, employerId: 'employer-2' }).expect(201)).body.subtopic.id

    const rfp2 = (await request(app)
      .post(`/admin/events/${event2Id}/subtopics/${subtopic2Id}/rfp`)
      .set(auth())
      .field('expectedVersionId', '')
      .field('reason', 'RFP 2')
      .attach('files', Buffer.from('%PDF-RFP2'), { filename: 'rfp2.pdf', contentType: 'application/pdf' })
      .expect(201)).body.version

    // Misuse: pass event1Id with subtopic2Id (which belongs to event 2)
    const res = await request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({
        serviceId: 'event-service',
        title: 'سوءاستفاده از زیرعنوان رویداد دیگر',
        eventId: event1Id,
        subtopicId: subtopic2Id,
        rfpVersionId: rfp2.id,
      })
      .expect(400)

    expect(res.body).toEqual({ error: 'invalid_event_subtopic' })
  })

  it('rejects non-existent subtopic with 400 invalid_event_subtopic', async () => {
    const app = await makeApp()
    const eventId = (await request(app).post('/admin/events').set(auth()).send(eventPayload()).expect(201)).body.event.id

    const fakeSubtopicId = '00000000-0000-0000-0000-000000000001'
    const fakeVersionId = '00000000-0000-0000-0000-000000000002'

    const res = await request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({
        serviceId: 'event-service',
        title: 'زیرعنوان ناموجود',
        eventId,
        subtopicId: fakeSubtopicId,
        rfpVersionId: fakeVersionId,
      })
      .expect(400)

    expect(res.body).toEqual({ error: 'invalid_event_subtopic' })
  })

  it('isolates case access between different companies', async () => {
    const app = await makeApp()

    const eventId = (await request(app).post('/admin/events').set(auth()).send(eventPayload()).expect(201)).body.event.id
    const catId = (await request(app).post(`/admin/events/${eventId}/categories`).set(auth()).send({ title: 'دسته' }).expect(201)).body.category.id
    const subtopicId = (await request(app).post(`/admin/events/${eventId}/subtopics`).set(auth()).send({ title: 'زیرعنوان محرمانه', categoryId: catId, employerId: 'employer-1' }).expect(201)).body.subtopic.id

    const rfp = (await request(app)
      .post(`/admin/events/${eventId}/subtopics/${subtopicId}/rfp`)
      .set(auth())
      .field('expectedVersionId', '')
      .field('reason', 'Initial RFP')
      .attach('files', Buffer.from('%PDF-RFP'), { filename: 'rfp.pdf', contentType: 'application/pdf' })
      .expect(201)).body.version

    const createdA = (await request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({
        serviceId: 'event-service',
        title: 'پرونده شرکت الف',
        eventId,
        subtopicId,
        rfpVersionId: rfp.id,
      })
      .expect(201)).body.request

    // Company B tries to view Company A's request -> 404
    await request(app)
      .get(`/requests/${createdA.id}`)
      .set(auth('other-company-user'))
      .expect(404)
  })
})
