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

// Slice 5 — workflow engine + POST /requests/:id/transition. Role-gated
// transitions with atomic side effects (request state, auto-letters, activity
// log). Asserted through the public HTTP API only.

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
    { title: 'تایید نهایی', role: '12', roleName: 'مدیر', order: 2 },
  ],
  formFields: [],
}

function ownerHeaders() {
  return { 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': OWNER }
}

function staffHeaders(roles: string[] = [], cmsRole?: string) {
  return {
    'x-internal-proxy-secret': PROXY_SECRET,
    'x-user-id': STAFF,
    ...(roles.length > 0 ? { 'x-user-roles': roles.join(',') } : {}),
    ...(cmsRole ? { 'x-user-cms-role': cmsRole } : {}),
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

async function createSubmittedRequest(app: Awaited<ReturnType<typeof createAppUnderTest>>): Promise<string> {
  const created = await request(app)
    .post('/requests')
    .set(ownerHeaders())
    .send({ serviceId: '1', title: 'درخواست' })
  const id = created.body.request.id as string
  const submitted = await request(app).post(`/requests/${id}/submit`).set(ownerHeaders())
  expect(submitted.status).toBe(200)
  return id
}

describe('workflow transition API', () => {
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

  it('forward advances to the next step and denormalizes the assigned role', async () => {
    const app = await createAppUnderTest()
    const id = await createSubmittedRequest(app)

    const res = await request(app)
      .post(`/requests/${id}/transition`)
      .set(staffHeaders(['10']))
      .send({ transition: 'forward' })

    expect(res.status).toBe(200)
    expect(res.body.request.status).toBe('in_review')
    expect(res.body.request.currentStepIndex).toBe(1)
    expect(res.body.request.assignedRole).toBe('داور فنی')
    expect(res.body.request.currentStep).toBe('داوری تخصصی')
  })

  it('forward on the last step approves the request and emits an approval letter', async () => {
    const app = await createAppUnderTest()
    const id = await createSubmittedRequest(app)

    await request(app).post(`/requests/${id}/transition`).set(staffHeaders(['10'])).send({ transition: 'forward' })
    await request(app).post(`/requests/${id}/transition`).set(staffHeaders(['11'])).send({ transition: 'forward' })
    const res = await request(app)
      .post(`/requests/${id}/transition`)
      .set(staffHeaders(['12']))
      .send({ transition: 'forward' })

    expect(res.status).toBe(200)
    expect(res.body.request.status).toBe('approved')

    const letters = await request(app).get('/letters').set(ownerHeaders())
    expect(letters.body.total).toBe(1)
    expect(letters.body.items[0].type).toBe('approved')
    expect(letters.body.items[0].title).toBe('تایید درخواست')
  })

  it('return-to-company sets action_needed and emits a needs_fix letter', async () => {
    const app = await createAppUnderTest()
    const id = await createSubmittedRequest(app)

    const res = await request(app)
      .post(`/requests/${id}/transition`)
      .set(staffHeaders(['10']))
      .send({ transition: 'return-to-company' })

    expect(res.status).toBe(200)
    expect(res.body.request.status).toBe('action_needed')
    expect(res.body.request.currentStepIndex).toBe(0)
    expect(res.body.request.assignedRole).toBeNull()

    const letters = await request(app).get('/letters').set(ownerHeaders())
    expect(letters.body.total).toBe(1)
    expect(letters.body.items[0].type).toBe('needs_fix')
    expect(letters.body.items[0].title).toBe('نیاز به اصلاح')
  })

  it('return-to-previous steps back without emitting a letter', async () => {
    const app = await createAppUnderTest()
    const id = await createSubmittedRequest(app)
    await request(app).post(`/requests/${id}/transition`).set(staffHeaders(['10'])).send({ transition: 'forward' })

    const res = await request(app)
      .post(`/requests/${id}/transition`)
      .set(staffHeaders(['11']))
      .send({ transition: 'return-to-previous' })

    expect(res.status).toBe(200)
    expect(res.body.request.currentStepIndex).toBe(0)
    expect(res.body.request.status).toBe('in_review')

    const letters = await request(app).get('/letters').set(ownerHeaders())
    expect(letters.body.total).toBe(0)
  })

  it('reject terminates the request and emits a rejection letter', async () => {
    const app = await createAppUnderTest()
    const id = await createSubmittedRequest(app)

    const res = await request(app)
      .post(`/requests/${id}/transition`)
      .set(staffHeaders(['10']))
      .send({ transition: 'reject' })

    expect(res.status).toBe(200)
    expect(res.body.request.status).toBe('rejected')

    const letters = await request(app).get('/letters').set(ownerHeaders())
    expect(letters.body.total).toBe(1)
    expect(letters.body.items[0].type).toBe('rejected')
    expect(letters.body.items[0].title).toBe('رد درخواست')
  })

  it('rejects a transition when the actor lacks the current step role', async () => {
    const app = await createAppUnderTest()
    const id = await createSubmittedRequest(app)

    const res = await request(app)
      .post(`/requests/${id}/transition`)
      .set(staffHeaders(['99']))
      .send({ transition: 'forward' })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('forbidden')
  })

  it('lets a cmsRole admin override the role gate', async () => {
    const app = await createAppUnderTest()
    const id = await createSubmittedRequest(app)

    const res = await request(app)
      .post(`/requests/${id}/transition`)
      .set(staffHeaders([], 'admin'))
      .send({ transition: 'forward' })

    expect(res.status).toBe(200)
    expect(res.body.request.currentStepIndex).toBe(1)
  })

  it('rejects return-to-previous when already at the first step', async () => {
    const app = await createAppUnderTest()
    const id = await createSubmittedRequest(app)

    const res = await request(app)
      .post(`/requests/${id}/transition`)
      .set(staffHeaders(['10']))
      .send({ transition: 'return-to-previous' })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('invalid_transition')
  })

  it('rejects a transition on a request that is not in_review', async () => {
    const app = await createAppUnderTest()
    const created = await request(app)
      .post('/requests')
      .set(ownerHeaders())
      .send({ serviceId: '1', title: 'پیش‌نویس' })
    const id = created.body.request.id as string

    const res = await request(app)
      .post(`/requests/${id}/transition`)
      .set(staffHeaders(['10']))
      .send({ transition: 'forward' })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('invalid_state')
  })
})
