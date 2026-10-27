import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { createApp } from '../../src/app.js'
import { InMemoryServiceCatalog, type ServiceDefinition } from '../../src/catalog/service-catalog.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { runMigrations } from '../../src/db/migrate.js'

// Slice 6 — stats (SQL aggregates) + activities reads (event log), and wiring the
// request-detail timeline to the activities table (replacing the slice-3 stub).

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString })

const PROXY_SECRET = 'test-internal-proxy-secret'
const OWNER = 'user-1'

const service: ServiceDefinition = {
  id: '1',
  key: 'financing',
  title: 'تأمین مالی و سرمایه‌گذاری',
  workflow: [
    { title: 'بررسی اولیه', role: '10', roleName: 'دبیرخانه', order: 0 },
    { title: 'داوری تخصصی', role: '11', roleName: 'داور فنی', order: 1 },
  ],
  formFields: [],
}

function ownerHeaders() {
  return {
    'x-internal-proxy-secret': PROXY_SECRET,
    'x-user-id': OWNER,
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
      ...['user-1', 'user-2', 'company-1', 'company-2', 'someone-else'].map((id) => ({ id, phone: id, roles: ['representative' as const], isActive: true })),
      { id: 'staff-1', phone: 'staff-1', roles: ['admin'], isActive: true },
    ]),
    companyStore: new InMemoryCompanyStore([
      { name: 'Company 1', nationalId: '10000000001', representativeId: 'user-1' },
      { name: 'Company 2', nationalId: '10000000002', representativeId: 'user-2' },
    ]),
    pool,
    serviceCatalog,
    proxySecret: PROXY_SECRET,
  })
}

async function createRequest(app: Awaited<ReturnType<typeof createAppUnderTest>>, title: string): Promise<string> {
  const created = await request(app).post('/requests').set(ownerHeaders()).send({ serviceId: '1', title })
  return created.body.request.id as string
}

async function submit(app: Awaited<ReturnType<typeof createAppUnderTest>>, id: string): Promise<void> {
  await request(app).post(`/requests/${id}/submit`).set(ownerHeaders()).expect(200)
}

describe('stats & activities API', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM dashboard.activities')
    await pool.query('DELETE FROM dashboard.letters')
    await pool.query('DELETE FROM dashboard.requests')
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('GET /stats', () => {
    it('computes per-status counts for the owner (draft counts toward total)', async () => {
      const app = await createAppUnderTest()

      await createRequest(app, 'پیش‌نویس') // draft
      const first = await createRequest(app, 'در حال بررسی')
      await submit(app, first)
      const second = await createRequest(app, 'در حال بررسی دوم')
      await submit(app, second)

      const res = await request(app).get('/stats').set(ownerHeaders())
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ total: 3, in_review: 2, approved: 0, action_needed: 0, rejected: 0 })
    })

    it('is owner-scoped', async () => {
      const app = await createAppUnderTest()
      await createRequest(app, 'mine')

      const res = await request(app).get('/stats').set(ownerHeaders())
      expect(res.body.total).toBe(1)

      const other = await request(app)
        .get('/stats')
        .set({ 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': 'someone-else' })
      expect(other.body.total).toBe(0)
    })
  })

  describe('GET /activities and the request timeline', () => {
    it('records the submit transition once and serves it in the timeline', async () => {
      const app = await createAppUnderTest()
      const id = await createRequest(app, 'با تایم‌لاین')
      await submit(app, id)

      const acts = await request(app).get('/activities').set(ownerHeaders())
      expect(acts.status).toBe(200)
      expect(acts.body.total).toBe(1)
      expect(acts.body.items[0]).toMatchObject({
        requestId: id,
        ownerId: OWNER,
        actorId: OWNER,
        type: 'transition',
        action: 'submit',
        reason: null,
        fromState: 'draft',
        toState: 'in_review',
        revision: 2,
      })
      expect(acts.body.items[0].at).toBeTruthy()

      const detail = await request(app).get(`/requests/${id}`).set(ownerHeaders())
      expect(detail.status).toBe(200)
      expect(detail.body.timeline).toHaveLength(1)
      expect(detail.body.timeline[0].id).toBe(acts.body.items[0].id)
      expect(detail.body.timeline[0].action).toBe('submit')
    })

    it('scopes history to the case owner and authorized staff', async () => {
      const app = await createAppUnderTest()
      const id = await createRequest(app, 'خصوصی')
      await submit(app, id)

      const mine = await request(app).get(`/requests/${id}/history`).set(ownerHeaders())
      expect(mine.status).toBe(200)
      expect(mine.body.items).toHaveLength(1)

      const other = await request(app)
        .get(`/requests/${id}/history`)
        .set({ 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': 'someone-else' })
      expect(other.status).toBe(404)
      expect(other.body.error).toBe('not_found')

      const otherActivities = await request(app)
        .get('/activities')
        .set({ 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': 'someone-else' })
      expect(otherActivities.body.total).toBe(0)

      const staff = await request(app)
        .get(`/requests/${id}/history`)
        .set({ 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': 'staff-1' })
      expect(staff.status).toBe(200)
      expect(staff.body.items).toHaveLength(1)
    })

    it('keeps workflow history after the displayed letter is deleted', async () => {
      const app = await createAppUnderTest()
      const id = await createRequest(app, 'با نامه')
      await submit(app, id)

      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO dashboard.letters (type, title, body, recipient_id, request_id)
         VALUES ('official', 'نامه', 'متن نامه', $1, $2) RETURNING id`,
        [OWNER, id],
      )
      const letterId = rows[0]!.id
      await request(app).delete(`/letters/${letterId}`).set(ownerHeaders()).expect(200)

      const history = await request(app).get(`/requests/${id}/history`).set(ownerHeaders())
      expect(history.status).toBe(200)
      expect(history.body.items).toHaveLength(1)
      expect(history.body.items[0].letterId).toBeNull()

      const acts = await request(app).get('/activities').set(ownerHeaders())
      expect(acts.body.total).toBe(1)
    })
  })
})
