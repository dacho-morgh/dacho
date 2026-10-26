import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore, type User } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
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
})
