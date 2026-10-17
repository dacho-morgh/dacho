import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { createApp } from '../../src/app.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString })
const proxySecret = 'test-internal-proxy-secret'

/** `applicant` is the company side (representative); `staff` is the internal side (admin). */
function auth(userId: string, role: 'applicant' | 'staff') {
  const roles = role === 'staff' ? 'admin' : 'representative'
  return { 'x-internal-proxy-secret': proxySecret, 'x-user-id': userId, 'x-user-roles': roles }
}

async function appUnderTest() {
  return createApp({
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    jwt: await JwtSigner.create('test-kid'),
    userStore: new InMemoryUserStore(),
    companyStore: new InMemoryCompanyStore(),
    pool,
    serviceCatalog: new InMemoryServiceCatalog(),
    proxySecret,
  })
}

class FailingLookupUserStore extends InMemoryUserStore {
  override async findById(): Promise<undefined> {
    throw new Error('Payload API error: HTTP 500')
  }
}

async function appWithFailingUserLookup() {
  return createApp({
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    jwt: await JwtSigner.create('test-kid'),
    userStore: new FailingLookupUserStore(),
    companyStore: new InMemoryCompanyStore(),
    pool,
    serviceCatalog: new InMemoryServiceCatalog(),
    proxySecret,
  })
}

describe('support conversations', () => {
  beforeAll(async () => runMigrations(connectionString))
  beforeEach(async () => pool.query('DELETE FROM dashboard.support_tickets'))
  afterAll(async () => pool.end())

  it('allows the requester and staff to reply to each other', async () => {
    const app = await appUnderTest()
    const created = await request(app).post('/support').set(auth('company-1', 'applicant')).send({ subject: 'کمک', message: 'پیام اول' })
    const id = created.body.ticket.id as string

    const beforeLetters = await pool.query<{ count: string }>('SELECT COUNT(*) FROM dashboard.letters')

    const staffReply = await request(app).post(`/support/${id}/respond`).set(auth('staff-1', 'staff')).send({ body: 'پاسخ پشتیبانی' })
    expect(staffReply.status).toBe(200)
    expect(staffReply.body.ticket.status).toBe('answered')

    const companyReply = await request(app).post(`/support/${id}/respond`).set(auth('company-1', 'applicant')).send({ body: 'پاسخ شرکت' })
    expect(companyReply.status).toBe(200)
    expect(companyReply.body.ticket.status).toBe('open')
    expect(companyReply.body.ticket.messages.map((message: { body: string }) => message.body)).toEqual(['پیام اول', 'پاسخ پشتیبانی', 'پاسخ شرکت'])
    const afterLetters = await pool.query<{ count: string }>('SELECT COUNT(*) FROM dashboard.letters')
    expect(afterLetters.rows[0]?.count).toBe(beforeLetters.rows[0]?.count)
  })

  it.each([
    ['company-1', 'applicant'],
    ['staff-1', 'staff'],
  ] as const)('allows %s to cancel a ticket', async (actorId, role) => {
    const app = await appUnderTest()
    const created = await request(app).post('/support').set(auth('company-1', 'applicant')).send({ subject: 'لغو', message: 'متن' })
    const closed = await request(app).post(`/support/${created.body.ticket.id}/close`).set(auth(actorId, role))
    expect(closed.status).toBe(200)
    expect(closed.body.ticket.status).toBe('closed')
  })

  it('does not allow another company to reply to or cancel a ticket', async () => {
    const app = await appUnderTest()
    const created = await request(app).post('/support').set(auth('company-1', 'applicant')).send({ subject: 'خصوصی', message: 'متن' })
    const id = created.body.ticket.id as string
    expect((await request(app).post(`/support/${id}/respond`).set(auth('company-2', 'applicant')).send({ body: 'نفوذ' })).status).toBe(404)
    expect((await request(app).post(`/support/${id}/close`).set(auth('company-2', 'applicant'))).status).toBe(404)
  })

  it('keeps support available when requester-name lookup fails', async () => {
    const app = await appWithFailingUserLookup()
    await request(app).post('/support').set(auth('company-1', 'applicant')).send({ subject: 'نام شرکت', message: 'متن' })

    const listed = await request(app).get('/support').set(auth('staff-1', 'staff'))
    expect(listed.status).toBe(200)
    expect(listed.body.items[0].requesterName).toBe('شرکت متقاضی')
  })
})
