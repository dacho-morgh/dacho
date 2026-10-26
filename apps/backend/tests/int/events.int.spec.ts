import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore, type User } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { EventRepository } from '../../src/dashboard/event-repo.js'
import { runMigrations } from '../../src/db/migrate.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 'events-integration' })
const PROXY_SECRET = 'test-internal-proxy-secret'

const USERS: User[] = [
  { id: 'owner-1', phone: 'owner-1', name: 'Owner', operationalRole: 'system-owner', isActive: true },
  { id: 'chief-1', phone: 'chief-1', name: 'Chief One', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'chief-2', phone: 'chief-2', name: 'Chief Two', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment-1', phone: 'investment-1', name: 'Investment One', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'investment-2', phone: 'investment-2', name: 'Investment Two', operationalRole: 'investment-reviewer', isActive: true },
]

function authHeaders(userId: string) {
  return { 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': userId }
}

async function createAppUnderTest() {
  const jwt = await JwtSigner.create('test-kid')
  return createApp({
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    jwt,
    userStore: new InMemoryUserStore(USERS),
    companyStore: new InMemoryCompanyStore(),
    pool,
    serviceCatalog: new InMemoryServiceCatalog(),
    proxySecret: PROXY_SECRET,
  })
}

function eventPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'رویداد سرمایه‌گذاری',
    description: 'فرصت سرمایه‌گذاری',
    registrationOpenAt: '2027-01-01T00:00:00.000Z',
    registrationCloseAt: '2027-02-01T00:00:00.000Z',
    responsibleChiefId: 'chief-1',
    responsibleInvestmentId: 'investment-1',
    ...overrides,
  }
}

describe('events API', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM dashboard.events')
  })

  afterAll(async () => {
    await pool.end()
  })

  it('persists an event and its assignments across app instances', async () => {
    const app = await createAppUnderTest()
    const created = await request(app)
      .post('/admin/events')
      .set(authHeaders('owner-1'))
      .send(eventPayload())
    expect(created.status).toBe(201)
    const eventId = created.body.event.id as string

    const { rows } = await pool.query(
      `SELECT responsible_chief_id, responsible_investment_id
       FROM dashboard.events WHERE id = $1`,
      [eventId],
    )
    expect(rows[0]).toEqual({
      responsible_chief_id: 'chief-1',
      responsible_investment_id: 'investment-1',
    })

    const restartedApp = await createAppUnderTest()
    const reloaded = await request(restartedApp)
      .get(`/admin/events/${eventId}`)
      .set(authHeaders('chief-1'))
    expect(reloaded.status).toBe(200)
    expect(reloaded.body.event).toMatchObject({
      title: 'رویداد سرمایه‌گذاری',
      responsibleChiefId: 'chief-1',
      responsibleInvestmentId: 'investment-1',
      allowedActions: ['read'],
    })
  })

  it('keeps event responsibility isolated across events', async () => {
    const app = await createAppUnderTest()
    const first = await request(app)
      .post('/admin/events')
      .set(authHeaders('owner-1'))
      .send(eventPayload({ title: 'رویداد اول' }))
    const second = await request(app)
      .post('/admin/events')
      .set(authHeaders('owner-1'))
      .send(eventPayload({
        title: 'رویداد دوم',
        responsibleChiefId: 'chief-2',
        responsibleInvestmentId: 'investment-2',
      }))
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    const firstId = first.body.event.id as string
    const secondId = second.body.event.id as string

    const list = await request(app).get('/admin/events').set(authHeaders('chief-1'))
    expect(list.status).toBe(200)
    expect(list.body.items.map((event: { id: string }) => event.id)).toEqual([firstId])
    expect((await request(app).get(`/admin/events/${secondId}`).set(authHeaders('chief-1'))).status).toBe(404)
    expect((await request(app).get(`/admin/events/${firstId}`).set(authHeaders('chief-2'))).status).toBe(404)
  })

  it('records reassignment history atomically and survives a reload', async () => {
    const app = await createAppUnderTest()
    const created = await request(app)
      .post('/admin/events')
      .set(authHeaders('owner-1'))
      .send(eventPayload())
    expect(created.status).toBe(201)
    const eventId = created.body.event.id as string

    const reassigned = await request(app)
      .patch(`/admin/events/${eventId}`)
      .set(authHeaders('owner-1'))
      .send({
        responsibleChiefId: 'chief-2',
        responsibleInvestmentId: 'investment-2',
        revision: 1,
        reason: 'Replace the event team',
      })
    expect(reassigned.status).toBe(200)
    expect(reassigned.body.event).toMatchObject({
      responsibleChiefId: 'chief-2',
      responsibleInvestmentId: 'investment-2',
      revision: 2,
    })

    const restartedApp = await createAppUnderTest()
    const reloaded = await request(restartedApp)
      .get(`/admin/events/${eventId}`)
      .set(authHeaders('chief-2'))
    expect(reloaded.status).toBe(200)
    expect(reloaded.body.event).toMatchObject({
      responsibleChiefId: 'chief-2',
      responsibleInvestmentId: 'investment-2',
      revision: 2,
    })

    const history = await new EventRepository(pool).listAudit(eventId)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      eventId,
      revision: 2,
      actorId: 'owner-1',
      reason: 'Replace the event team',
    })
    expect(history[0]?.changedFields).toEqual(
      expect.arrayContaining(['responsibleChiefId', 'responsibleInvestmentId']),
    )
    expect(history[0]?.before).toMatchObject({
      responsibleChiefId: 'chief-1',
      responsibleInvestmentId: 'investment-1',
      revision: 1,
    })
    expect(history[0]?.after).toMatchObject({
      responsibleChiefId: 'chief-2',
      responsibleInvestmentId: 'investment-2',
      revision: 2,
    })
  })

  it('rejects a stale concurrent edit instead of restoring a revoked assignment', async () => {
    const app = await createAppUnderTest()
    const created = await request(app)
      .post('/admin/events')
      .set(authHeaders('owner-1'))
      .send(eventPayload())
    expect(created.status).toBe(201)
    const eventId = created.body.event.id as string

    const [reassignment, edit] = await Promise.all([
      request(app)
        .patch(`/admin/events/${eventId}`)
        .set(authHeaders('owner-1'))
        .send({
          responsibleChiefId: 'chief-2',
          responsibleInvestmentId: 'investment-2',
          revision: 1,
          reason: 'Reassign the event',
        }),
      request(app)
        .patch(`/admin/events/${eventId}`)
        .set(authHeaders('owner-1'))
        .send({
          title: 'ویرایش هم‌زمان',
          revision: 1,
          reason: 'Edit the title',
        }),
    ])

    expect([reassignment.status, edit.status].sort()).toEqual([200, 409])
    const reassignmentWon = reassignment.status === 200
    const rejected = reassignmentWon ? edit : reassignment
    expect(rejected.body).toEqual({ error: 'stale_event', revision: 2 })

    const final = await request(app)
      .get(`/admin/events/${eventId}`)
      .set(authHeaders('owner-1'))
    expect(final.status).toBe(200)
    expect(final.body.event.revision).toBe(2)
    expect(final.body.event.responsibleChiefId).toBe(reassignmentWon ? 'chief-2' : 'chief-1')
    expect(final.body.event.responsibleInvestmentId).toBe(
      reassignmentWon ? 'investment-2' : 'investment-1',
    )
    expect(final.body.event.title).toBe(
      reassignmentWon ? 'رویداد سرمایه‌گذاری' : 'ویرایش هم‌زمان',
    )

    const { rows } = await pool.query(
      `SELECT revision, actor_id, changed_fields, before_state, after_state
       FROM dashboard.event_audit WHERE event_id = $1 ORDER BY revision`,
      [eventId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      revision: 2,
      actor_id: 'owner-1',
      changed_fields: reassignmentWon
        ? expect.arrayContaining(['responsibleChiefId', 'responsibleInvestmentId'])
        : ['title'],
    })
    expect(rows[0].before_state.responsibleChiefId).toBe('chief-1')
    expect(rows[0].after_state.responsibleChiefId).toBe(
      reassignmentWon ? 'chief-2' : 'chief-1',
    )
  })
})
