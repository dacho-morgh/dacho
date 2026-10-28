import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { RequestRepository } from '../../src/dashboard/request-repo.js'
import { PostgresNotificationOutbox } from '../../src/dashboard/notification-outbox.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://phase0_test:phase0_test_only@127.0.0.1:55439/dacho_phase0_test'
const pool = new Pool({ connectionString, application_name: 't37-notification-consistency' })

const PROXY_SECRET = 'test-internal-proxy-secret'
const OWNER = 'user-1'
const OTHER = 'user-2'
const ADMIN = 'staff-1'

const service: ServiceDefinition = {
  id: '1',
  key: 'financing',
  title: 'تأمین مالی و سرمایه‌گذاری',
  workflow: [{ title: 'بررسی دبیرخانه', role: '1', roleName: 'central-secretariat', order: 0 }],
  formFields: [
    { name: 'company_name', blockType: 'text', label: 'نام شرکت', required: true },
  ],
}

function authHeaders(userId: string, role = 'representative') {
  return {
    'x-internal-proxy-secret': PROXY_SECRET,
    'x-user-id': userId,
    'x-user-roles': role,
  }
}

async function createAppUnderTest(outbox?: PostgresNotificationOutbox) {
  const companyStore = new InMemoryCompanyStore([
    { name: 'شرکت ۱', nationalId: '10000000001', representativeId: OWNER },
    { name: 'شرکت ۲', nationalId: '10000000002', representativeId: OTHER },
  ])
  const serviceCatalog = new InMemoryServiceCatalog()
  serviceCatalog.set(service)
  const jwt = await JwtSigner.create('test-kid')
  const notificationOutbox = outbox ?? new PostgresNotificationOutbox(pool)

  return {
    app: createApp({
      codeStore: new InMemoryCodeStore(),
      delivery: new ConsoleOtpDelivery(),
      jwt,
      userStore: new InMemoryUserStore([
        { id: OWNER, phone: OWNER, roles: ['representative'], isActive: true },
        { id: OTHER, phone: OTHER, roles: ['representative'], isActive: true },
        { id: ADMIN, phone: ADMIN, roles: ['admin'], isActive: true },
      ]),
      companyStore,
      pool,
      serviceCatalog,
      proxySecret: PROXY_SECRET,
      notificationOutbox,
    }),
    outbox: notificationOutbox,
  }
}

describe('T37 — Status transition and notification consistency (Integration)', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM dashboard.notification_jobs')
    await pool.query('DELETE FROM dashboard.letters')
    await pool.query('DELETE FROM dashboard.activities')
    await pool.query('DELETE FROM dashboard.requests')
  })

  afterAll(async () => {
    await pool.end()
  })

  it.each([false, true])('submits and records delivery with one pooled connection (failure=%s)', async (failure) => {
    const oneConnection = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 500 })
    try {
      const outbox = new PostgresNotificationOutbox(oneConnection)
      outbox.setSimulationFailure(failure)
      const repo = new RequestRepository(oneConnection, outbox)
      const draft = await repo.create({
        serviceId: '1', serviceKey: 'financing', serviceName: 'Financing',
        title: 'Single connection', ownerId: OWNER, answers: {},
      })
      expect(await repo.submit(draft.id, OWNER)).toMatchObject({ status: 'in_review' })
      const jobs = await outbox.list({ requestId: draft.id })
      expect(jobs.items).toHaveLength(1)
      expect(jobs.items[0]?.status).toBe(failure ? 'failed' : 'delivered')
      expect(oneConnection.waitingCount).toBe(0)
    } finally {
      await oneConnection.end()
    }
  })

  async function pendingNotification(outbox: PostgresNotificationOutbox) {
    const repo = new RequestRepository(pool, outbox)
    const draft = await repo.create({
      serviceId: '1', serviceKey: 'financing', serviceName: 'Financing',
      title: 'Recovery', ownerId: OWNER, answers: {},
    })
    // Model failure to begin delivery after the business transaction committed.
    const delivery = vi.spyOn(outbox, 'deliver').mockRejectedValueOnce(new Error('worker unavailable'))
    try {
      await repo.submit(draft.id, OWNER)
    } finally {
      delivery.mockRestore()
    }
    const job = (await outbox.list({ requestId: draft.id })).items[0]!
    expect(job.status).toBe('pending')
    return job
  }

  it('bulk retry recovers committed pending jobs without repeating the transition or letter', async () => {
    const outbox = new PostgresNotificationOutbox(pool)
    const job = await pendingNotification(outbox)
    expect(await outbox.retryAllUndelivered()).toEqual([
      expect.objectContaining({ jobId: job.id, status: 'delivered' }),
    ])
    expect(await outbox.retryAllUndelivered()).toEqual([])
    expect((await pool.query('SELECT id FROM dashboard.letters WHERE request_id = $1', [job.requestId])).rows).toHaveLength(1)
    expect((await pool.query('SELECT id FROM dashboard.activities WHERE request_id = $1', [job.requestId])).rows).toHaveLength(1)
  })

  it('never downgrades another worker\'s successful delivery when an older attempt fails', async () => {
    const outbox = new PostgresNotificationOutbox(pool)
    const job = await pendingNotification(outbox)
    const failingPool = {
      connect: async () => {
        const client = await pool.connect()
        return {
          query: async (sql: string, values?: unknown[]) => {
            if (sql.includes('INSERT INTO dashboard.letters')) throw new Error('first worker failed')
            const result = await client.query(sql, values)
            if (sql === 'ROLLBACK') {
              // The lock is released: another worker completes delivery before failure logging.
              expect(await outbox.deliver(job.id)).toMatchObject({ status: 'delivered' })
            }
            return result
          },
          release: () => client.release(),
        }
      },
      query: pool.query.bind(pool),
    } as unknown as Pool
    expect(await new PostgresNotificationOutbox(failingPool).deliver(job.id)).toMatchObject({ status: 'failed' })
    expect((await outbox.findById(job.id))?.status).toBe('delivered')
    expect(await outbox.retry(job.id)).toMatchObject({ alreadyDelivered: true })
    expect((await pool.query('SELECT id FROM dashboard.letters WHERE request_id = $1', [job.requestId])).rows).toHaveLength(1)
  })

  it('criterion 1: notification delivery failure does not lose the recorded transition', async () => {
    const { app, outbox } = await createAppUnderTest()

    // 1. Create a draft request
    const created = await request(app)
      .post('/requests')
      .set(authHeaders(OWNER))
      .send({ serviceId: '1', title: 'درخواست نوآوری', answers: { company_name: 'آینده' } })
      .expect(201)
    const requestId = created.body.request.id as string

    // 2. Enable controlled notification failure
    outbox.setSimulationFailure(true)

    // 3. Submit request -> should succeed despite notification delivery failure!
    const submitRes = await request(app)
      .post(`/requests/${requestId}/submit`)
      .set(authHeaders(OWNER))
      .expect(200)

    expect(submitRes.body.request.status).toBe('in_review')

    // Verify request persisted in DB with status in_review and revision 2
    const reqRow = await pool.query<{ status: string; revision: number }>(
      'SELECT status, revision FROM dashboard.requests WHERE id = $1',
      [requestId],
    )
    expect(reqRow.rows[0]?.status).toBe('in_review')
    expect(reqRow.rows[0]?.revision).toBe(2)

    // Verify transition history row recorded
    const actRows = await pool.query<{ action: string; from_state: string; to_state: string; revision: number }>(
      'SELECT action, from_state, to_state, revision FROM dashboard.activities WHERE request_id = $1',
      [requestId],
    )
    expect(actRows.rows).toHaveLength(1)
    expect(actRows.rows[0]).toMatchObject({
      action: 'submit',
      from_state: 'draft',
      to_state: 'in_review',
      revision: 2,
    })

    // Verify outbox recorded the job as 'failed' with error details (not lost!)
    const jobRows = await pool.query<{ status: string; attempts: number; last_error: string }>(
      'SELECT status, attempts, last_error FROM dashboard.notification_jobs WHERE request_id = $1',
      [requestId],
    )
    expect(jobRows.rows).toHaveLength(1)
    expect(jobRows.rows[0]?.status).toBe('failed')
    expect(jobRows.rows[0]?.attempts).toBe(1)
    expect(jobRows.rows[0]?.last_error).toContain('Controlled notification failure')

    // Verify no letter was created yet for recipient
    const letterRows = await pool.query('SELECT COUNT(*)::int AS count FROM dashboard.letters WHERE request_id = $1', [requestId])
    expect(letterRows.rows[0]?.count).toBe(0)
  })

  it('criterion 2: retrying notification delivery does not create duplicate transition or action', async () => {
    const { app, outbox } = await createAppUnderTest()

    const created = await request(app)
      .post('/requests')
      .set(authHeaders(OWNER))
      .send({ serviceId: '1', title: 'درخواست دوم', answers: { company_name: 'امید' } })
      .expect(201)
    const requestId = created.body.request.id as string

    // Fail delivery on submit
    outbox.setSimulationFailure(true)
    await request(app).post(`/requests/${requestId}/submit`).set(authHeaders(OWNER)).expect(200)

    // Find the failed notification job
    const jobRes = await pool.query<{ id: string }>('SELECT id FROM dashboard.notification_jobs WHERE request_id = $1', [requestId])
    const jobId = jobRes.rows[0]!.id

    // Disable failure simulation and perform operator retry
    outbox.setSimulationFailure(false)
    const retryRes = await request(app)
      .post(`/admin/notifications/jobs/${jobId}/retry`)
      .set(authHeaders(ADMIN, 'system-owner'))
      .expect(200)

    expect(retryRes.body.result.status).toBe('delivered')

    // 1. Notification letter delivered to recipient
    const recipientLetters = await request(app).get('/letters').set(authHeaders(OWNER)).expect(200)
    expect(recipientLetters.body.items).toHaveLength(1)
    expect(recipientLetters.body.items[0]).toMatchObject({
      type: 'notification',
      requestId,
      recipientId: OWNER,
      title: 'ارسال درخواست',
    })

    // 2. Request status and revision remain unchanged (NO duplicate transition!)
    const reqRow = await pool.query<{ status: string; revision: number }>(
      'SELECT status, revision FROM dashboard.requests WHERE id = $1',
      [requestId],
    )
    expect(reqRow.rows[0]?.status).toBe('in_review')
    expect(reqRow.rows[0]?.revision).toBe(2)

    // 3. Exactly 1 transition in history (NO duplicate transition!)
    const actRows = await pool.query('SELECT COUNT(*)::int AS count FROM dashboard.activities WHERE request_id = $1', [requestId])
    expect(actRows.rows[0]?.count).toBe(1)

    // 4. Repeated retry is idempotent: does not create another letter
    const secondRetry = await request(app)
      .post(`/admin/notifications/jobs/${jobId}/retry`)
      .set(authHeaders(ADMIN, 'system-owner'))
      .expect(200)
    expect(secondRetry.body.result.alreadyDelivered).toBe(true)

    const lettersCount = await pool.query('SELECT COUNT(*)::int AS count FROM dashboard.letters WHERE request_id = $1', [requestId])
    expect(lettersCount.rows[0]?.count).toBe(1)

    // 5. Calling submit again returns 409 already_submitted
    await request(app).post(`/requests/${requestId}/submit`).set(authHeaders(OWNER)).expect(409)
    const jobsCount = await pool.query('SELECT COUNT(*)::int AS count FROM dashboard.notification_jobs WHERE request_id = $1', [requestId])
    expect(jobsCount.rows[0]?.count).toBe(1)
  })

  it('criterion 3: transaction error rolls back completely and leaves no partial case', async () => {
    const { app } = await createAppUnderTest()

    const created = await request(app)
      .post('/requests')
      .set(authHeaders(OWNER))
      .send({ serviceId: '1', title: 'درخواست شکست تراکنش', answers: { company_name: 'آرمان' } })
      .expect(201)
    const requestId = created.body.request.id as string

    const repo = new RequestRepository(pool)

    // Force a failure during the atomic transaction on notification_jobs insert
    await pool.query('DROP TRIGGER IF EXISTS t37_fail_outbox ON dashboard.notification_jobs')
    await pool.query('DROP FUNCTION IF EXISTS dashboard.t37_fail_outbox()')
    await pool.query(`CREATE FUNCTION dashboard.t37_fail_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'forced atomic outbox insert failure'; END $$`)
    await pool.query(`CREATE TRIGGER t37_fail_outbox BEFORE INSERT ON dashboard.notification_jobs
      FOR EACH ROW EXECUTE FUNCTION dashboard.t37_fail_outbox()`)

    try {
      await expect(
        repo.submit(requestId, OWNER, undefined, created.body.request.companyId),
      ).rejects.toThrow('forced atomic outbox insert failure')
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS t37_fail_outbox ON dashboard.notification_jobs')
      await pool.query('DROP FUNCTION IF EXISTS dashboard.t37_fail_outbox()')
    }

    // Verify complete rollback:
    // Request is still draft, revision is still 1
    const req = await repo.findById(requestId, OWNER)
    expect(req?.status).toBe('draft')
    const reqDb = await pool.query<{ revision: number }>('SELECT revision FROM dashboard.requests WHERE id = $1', [requestId])
    expect(reqDb.rows[0]?.revision).toBe(1)

    // No activity row
    const actCount = await pool.query('SELECT COUNT(*)::int AS count FROM dashboard.activities WHERE request_id = $1', [requestId])
    expect(actCount.rows[0]?.count).toBe(0)

    // No notification job row
    const jobCount = await pool.query('SELECT COUNT(*)::int AS count FROM dashboard.notification_jobs WHERE request_id = $1', [requestId])
    expect(jobCount.rows[0]?.count).toBe(0)

    // No letters
    const letterCount = await pool.query('SELECT COUNT(*)::int AS count FROM dashboard.letters WHERE request_id = $1', [requestId])
    expect(letterCount.rows[0]?.count).toBe(0)

    // Clean submit now succeeds
    await request(app).post(`/requests/${requestId}/submit`).set(authHeaders(OWNER)).expect(200)
    expect((await repo.findById(requestId, OWNER))?.status).toBe('in_review')
  })

  it('criterion 4: transition history and notification job are consistent with state transition', async () => {
    const { app } = await createAppUnderTest()

    const created = await request(app)
      .post('/requests')
      .set(authHeaders(OWNER))
      .send({ serviceId: '1', title: 'درخواست سازگار', answers: { company_name: 'آرمان' } })
      .expect(201)
    const requestId = created.body.request.id as string

    await request(app).post(`/requests/${requestId}/submit`).set(authHeaders(OWNER)).expect(200)

    const actRow = (await pool.query<{
      actor_id: string
      action: string
      from_state: string
      to_state: string
      revision: number
    }>('SELECT actor_id, action, from_state, to_state, revision FROM dashboard.activities WHERE request_id = $1', [requestId])).rows[0]

    const jobRow = (await pool.query<{
      actor_id: string
      action: string
      from_state: string
      to_state: string
      revision: number
      recipient_id: string
      status: string
    }>('SELECT actor_id, action, from_state, to_state, revision, recipient_id, status FROM dashboard.notification_jobs WHERE request_id = $1', [requestId])).rows[0]

    expect(actRow).toBeDefined()
    expect(jobRow).toBeDefined()

    // History and notification job perfectly agree on actor, action, states, and revision
    expect(jobRow?.actor_id).toBe(actRow?.actor_id)
    expect(jobRow?.action).toBe(actRow?.action)
    expect(jobRow?.from_state).toBe(actRow?.from_state)
    expect(jobRow?.to_state).toBe(actRow?.to_state)
    expect(jobRow?.revision).toBe(actRow?.revision)
    expect(jobRow?.recipient_id).toBe(OWNER)
    expect(jobRow?.status).toBe('delivered')
  })

  it('UAT28: deleting a displayed letter leaves workflow history intact', async () => {
    const { app } = await createAppUnderTest()

    const created = await request(app)
      .post('/requests')
      .set(authHeaders(OWNER))
      .send({ serviceId: '1', title: 'درخواست نامه', answers: { company_name: 'آرمان' } })
      .expect(201)
    const requestId = created.body.request.id as string

    await request(app).post(`/requests/${requestId}/submit`).set(authHeaders(OWNER)).expect(200)

    // Get letter ID
    const listRes = await request(app).get('/letters').set(authHeaders(OWNER)).expect(200)
    const letterId = listRes.body.items[0]?.id as string
    expect(letterId).toBeDefined()

    // Delete displayed letter
    await request(app).delete(`/letters/${letterId}`).set(authHeaders(OWNER)).expect(200)

    // Letter is gone from inbox
    const afterDelete = await request(app).get('/letters').set(authHeaders(OWNER)).expect(200)
    expect(afterDelete.body.items).toHaveLength(0)

    // Workflow history in activities is still 100% intact!
    const actRows = await pool.query('SELECT action, revision FROM dashboard.activities WHERE request_id = $1', [requestId])
    expect(actRows.rows).toHaveLength(1)
    expect(actRows.rows[0]?.action).toBe('submit')
    expect(actRows.rows[0]?.revision).toBe(2)

    // Notification job in outbox is still intact!
    const jobRows = await pool.query('SELECT status FROM dashboard.notification_jobs WHERE request_id = $1', [requestId])
    expect(jobRows.rows).toHaveLength(1)
    expect(jobRows.rows[0]?.status).toBe('delivered')
  })

  it('operator notification jobs listing and retry-all', async () => {
    const { app, outbox } = await createAppUnderTest()

    // Representative cannot access admin notification routes
    await request(app).get('/admin/notifications/jobs').set(authHeaders(OWNER)).expect(403)
    await request(app).post('/admin/notifications/retry-all').set(authHeaders(OWNER)).expect(403)

    // Fail two submits
    outbox.setSimulationFailure(true)

    const c1 = await request(app).post('/requests').set(authHeaders(OWNER)).send({ serviceId: '1', title: 'درخواست الف', answers: { company_name: 'شرکت الف' } }).expect(201)
    const c2 = await request(app).post('/requests').set(authHeaders(OTHER)).send({ serviceId: '1', title: 'درخواست ب', answers: { company_name: 'شرکت ب' } }).expect(201)

    await request(app).post(`/requests/${c1.body.request.id}/submit`).set(authHeaders(OWNER)).expect(200)
    await request(app).post(`/requests/${c2.body.request.id}/submit`).set(authHeaders(OTHER)).expect(200)

    // Admin lists failed jobs
    const listRes = await request(app)
      .get('/admin/notifications/jobs?status=failed')
      .set(authHeaders(ADMIN, 'central-secretariat'))
      .expect(200)

    expect(listRes.body.total).toBe(2)
    expect(listRes.body.items).toHaveLength(2)

    // Turn off failure simulation and retry-all
    outbox.setSimulationFailure(false)
    const retryAllRes = await request(app)
      .post('/admin/notifications/retry-all')
      .set(authHeaders(ADMIN, 'system-owner'))
      .expect(200)

    expect(retryAllRes.body.results).toHaveLength(2)
    expect(retryAllRes.body.results.every((r: any) => r.status === 'delivered')).toBe(true)

    // Verify 0 failed jobs remain
    const afterRetry = await request(app)
      .get('/admin/notifications/jobs?status=failed')
      .set(authHeaders(ADMIN, 'system-owner'))
      .expect(200)
    expect(afterRetry.body.total).toBe(0)
  })
})
