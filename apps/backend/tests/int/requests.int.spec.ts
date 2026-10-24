import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request, { type Response } from 'supertest'

import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { createApp } from '../../src/app.js'
import { InMemoryServiceCatalog, type ServiceDefinition } from '../../src/catalog/service-catalog.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { runMigrations } from '../../src/db/migrate.js'
import { RequestRepository } from '../../src/dashboard/request-repo.js'

// Slice 3 — backend requests entity + endpoints. Drives the HTTP API through its
// public interface: the proxy-forwarded identity (X-User-Id) plus the shared
// internal secret, against a real Postgres (dashboard.* tables).

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 'requests-integration' })

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
    'x-user-roles': 'representative',
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
    userStore: new InMemoryUserStore([
      ...['user-1', 'user-2', 'company-1', 'company-2'].map((id) => ({ id, phone: id, roles: ['representative' as const], isActive: true })),
      { id: 'staff-1', phone: 'staff-1', roles: ['admin'], isActive: true },
    ]),
    companyStore: new InMemoryCompanyStore(),
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

    it('allocates distinct tracking codes across concurrent creates', async () => {
      const app = await createAppUnderTest()
      const responses = await Promise.all(Array.from({ length: 12 }, (_, index) =>
        request(app).post('/requests').set(authHeaders(index % 2 ? OTHER : OWNER))
          .send({ serviceId: '1', title: `parallel ${index}` }),
      ))

      expect(responses.map((response) => response.status)).toEqual(Array(12).fill(201))
      const codes = responses.map((response) => response.body.request.trackingCode)
      expect(new Set(codes).size).toBe(12)
      const stored = await pool.query('SELECT tracking_code FROM dashboard.requests')
      expect(stored.rows.map((row) => row.tracking_code).sort()).toEqual(codes.sort())
    })

    it('does not collide or reuse a code after deleting requests', async () => {
      const app = await createAppUnderTest()
      const create = () => request(app).post('/requests').set(authHeaders(OWNER))
        .send({ serviceId: '1', title: 'deletion fixture' }).expect(201)
      const first = await create()
      const second = await create()
      await pool.query('DELETE FROM dashboard.requests WHERE id = $1', [first.body.request.id])
      const third = await create()
      await pool.query('DELETE FROM dashboard.requests')
      const fourth = await create()

      const codes = [first, second, third, fourth].map((response) => response.body.request.trackingCode)
      expect(new Set(codes).size).toBe(4)
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

    it('allows exactly one concurrent HTTP submit and preserves its result on retry', async () => {
      const app = await createAppUnderTest()
      const created = await request(app).post('/requests').set(authHeaders(OWNER))
        .send({ serviceId: '1', title: 'concurrent submit', answers: { company_name: 'آینده' } })
        .expect(201)
      const id = created.body.request.id as string
      const blocker = await pool.connect()
      let submissions: Promise<Response>[] = []
      try {
        await blocker.query('BEGIN')
        await blocker.query('SELECT id FROM dashboard.requests WHERE id = $1 FOR UPDATE', [id])
        // Both HTTP handlers must reach the blocked UPDATE before releasing it.
        // This makes the former read-then-write race deterministic.
        const pending = [0, 1].map(() => request(app).post(`/requests/${id}/submit`)
          .set(authHeaders(OWNER)).then((response) => response))
        submissions = pending
        await expect.poll(async () => {
          const { rows } = await pool.query<{ waiting: number }>(
            `SELECT COUNT(*)::int AS waiting FROM pg_stat_activity
             WHERE application_name = 'requests-integration' AND datname = current_database()
               AND wait_event_type = 'Lock' AND query LIKE 'UPDATE dashboard.requests%'`,
          )
          return rows[0]?.waiting
        }, { timeout: 3000, interval: 10 }).toBe(2)
        await blocker.query('COMMIT')

        const responses = await Promise.all(pending)
        expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
        expect(responses.find((response) => response.status === 409)?.body.error).toBe('already_submitted')
        const winner = responses.find((response) => response.status === 200)!.body.request
        expect(winner.status).toBe('in_review')
        expect(winner.assignedRole).toBe('دبیرخانه')
        const retry = await request(app).post(`/requests/${id}/submit`).set(authHeaders(OWNER))
        expect(retry.status).toBe(409)
        const fresh = await request(app).get(`/requests/${id}`).set(authHeaders(OWNER)).expect(200)
        expect(fresh.body.request).toEqual(winner)
      } finally {
        await blocker.query('ROLLBACK')
        blocker.release()
        await Promise.allSettled(submissions)
      }
    })

    it('denies a different owner and leaves every non-draft state untouched', async () => {
      const app = await createAppUnderTest()
      const created = await request(app).post('/requests').set(authHeaders(OWNER))
        .send({ serviceId: '1', title: 'scope and state', answers: { company_name: 'آینده' } })
        .expect(201)
      const id = created.body.request.id as string
      const repo = new RequestRepository(pool)
      expect(await repo.submit(id, OTHER)).toBe('not_found')
      expect(await repo.submit('00000000-0000-0000-0000-000000000000', OWNER)).toBe('not_found')
      expect((await repo.findById(id, OWNER))?.status).toBe('draft')

      for (const status of ['in_review', 'action_needed', 'approved', 'rejected']) {
        await pool.query('UPDATE dashboard.requests SET status = $2 WHERE id = $1', [id, status])
        const before = await repo.findById(id, OWNER)
        expect(await repo.submit(id, OWNER, { assignedRole: 'replacement', currentStep: 'replacement' }))
          .toBe('already_submitted')
        expect(await repo.findById(id, OWNER)).toEqual(before)
      }
    })
  })
})
