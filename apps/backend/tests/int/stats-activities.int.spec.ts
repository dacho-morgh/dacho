import { seedVerifiedCompanies, clearVerifiedCompanies } from './verified-company-fixtures.js'
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
import {
  COMPANY_REQUEST_PHASES,
  PHASE_BY_REVIEW_STAGE,
  PHASE_BY_STATUS,
  companyRequestPhase,
  type CompanyRequestPhase,
} from '../../src/dashboard/company-request-phase.js'

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
  const companyStore = new InMemoryCompanyStore([
    { name: 'Company 1', nationalId: '10000000001', representativeId: 'user-1' },
    { name: 'Company 2', nationalId: '10000000002', representativeId: 'user-2' },
  ])
  await seedVerifiedCompanies(pool, companyStore)
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
    companyStore,
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
    await clearVerifiedCompanies(pool)
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
      expect(res.body).toEqual({
        total: 3,
        in_review: 2,
        approved: 0,
        action_needed: 0,
        rejected: 0,
        // A submitted request with no review stage reads as in review for the company (#280).
        phases: { verification: 1, reviewing: 2, finished: 0 },
      })
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

  describe('company phase filter and counts (#280)', () => {
    const headersOf = (id: string) => ({ 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': id })
    const STATUSES = Object.keys(PHASE_BY_STATUS)
    const STAGES = [...Object.keys(PHASE_BY_REVIEW_STAGE), null]

    /** One request per status × review stage for `owner`, stored directly in that state. */
    async function seedEveryCombination(app: Awaited<ReturnType<typeof createAppUnderTest>>, owner: string) {
      const rows: { id: string; phase: CompanyRequestPhase }[] = []
      for (const status of STATUSES) {
        for (const reviewStage of STAGES) {
          const created = await request(app)
            .post('/requests')
            .set(headersOf(owner))
            .send({ serviceId: '1', title: `${status} ${reviewStage ?? 'none'}` })
            .expect(201)
          const id = created.body.request.id as string
          await pool.query('UPDATE dashboard.requests SET status = $2, review_stage = $3 WHERE id = $1', [id, status, reviewStage])
          rows.push({ id, phase: companyRequestPhase({ status, reviewStage }) })
        }
      }
      return rows
    }

    async function listAll(app: Awaited<ReturnType<typeof createAppUnderTest>>, user: string, query: string) {
      const first = await request(app).get(`/requests?limit=4&page=1&${query}`).set(headersOf(user)).expect(200)
      const ids: string[] = first.body.items.map((item: { id: string }) => item.id)
      for (let page = 2; page <= first.body.totalPages; page += 1) {
        const next = await request(app).get(`/requests?limit=4&page=${page}&${query}`).set(headersOf(user)).expect(200)
        ids.push(...next.body.items.map((item: { id: string }) => item.id))
      }
      return { total: first.body.total as number, totalPages: first.body.totalPages as number, ids }
    }

    it('lists, pages and counts a company’s own requests by phase with the shared mapping', async () => {
      const app = await createAppUnderTest()
      const mine = await seedEveryCombination(app, 'user-1')
      const theirs = await seedEveryCombination(app, 'user-2')
      expect(mine).toHaveLength(20)

      const expected = { verification: 6, reviewing: 6, finished: 8 }
      for (const phase of COMPANY_REQUEST_PHASES) {
        expect(mine.filter((row) => row.phase === phase)).toHaveLength(expected[phase])
        const listed = await listAll(app, 'user-1', `phase=${phase}`)
        expect(listed.total).toBe(expected[phase])
        expect(listed.totalPages).toBe(Math.ceil(expected[phase] / 4))
        expect(new Set(listed.ids)).toEqual(new Set(mine.filter((row) => row.phase === phase).map((row) => row.id)))
        // Each item reads in the phase it was listed under, by the frontend's own rule too.
        const page = await request(app).get(`/requests?limit=50&phase=${phase}`).set(headersOf('user-1')).expect(200)
        for (const item of page.body.items) expect(companyRequestPhase(item)).toBe(phase)
      }

      const stats = await request(app).get('/stats').set(headersOf('user-1')).expect(200)
      expect(stats.body).toMatchObject({ total: 20, phases: expected })

      // `phase` narrows the counts exactly as it narrows the list.
      const finished = await request(app).get('/stats?phase=finished').set(headersOf('user-1')).expect(200)
      expect(finished.body).toEqual({
        total: 8,
        in_review: 0,
        approved: 4,
        action_needed: 0,
        rejected: 4,
        phases: { verification: 0, reviewing: 0, finished: 8 },
      })

      // Another company never sees the first one's rows, with or without a phase.
      const other = await listAll(app, 'user-2', 'phase=finished')
      expect(new Set(other.ids)).toEqual(new Set(theirs.filter((row) => row.phase === 'finished').map((row) => row.id)))
      expect((await request(app).get('/stats').set(headersOf('user-2'))).body.phases).toEqual(expected)
      expect((await request(app).get('/stats').set(headersOf('someone-else'))).body).toMatchObject({
        total: 0,
        phases: { verification: 0, reviewing: 0, finished: 0 },
      })

      // Staff keep their whole scope, and `phase` is only an extra narrowing for them.
      expect((await request(app).get('/requests').set(headersOf('staff-1'))).body.total).toBe(40)
      expect((await request(app).get('/requests?phase=reviewing').set(headersOf('staff-1'))).body.total).toBe(12)
      expect((await request(app).get('/admin/requests?phase=verification').set(headersOf('staff-1'))).body.total).toBe(12)
      expect((await request(app).get('/stats').set(headersOf('staff-1'))).body).toMatchObject({
        total: 40,
        phases: { verification: 12, reviewing: 12, finished: 16 },
      })
    })

    it('refuses an unknown phase on the list and the counts', async () => {
      const app = await createAppUnderTest()
      for (const path of ['/requests', '/stats', '/admin/requests']) {
        for (const value of ['done', '', 'chief_triage']) {
          const res = await request(app).get(`${path}?phase=${value}`).set(headersOf(path === '/admin/requests' ? 'staff-1' : 'user-1'))
          expect(res.status).toBe(400)
          expect(res.body).toEqual({ error: 'invalid_phase' })
        }
      }
      const repeated = await request(app).get('/requests?phase=finished&phase=reviewing').set(headersOf('user-1'))
      expect(repeated.status).toBe(400)
      expect(repeated.body).toEqual({ error: 'invalid_phase' })
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
