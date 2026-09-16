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

// Slice 6 — stats (SQL aggregates) + activities reads (event log), and wiring the
// request-detail timeline to the activities table (replacing the slice-3 stub).

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString })

const PROXY_SECRET = 'test-internal-proxy-secret'
const OWNER = 'user-1'
const STAFF = 'staff-1'

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
    'x-user-role': 'applicant',
  }
}

function staffHeaders(role: string) {
  return {
    'x-internal-proxy-secret': PROXY_SECRET,
    'x-user-id': STAFF,
    'x-user-role': 'staff',
    'x-user-roles': role,
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
      const inReview = await createRequest(app, 'در حال بررسی')
      await submit(app, inReview)
      const rejected = await createRequest(app, 'رد شده')
      await submit(app, rejected)
      await request(app).post(`/requests/${rejected}/transition`).set(staffHeaders('10')).send({ transition: 'reject' })

      const res = await request(app).get('/stats').set(ownerHeaders())
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ total: 3, in_review: 1, approved: 0, action_needed: 0, rejected: 1 })
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
    it('records a transition activity and surfaces it in the request timeline', async () => {
      const app = await createAppUnderTest()
      const id = await createRequest(app, 'با تایم‌لاین')
      await submit(app, id)
      await request(app).post(`/requests/${id}/transition`).set(staffHeaders('10')).send({ transition: 'forward' })

      const acts = await request(app).get('/activities').set(ownerHeaders())
      expect(acts.status).toBe(200)
      expect(acts.body.total).toBe(1)
      expect(acts.body.items[0].type).toBe('transition')
      expect(acts.body.items[0].title).toBe('انتقال به مرحله بعد')

      const detail = await request(app).get(`/requests/${id}`).set(ownerHeaders())
      expect(detail.status).toBe(200)
      expect(detail.body.timeline).toHaveLength(1)
      expect(detail.body.timeline[0].type).toBe('transition')
      expect(detail.body.timeline[0].requestId).toBe(id)
    })
  })
})
