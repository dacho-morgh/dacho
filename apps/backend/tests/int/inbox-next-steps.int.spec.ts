import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { PrivateDocumentStorage } from '../../src/documents/storage.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { clearVerifiedCompanies, seedVerifiedCompanies } from './verified-company-fixtures.js'
import { PUBLIC_EVENT_FIELDS } from './public-event-fields.js'
import {
  CURRENT_EVENT_RULES_VERSION,
  CURRENT_NON_COMPETE_VERSION,
} from '../../src/dashboard/request-repo.js'

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://phase0_test:***@127.0.0.1:55439/dacho_phase0_test'
const pool = new Pool({ connectionString, application_name: 's1-inbox-next-steps' })

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'company-user-2', phone: 'company-user-2', operationalRole: 'representative', isActive: true },
  { id: 'employer-1', phone: 'employer-1', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'chief-2', phone: 'chief-2', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'reviewer-1', phone: 'reviewer-1', operationalRole: 'reviewer', isActive: true },
  { id: 'secretariat', phone: 'secretariat', operationalRole: 'central-secretariat', isActive: true },
]

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'S1-company-1', representativeId: 'company-user-1' },
  { name: 'شرکت نوآوران', nationalId: 'S1-company-2', representativeId: 'company-user-2' },
])

const auth = (id = 'owner') => ({
  'x-internal-proxy-secret': 'test-proxy-secret',
  'x-user-id': id,
  'x-user-roles': users.find((u) => u.id === id)?.operationalRole ?? 'representative',
})

const makeApp = async () =>
  createApp({
    pool,
    userStore,
    companyStore,
    jwt: await JwtSigner.create('test'),
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    serviceCatalog: new InMemoryServiceCatalog([
      {
        id: 'event-service',
        key: 'event-application',
        title: 'درخواست رویداد',
        workflow: [{ title: 'بررسی سردبیر', role: 'chief-reviewer', roleName: 'chief-reviewer', order: 0 }],
        formFields: null,
      },
    ]),
    proxySecret: 'test-proxy-secret',
  })

type App = Awaited<ReturnType<typeof makeApp>>

const eventPayload = (chief: string) => ({
  title: 'رویداد هوش مصنوعی ۲۰۲۶',
  description: 'توضیحات رویداد',
  registrationOpenAt: '2020-01-01T00:00:00Z',
  registrationCloseAt: '2099-01-01T00:00:00Z',
  responsibleChiefId: chief,
  responsibleInvestmentId: 'investment',
  ...PUBLIC_EVENT_FIELDS,
})

const team = [
  { name: 'سارا حسینی', role: 'مدیر پروژه' },
  { name: 'رضا کمالی', role: 'متخصص یادگیری ماشین' },
]

const consent = {
  nonCompeteAcceptance: { accepted: true, textVersionId: CURRENT_NON_COMPETE_VERSION },
  eventRulesAcceptance: { accepted: true, textVersionId: CURRENT_EVENT_RULES_VERSION },
}

async function cleanup() {
  const files = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.rfp_files')).rows
  const docFiles = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  // Inbox counts read whole mailboxes, so no letter of these people may survive a test.
  await pool.query('DELETE FROM dashboard.letters WHERE recipient_id = ANY($1) OR sender_id = ANY($1)', [users.map((u) => u.id)])
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all(
    [...files, ...docFiles].map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)),
  )
  await clearVerifiedCompanies(pool)
  await pool.query(
    "DELETE FROM dashboard.company_verifications WHERE representative_id IN ('company-user-1', 'company-user-2')",
  )
}

async function createEvent(app: App, chief: string, subtopicTitles: string[]) {
  const eventRes = await request(app).post('/admin/events').set(auth('owner')).send(eventPayload(chief))
  expect(eventRes.status).toBe(201)
  const eventId = eventRes.body.event.id as string
  const catRes = await request(app)
    .post(`/admin/events/${eventId}/categories`)
    .set(auth('owner'))
    .send({ title: 'دسته هوش مصنوعی' })
  expect(catRes.status).toBe(201)
  const subtopics: { subtopicId: string; rfpVersionId: string }[] = []
  for (const title of subtopicTitles) {
    const subtopicRes = await request(app)
      .post(`/admin/events/${eventId}/subtopics`)
      .set(auth('owner'))
      .send({ title, categoryId: catRes.body.category.id, employerId: 'employer-1' })
    expect(subtopicRes.status).toBe(201)
    const subtopicId = subtopicRes.body.subtopic.id as string
    const rfpRes = await request(app)
      .post(`/admin/events/${eventId}/subtopics/${subtopicId}/rfp`)
      .set(auth('owner'))
      .field('expectedVersionId', '')
      .field('reason', 'نسخه اولیه')
      .attach('files', Buffer.from('%PDF-Initial-RFP'), { filename: 'rfp.pdf', contentType: 'application/pdf' })
    expect(rfpRes.status).toBe(201)
    subtopics.push({ subtopicId, rfpVersionId: rfpRes.body.version.id })
  }
  return { eventId, subtopics }
}

async function uploadProposal(app: App, user: string, requestId: string, name: string) {
  const res = await request(app)
    .post('/documents')
    .set(auth(user))
    .field('category', 'proposal')
    .field('requestId', requestId)
    .attach('file', Buffer.from(`%PDF-1.4 ${name}`), { filename: name, contentType: 'application/pdf' })
  expect(res.status).toBe(201)
  return res.body.document.id as string
}

/** Draft, fill, upload and submit one application; returns the submitted request. */
async function submitApplication(
  app: App,
  user: string,
  event: { eventId: string; subtopics: { subtopicId: string; rfpVersionId: string }[] },
  index = 0,
) {
  const target = event.subtopics[index]!
  const created = await request(app)
    .post('/requests')
    .set(auth(user))
    .send({
      serviceId: 'event-service',
      title: 'طرح سامانه بینایی ماشین',
      answers: { applicationTeam: team, summary: 'خلاصه اولیه' },
      eventId: event.eventId,
      subtopicId: target.subtopicId,
      rfpVersionId: target.rfpVersionId,
    })
  expect(created.status).toBe(201)
  const requestId = created.body.request.id as string
  await uploadProposal(app, user, requestId, 'proposal.pdf')
  const submitted = await request(app).post(`/requests/${requestId}/submit`).set(auth(user)).send(consent)
  expect(submitted.status).toBe(200)
  return submitted.body.request as { id: string; trackingCode: string; revision: number; status: string }
}

const triage = (app: App, user: string, id: string, body: Record<string, unknown>) =>
  request(app).post(`/requests/${id}/triage`).set(auth(user)).send(body)

type InboxLetter = {
  id: string
  title: string
  type: string
  recipientId: string
  requestId: string | null
  read: boolean
  nextStep: string | null
  actionRequired: boolean
}

const inbox = async (app: App, user: string, query = 'box=received') => {
  const res = await request(app).get(`/letters?${query}&limit=50`).set(auth(user))
  expect(res.status).toBe(200)
  return res.body as { items: InboxLetter[]; total: number; counts: { unread: number; actionRequired: number } }
}

const pendingSteps = async (app: App, user: string, requestId: string) =>
  (await inbox(app, user, 'box=received&status=action_required')).items
    .filter((letter) => letter.requestId === requestId)
    .map((letter) => letter.nextStep)

describe('S1: inbox next steps (int)', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await cleanup()
    await seedVerifiedCompanies(pool, companyStore)
  })

  afterEach(async () => {
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
    await pool.end()
  })

  it('asks the responsible chief to triage a submission and only informs the company', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)

    const chief = await inbox(app, 'chief')
    const ask = chief.items.find((letter) => letter.requestId === submitted.id)!
    expect(ask).toMatchObject({ type: 'notification', nextStep: 'triage', actionRequired: true, read: false })
    expect(chief.counts).toEqual({ unread: 1, actionRequired: 1 })

    const company = (await inbox(app, 'company-user-1')).items.filter((letter) => letter.requestId === submitted.id)
    expect(company).toEqual([expect.objectContaining({ nextStep: null, actionRequired: false })])
    // Another chief is not on the case and hears nothing about it.
    expect((await inbox(app, 'chief-2')).items).toEqual([])
  })

  it('moves the step to the company on return, and back to the chief on correction', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)

    const returned = await triage(app, 'chief', submitted.id, {
      action: 'return', reason: 'لطفا بودجه را اصلاح کنید', expectedRevision: submitted.revision,
    })
    expect(returned.status).toBe(200)
    expect(await pendingSteps(app, 'chief', submitted.id)).toEqual([])
    expect(await pendingSteps(app, 'company-user-1', submitted.id)).toEqual(['correct'])

    const resubmitted = await request(app).post(`/requests/${submitted.id}/resubmit`).set(auth('company-user-1')).send(consent)
    expect(resubmitted.status).toBe(200)
    expect(await pendingSteps(app, 'company-user-1', submitted.id)).toEqual([])
    // A fresh triage step, and the settled one is not repeated as pending.
    expect(await pendingSteps(app, 'chief', submitted.id)).toEqual(['triage'])
    const chiefCase = (await inbox(app, 'chief')).items.filter((letter) => letter.requestId === submitted.id)
    expect(chiefCase.map((letter) => [letter.nextStep, letter.actionRequired])).toEqual([
      ['triage', true],
      ['triage', false],
    ])
  })

  it('filters by box, status and search, and counts what is left to do', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)
    const sent = await request(app).post('/letters').set(auth('chief')).send({
      recipientId: 'company-user-1', requestId: submitted.id, title: 'هماهنگی جلسه دفاع', body: 'زمان جلسه را اعلام کنید',
    })
    expect(sent.status).toBe(201)

    expect((await inbox(app, 'chief', 'box=sent')).items.map((letter) => letter.title)).toEqual(['هماهنگی جلسه دفاع'])
    expect((await inbox(app, 'chief', 'box=received')).items.every((letter) => letter.recipientId === 'chief')).toBe(true)
    expect((await inbox(app, 'company-user-1', 'q=' + encodeURIComponent('جلسه دفاع'))).items).toHaveLength(1)
    expect((await inbox(app, 'company-user-1', 'q=' + encodeURIComponent('100%_'))).items).toHaveLength(0)
    expect((await inbox(app, 'company-user-1', 'status=unread')).items.length).toBe(2)
    expect((await inbox(app, 'company-user-1')).counts).toEqual({ unread: 2, actionRequired: 0 })

    expect((await request(app).get('/letters?box=archive').set(auth('chief'))).status).toBe(400)
    expect((await request(app).get('/letters?status=done').set(auth('chief'))).status).toBe(400)
  })

  it('lets only the recipient toggle read state, and shows the case thread oldest first', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)
    const reply = await request(app).post('/letters').set(auth('chief')).send({
      recipientId: 'company-user-1', requestId: submitted.id, title: 'پاسخ سردبیر', body: 'متن پاسخ',
    })
    expect(reply.status).toBe(201)
    const letterId = reply.body.letter.id as string

    const read = await request(app).post(`/letters/${letterId}/read`).set(auth('company-user-1')).send({ read: true })
    expect(read.status).toBe(200)
    expect(read.body.letter.read).toBe(true)
    const unread = await request(app).post(`/letters/${letterId}/read`).set(auth('company-user-1')).send({ read: false })
    expect(unread.body.letter.read).toBe(false)
    expect((await request(app).post(`/letters/${letterId}/read`).set(auth('chief')).send({ read: true })).status).toBe(404)
    expect((await request(app).post(`/letters/${letterId}/read`).set(auth('company-user-1')).send({ read: 'yes' })).status).toBe(400)

    const detail = await request(app).get(`/letters/${letterId}`).set(auth('company-user-1'))
    expect(detail.status).toBe(200)
    // The submission notice came first; the letter itself is not repeated in its thread.
    expect(detail.body.thread.map((letter: InboxLetter) => letter.type)).toEqual(['notification'])
    expect(detail.body.thread.every((letter: InboxLetter) => letter.requestId === submitted.id)).toBe(true)
  })
})
