import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { InMemoryServiceCatalog, type ServiceDefinition } from '../../src/catalog/service-catalog.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { runMigrations } from '../../src/db/migrate.js'

// Slice 3 — backend requests entity + endpoints. Drives the HTTP API through its
// public interface: the proxy-forwarded identity (X-User-Id) plus the shared
// internal secret, against a real Postgres (public.* tables).

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString })

const PROXY_SECRET = 'test-internal-proxy-secret'
const OWNER = 'user-1'
const OTHER = 'user-2'

const service: ServiceDefinition = {
  id: '1',
  key: 'financing',
  title: 'تأمین مالی و سرمایه‌گذاری',
  workflow: [{ title: 'بررسی اولیه', role: '1', roleName: 'دبیرخانه', order: 0 }],
  formFields: [
    { name: 'company_name', blockType: 'text', label: 'نام شرکت', required: true },
    { name: 'amount', blockType: 'number', label: 'مبلغ', required: false },
  ],
}

function authHeaders(userId: string) {
  return {
    'x-internal-proxy-secret': PROXY_SECRET,
    'x-user-id': userId,
    'x-user-role': 'applicant',
  }
}

async function createAppUnderTest() {
  const serviceCatalog = new InMemoryServiceCatalog()
  serviceCatalog.set(service)
  const jwt = await JwtSigner.create('test-kid')
  return createApp({
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    jwt,
    userStore: new InMemoryUserStore(),
    pool,
    serviceCatalog,
    proxySecret: PROXY_SECRET,
  })
}

describe('requests API', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM dashboard.requests')
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('auth guard', () => {
    it('rejects requests without the internal proxy secret', async () => {
      const app = await createAppUnderTest()
      const res = await request(app).get('/requests').set({ 'x-user-id': OWNER })
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('forbidden')
    })

    it('rejects requests without an X-User-Id', async () => {
      const app = await createAppUnderTest()
      const res = await request(app)
        .get('/requests')
        .set({ 'x-internal-proxy-secret': PROXY_SECRET })
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('unauthorized')
    })
  })

  describe('create draft', () => {
    it('creates a draft with a tracking code and denormalized service key', async () => {
      const app = await createAppUnderTest()
      const res = await request(app)
        .post('/requests')
        .set(authHeaders(OWNER))
        .send({ serviceId: '1', title: 'درخواست تأمین مالی', answers: { company_name: 'آینده سازان' } })

      expect(res.status).toBe(201)
      expect(res.body.request).toBeDefined()
      expect(res.body.request.trackingCode).toMatch(/^DCH-\d{4}-\d+$/)
      expect(res.body.request.serviceKey).toBe('financing')
      expect(res.body.request.serviceName).toBe('تأمین مالی و سرمایه‌گذاری')
      expect(res.body.request.status).toBe('draft')
      expect(res.body.request.ownerId).toBe(OWNER)
      expect(res.body.request.answers).toEqual({ company_name: 'آینده سازان' })
    })

    it('rejects when the service does not exist', async () => {
      const app = await createAppUnderTest()
      const res = await request(app)
        .post('/requests')
        .set(authHeaders(OWNER))
        .send({ serviceId: 'missing', title: 'x', answers: {} })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('service_not_found')
    })

    it('rejects a non-object answers payload', async () => {
      const app = await createAppUnderTest()
      const res = await request(app)
        .post('/requests')
        .set(authHeaders(OWNER))
        .send({ serviceId: '1', title: 'x', answers: 'nope' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_answers')
    })
  })

  describe('list', () => {
    it('returns only the owner requests, paginated', async () => {
      const app = await createAppUnderTest()
      await request(app).post('/requests').set(authHeaders(OWNER)).send({ serviceId: '1', title: 'mine' })
      await request(app).post('/requests').set(authHeaders(OTHER)).send({ serviceId: '1', title: 'theirs' })

      const res = await request(app).get('/requests').set(authHeaders(OWNER))
      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].title).toBe('mine')
      expect(res.body.page).toBe(1)
      expect(res.body.totalPages).toBe(1)
    })

    it('filters by status', async () => {
      const app = await createAppUnderTest()
      await request(app).post('/requests').set(authHeaders(OWNER)).send({ serviceId: '1', title: 'draft' })
      await request(app).post('/requests').set(authHeaders(OWNER)).send({ serviceId: '1', title: 'other' })

      const res = await request(app).get('/requests?status=draft').set(authHeaders(OWNER))
      expect(res.body.total).toBe(2)

      const none = await request(app).get('/requests?status=approved').set(authHeaders(OWNER))
      expect(none.body.total).toBe(0)
    })
  })

  describe('detail', () => {
    it('returns the request with answers, timeline and the service workflow', async () => {
      const app = await createAppUnderTest()
      const created = await request(app)
        .post('/requests')
        .set(authHeaders(OWNER))
        .send({ serviceId: '1', title: 'detail me', answers: { company_name: 'اَکمِه' } })
      const id = created.body.request.id as string

      const res = await request(app).get(`/requests/${id}`).set(authHeaders(OWNER))
      expect(res.status).toBe(200)
      expect(res.body.request.id).toBe(id)
      expect(res.body.request.answers.company_name).toBe('اَکمِه')
      expect(res.body.timeline).toEqual([])
      expect(res.body.workflow).toEqual([{ title: 'بررسی اولیه', role: '1', roleName: 'دبیرخانه', order: 0 }])
    })

    it('returns 404 for another owner request', async () => {
      const app = await createAppUnderTest()
      const created = await request(app)
        .post('/requests')
        .set(authHeaders(OWNER))
        .send({ serviceId: '1', title: 'mine' })
      const id = created.body.request.id as string

      const res = await request(app).get(`/requests/${id}`).set(authHeaders(OTHER))
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('not_found')
    })
  })

  describe('submit', () => {
    it('transitions a draft to in_review and stamps submissionDate', async () => {
      const app = await createAppUnderTest()
      const created = await request(app)
        .post('/requests')
        .set(authHeaders(OWNER))
        .send({ serviceId: '1', title: 'submit me', answers: { company_name: 'آینده' } })
      const id = created.body.request.id as string

      const res = await request(app).post(`/requests/${id}/submit`).set(authHeaders(OWNER))
      expect(res.status).toBe(200)
      expect(res.body.request.status).toBe('in_review')
      expect(res.body.request.submissionDate).toBeTruthy()
    })

    it('rejects submission when required answers are missing', async () => {
      const app = await createAppUnderTest()
      const created = await request(app)
        .post('/requests')
        .set(authHeaders(OWNER))
        .send({ serviceId: '1', title: 'incomplete', answers: {} })
      const id = created.body.request.id as string

      const res = await request(app).post(`/requests/${id}/submit`).set(authHeaders(OWNER))
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_answers')
      expect(res.body.missingFields).toContain('company_name')
    })

    it('rejects a double submit', async () => {
      const app = await createAppUnderTest()
      const created = await request(app)
        .post('/requests')
        .set(authHeaders(OWNER))
        .send({ serviceId: '1', title: 'twice', answers: { company_name: 'آینده' } })
      const id = created.body.request.id as string

      await request(app).post(`/requests/${id}/submit`).set(authHeaders(OWNER))
      const res = await request(app).post(`/requests/${id}/submit`).set(authHeaders(OWNER))
      expect(res.status).toBe(409)
      expect(res.body.error).toBe('already_submitted')
    })
  })
})
