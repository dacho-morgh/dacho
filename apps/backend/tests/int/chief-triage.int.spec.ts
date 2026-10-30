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
import {
  CURRENT_EVENT_RULES_VERSION,
  CURRENT_NON_COMPETE_VERSION,
} from '../../src/dashboard/request-repo.js'

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://phase0_test:***@127.0.0.1:55439/dacho_phase0_test'
const pool = new Pool({ connectionString, application_name: 't21-chief-triage' })

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
  { name: 'شرکت فناور پیشرو', nationalId: 'T21-company-1', representativeId: 'company-user-1' },
  { name: 'شرکت نوآوران', nationalId: 'T21-company-2', representativeId: 'company-user-2' },
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

describe('T21: Chief triage, correction, rejection and reopen (int)', () => {
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

  it('puts a submitted application in the responsible chief queue with a triage action', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)

    const queue = await request(app).get('/admin/requests').set(auth('chief'))
    expect(queue.status).toBe(200)
    const item = queue.body.items.find((entry: { id: string }) => entry.id === submitted.id)
    expect(item.status).toBe('in_review')
    expect(item.reviewStage).toBe('chief_triage')
    expect(item.allowedActions).toEqual(['read', 'triage'])

    // A chief of another event reads nothing and cannot triage this case.
    const otherQueue = await request(app).get('/admin/requests').set(auth('chief-2'))
    expect(otherQueue.body.items.map((entry: { id: string }) => entry.id)).not.toContain(submitted.id)
    const otherDecision = await triage(app, 'chief-2', submitted.id, { action: 'accept' })
    expect(otherDecision.status).toBe(403)

    const company = await request(app).get(`/requests/${submitted.id}`).set(auth('company-user-1'))
    expect(company.body.request.allowedActions).toEqual(['read'])
  })

  it('refuses triage by anyone but the responsible chief and validates the decision', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)

    for (const user of ['company-user-1', 'owner', 'secretariat', 'reviewer-1', 'employer-1', 'investment']) {
      const res = await triage(app, user, submitted.id, { action: 'accept' })
      expect(res.status, user).toBe(403)
    }
    expect((await triage(app, 'chief', submitted.id, { action: 'nope' })).body.error).toBe('invalid_action')
    expect((await triage(app, 'chief', submitted.id, { action: 'return' })).body.error).toBe('reason_required')
    expect((await triage(app, 'chief', submitted.id, { action: 'reject', reason: '   ' })).body.error).toBe('reason_required')
    expect(
      (await triage(app, 'chief', submitted.id, { action: 'accept', expectedRevision: 'x' })).body.error,
    ).toBe('invalid_revision')
    const stale = await triage(app, 'chief', submitted.id, { action: 'accept', expectedRevision: 1 })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toBe('stale_revision')
    expect((await triage(app, 'chief', 'not-a-uuid', { action: 'accept' })).status).toBe(404)

    const untouched = await request(app).get(`/requests/${submitted.id}`).set(auth('company-user-1'))
    expect(untouched.body.request).toMatchObject({ status: 'in_review', revision: submitted.revision })
  })

  it('returns a case with a reason, accepts a same-case correction as a new revision and keeps both versions', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)

    const returned = await triage(app, 'chief', submitted.id, {
      action: 'return',
      reason: 'برنامه زمان‌بندی را کامل کنید',
      expectedRevision: submitted.revision,
    })
    expect(returned.status).toBe(200)
    expect(returned.body.request).toMatchObject({
      id: submitted.id,
      status: 'action_needed',
      revision: submitted.revision + 1,
      allowedActions: ['read'],
    })

    // The company sees the status, the reason and the right to correct.
    const company = await request(app).get(`/requests/${submitted.id}`).set(auth('company-user-1'))
    expect(company.body.request.status).toBe('action_needed')
    expect(company.body.request.allowedActions).toEqual(
      expect.arrayContaining(['read', 'correct', 'uploadDocument', 'deleteDocument']),
    )
    const returnEntry = company.body.timeline.find((entry: { action: string }) => entry.action === 'chief_return')
    expect(returnEntry).toMatchObject({
      actorId: 'chief',
      reason: 'برنامه زمان‌بندی را کامل کنید',
      fromState: 'in_review',
      toState: 'action_needed',
    })
    const letters = await pool.query(
      "SELECT recipient_id FROM dashboard.notification_jobs WHERE request_id = $1 AND action = 'chief_return'",
      [submitted.id],
    )
    expect(letters.rows).toEqual([{ recipient_id: 'company-user-1' }])

    // Resubmitting an unchanged case still needs fresh consent.
    const noConsent = await request(app).post(`/requests/${submitted.id}/resubmit`).set(auth('company-user-1')).send({})
    expect(noConsent.status).toBe(400)
    expect(noConsent.body.missingFields).toEqual(['nonCompeteAcceptance', 'eventRulesAcceptance'])

    // Correct permitted answers and add a corrected proposal file.
    const patch = await request(app)
      .patch(`/requests/${submitted.id}`)
      .set(auth('company-user-1'))
      .send({ answers: { applicationTeam: team, summary: 'خلاصه اصلاح‌شده' } })
    expect(patch.status).toBe(200)
    await uploadProposal(app, 'company-user-1', submitted.id, 'proposal-v2.pdf')

    const resubmitted = await request(app)
      .post(`/requests/${submitted.id}/resubmit`)
      .set(auth('company-user-1'))
      .send(consent)
    expect(resubmitted.status).toBe(200)
    expect(resubmitted.body.request).toMatchObject({
      id: submitted.id,
      trackingCode: submitted.trackingCode,
      status: 'in_review',
      reviewStage: 'chief_triage',
      revision: submitted.revision + 2,
    })

    // A second resubmit (double click) changes nothing.
    const again = await request(app).post(`/requests/${submitted.id}/resubmit`).set(auth('company-user-1')).send(consent)
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('not_correctable')

    // Both revisions remain inspectable with their own answers, files and consent.
    const proposal = await request(app).get(`/requests/${submitted.id}/proposal`).set(auth('company-user-1'))
    expect(proposal.body.revisions).toEqual([submitted.revision, submitted.revision + 2])
    expect(proposal.body.proposal.revision).toBe(submitted.revision + 2)
    expect(proposal.body.proposal.answers.summary).toBe('خلاصه اصلاح‌شده')
    expect(proposal.body.proposal.proposalDocuments.map((doc: { filename: string }) => doc.filename)).toEqual([
      'proposal.pdf',
      'proposal-v2.pdf',
    ])
    expect(proposal.body.agreements).toHaveLength(2)
    const first = await request(app)
      .get(`/requests/${submitted.id}/proposal`)
      .query({ revision: submitted.revision })
      .set(auth('company-user-1'))
    expect(first.body.proposal.answers.summary).toBe('خلاصه اولیه')
    expect(first.body.proposal.proposalDocuments.map((doc: { filename: string }) => doc.filename)).toEqual(['proposal.pdf'])

    // The chief sees the corrected case again and the history keeps every actor.
    const queue = await request(app).get(`/admin/requests/${submitted.id}`).set(auth('chief'))
    expect(queue.status).toBe(200)
    expect(queue.body.request.allowedActions).toEqual(['read', 'triage'])
    const history = await request(app).get(`/requests/${submitted.id}/history`).set(auth('company-user-1'))
    expect(history.body.items.map((entry: { action: string; actorId: string }) => [entry.action, entry.actorId])).toEqual([
      ['submit', 'company-user-1'],
      ['chief_return', 'chief'],
      ['correction_submit', 'company-user-1'],
    ])
  })

  it('refuses ordinary company edits outside draft and correction states', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)

    const inReview = await request(app)
      .patch(`/requests/${submitted.id}`)
      .set(auth('company-user-1'))
      .send({ title: 'تغییر بدون اجازه' })
    expect(inReview.status).toBe(409)
    const uploadInReview = await request(app)
      .post('/documents')
      .set(auth('company-user-1'))
      .field('category', 'proposal')
      .field('requestId', submitted.id)
      .attach('file', Buffer.from('%PDF-late'), { filename: 'late.pdf', contentType: 'application/pdf' })
    expect(uploadInReview.status).toBe(404)
    const earlyResubmit = await request(app)
      .post(`/requests/${submitted.id}/resubmit`)
      .set(auth('company-user-1'))
      .send(consent)
    expect(earlyResubmit.status).toBe(409)

    // Files pinned by a submitted revision survive a correction cycle.
    await triage(app, 'chief', submitted.id, { action: 'return', reason: 'اصلاح لازم است' })
    const pinned = (await request(app).get(`/requests/${submitted.id}/proposal`).set(auth('company-user-1'))).body
      .proposal.proposalDocuments[0].id
    const del = await request(app).delete(`/documents/${pinned}`).set(auth('company-user-1'))
    expect(del.status).toBe(409)
    expect(del.body.error).toBe('document_pinned')

    // Another company cannot touch the returned case.
    const foreignPatch = await request(app)
      .patch(`/requests/${submitted.id}`)
      .set(auth('company-user-2'))
      .send({ title: 'x' })
    expect(foreignPatch.status).toBe(404)
    const foreignResubmit = await request(app)
      .post(`/requests/${submitted.id}/resubmit`)
      .set(auth('company-user-2'))
      .send(consent)
    expect(foreignResubmit.status).toBe(404)
  })

  it('does not let a returned case be resubmitted by an unverified company', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)
    await triage(app, 'chief', submitted.id, { action: 'return', reason: 'اصلاح لازم است' })
    await pool.query(
      `UPDATE dashboard.company_verifications SET status = 'returned'
       WHERE representative_id = 'company-user-1'`,
    )
    const res = await request(app).post(`/requests/${submitted.id}/resubmit`).set(auth('company-user-1')).send(consent)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('company_not_verified')
    const state = await request(app).get(`/requests/${submitted.id}`).set(auth('company-user-1'))
    expect(state.body.request.status).toBe('action_needed')
  })

  it('accepts triage once and then closes the stage', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)

    const accepted = await triage(app, 'chief', submitted.id, { action: 'accept' })
    expect(accepted.status).toBe(200)
    expect(accepted.body.request).toMatchObject({
      status: 'in_review',
      reviewStage: 'triaged',
      revision: submitted.revision + 1,
      allowedActions: ['read', 'startReview'],
    })
    const again = await triage(app, 'chief', submitted.id, { action: 'return', reason: 'دیر است' })
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('invalid_triage_state')
    expect((await request(app).post(`/admin/requests/${submitted.id}/reopen`).set(auth('owner')).send({ reason: 'x' })).status).toBe(409)
  })

  it('rejects only the company, event and subtopic in scope and reopens only through the owner with a reason', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر', 'پردازش گفتار'])
    const rejectedCase = await submitApplication(app, 'company-user-1', event, 0)
    const otherCase = await submitApplication(app, 'company-user-1', event, 1)

    const rejected = await triage(app, 'chief', rejectedCase.id, {
      action: 'reject',
      reason: 'خارج از دامنه فراخوان',
    })
    expect(rejected.status).toBe(200)
    expect(rejected.body.request.status).toBe('rejected')
    expect(rejected.body.request.allowedActions).toEqual(['read'])

    const company = await request(app).get(`/requests/${rejectedCase.id}`).set(auth('company-user-1'))
    expect(company.body.timeline.find((entry: { action: string }) => entry.action === 'chief_reject')).toMatchObject({
      actorId: 'chief',
      reason: 'خارج از دامنه فراخوان',
    })

    // The rejected subtopic stays closed for that company; the other one and other companies are unaffected.
    const retry = await request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({
        serviceId: 'event-service',
        title: 'تلاش دوباره',
        eventId: event.eventId,
        subtopicId: event.subtopics[0]!.subtopicId,
        rfpVersionId: event.subtopics[0]!.rfpVersionId,
      })
    expect(retry.status).toBe(409)
    expect(retry.body.error).toBe('duplicate_subtopic_request')
    const otherStill = await request(app).get(`/requests/${otherCase.id}`).set(auth('company-user-1'))
    expect(otherStill.body.request.status).toBe('in_review')
    const otherCompany = await submitApplication(app, 'company-user-2', event, 0)
    expect(otherCompany.status).toBe('in_review')

    // The rejected case is terminal for the company and for further triage.
    expect((await request(app).patch(`/requests/${rejectedCase.id}`).set(auth('company-user-1')).send({ title: 'x' })).status).toBe(409)
    expect((await triage(app, 'chief', rejectedCase.id, { action: 'accept' })).status).toBe(409)

    // Only the System Owner reopens, and only with a reason.
    for (const user of ['company-user-1', 'reviewer-1', 'chief', 'secretariat', 'employer-1']) {
      const res = await request(app)
        .post(`/admin/requests/${rejectedCase.id}/reopen`)
        .set(auth(user))
        .send({ reason: 'تلاش برای بازگشایی' })
      expect(res.status, user).toBe(403)
    }
    const noReason = await request(app).post(`/admin/requests/${rejectedCase.id}/reopen`).set(auth('owner')).send({ reason: ' ' })
    expect(noReason.status).toBe(400)
    expect(noReason.body.error).toBe('reason_required')
    const staleReopen = await request(app)
      .post(`/admin/requests/${rejectedCase.id}/reopen`)
      .set(auth('owner'))
      .send({ reason: 'بررسی مجدد', expectedRevision: 1 })
    expect(staleReopen.status).toBe(409)

    const adminView = await request(app).get(`/admin/requests/${rejectedCase.id}`).set(auth('owner'))
    expect(adminView.body.request.allowedActions).toContain('reopen')

    const reopened = await request(app)
      .post(`/admin/requests/${rejectedCase.id}/reopen`)
      .set(auth('owner'))
      .send({ reason: 'مدارک تکمیلی ارائه شد' })
    expect(reopened.status).toBe(200)
    expect(reopened.body.request).toMatchObject({
      id: rejectedCase.id,
      trackingCode: rejectedCase.trackingCode,
      status: 'in_review',
      reviewStage: 'chief_triage',
      revision: rejected.body.request.revision + 1,
    })
    expect(reopened.body.request.allowedActions).not.toContain('reopen')

    const history = await request(app).get(`/requests/${rejectedCase.id}/history`).set(auth('company-user-1'))
    expect(history.body.items.map((entry: { action: string }) => entry.action)).toEqual([
      'submit',
      'chief_reject',
      'owner_reopen',
    ])
    expect(history.body.items[2]).toMatchObject({
      actorId: 'owner',
      reason: 'مدارک تکمیلی ارائه شد',
      fromState: 'rejected',
      toState: 'in_review',
    })

    // The responsible chief can triage the reopened case again.
    const queue = await request(app).get(`/admin/requests/${rejectedCase.id}`).set(auth('chief'))
    expect(queue.body.request.allowedActions).toEqual(['read', 'triage'])

    // A second reopen of a non-rejected case is refused.
    const secondReopen = await request(app)
      .post(`/admin/requests/${rejectedCase.id}/reopen`)
      .set(auth('owner'))
      .send({ reason: 'دوباره' })
    expect(secondReopen.status).toBe(409)
    expect(secondReopen.body.error).toBe('invalid_reopen_state')
  })

  it('moves case access and triage to the new responsible chief when the event chief changes', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)
    // A grant the owner made by hand is not part of the chief handover.
    await pool.query(
      `INSERT INTO dashboard.case_assignments (request_id, user_id, role, assigned_by)
       VALUES ($1, 'reviewer-1', 'reviewer', 'owner')`,
      [submitted.id],
    )
    const current = await request(app).get(`/admin/events/${event.eventId}`).set(auth('owner'))
    const swap = await request(app)
      .patch(`/admin/events/${event.eventId}`)
      .set(auth('owner'))
      .send({ responsibleChiefId: 'chief-2', revision: current.body.event.revision, reason: 'تغییر مسئول' })
    expect(swap.status).toBe(200)

    // The former chief neither decides nor keeps reading the dossier.
    expect((await triage(app, 'chief', submitted.id, { action: 'accept' })).status).toBe(403)
    expect((await request(app).get(`/admin/requests/${submitted.id}`).set(auth('chief'))).status).toBe(404)
    expect((await request(app).get(`/requests/${submitted.id}/proposal`).set(auth('chief'))).status).toBe(404)
    const oldQueue = await request(app).get('/admin/requests').set(auth('chief'))
    expect(oldQueue.body.items.map((entry: { id: string }) => entry.id)).not.toContain(submitted.id)

    // The new chief finds the case in the queue with the triage action.
    const newQueue = await request(app).get('/admin/requests').set(auth('chief-2'))
    const item = newQueue.body.items.find((entry: { id: string }) => entry.id === submitted.id)
    expect(item?.allowedActions).toEqual(['read', 'triage'])

    // The revoked grant is kept as history; the manual grant is untouched.
    const grants = await pool.query(
      `SELECT user_id, active, revoked_by, revoke_reason FROM dashboard.case_assignments
       WHERE request_id = $1 ORDER BY assigned_at, user_id`,
      [submitted.id],
    )
    expect(grants.rows).toEqual(
      expect.arrayContaining([
        { user_id: 'chief', active: false, revoked_by: 'owner', revoke_reason: 'تغییر مسئول' },
        { user_id: 'chief-2', active: true, revoked_by: null, revoke_reason: null },
        { user_id: 'reviewer-1', active: true, revoked_by: null, revoke_reason: null },
      ]),
    )
    expect(grants.rows).toHaveLength(3)

    expect((await triage(app, 'chief-2', submitted.id, { action: 'accept' })).status).toBe(200)
  })

  it('hands over chief assignments without deadlock while decisions run concurrently', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر', 'پردازش گفتار', 'رباتیک'])
    const cases: string[] = []
    for (const user of ['company-user-1', 'company-user-2']) {
      for (const index of [0, 1, 2]) cases.push((await submitApplication(app, user, event, index)).id)
    }
    const current = await request(app).get(`/admin/events/${event.eventId}`).set(auth('owner'))
    const [swap, ...decisions] = await Promise.all([
      request(app)
        .patch(`/admin/events/${event.eventId}`)
        .set(auth('owner'))
        .send({ responsibleChiefId: 'chief-2', revision: current.body.event.revision, reason: 'تغییر مسئول' }),
      ...cases.map((id) => triage(app, 'chief', id, { action: 'return', reason: 'اصلاح' })),
    ])
    expect(swap!.status).toBe(200)
    for (const decision of decisions) expect([200, 403]).toContain(decision.status)

    const { rows } = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM dashboard.case_assignments
       WHERE request_id = ANY($1::uuid[]) AND role = 'chief-reviewer' AND active ORDER BY user_id`,
      [cases],
    )
    expect(rows.map((row) => row.user_id)).toEqual(cases.map(() => 'chief-2'))
  })

  it('reopens only proposal files of a returned case to the company', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const created = await request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({
        serviceId: 'event-service',
        title: 'طرح سامانه بینایی ماشین',
        answers: { applicationTeam: team },
        eventId: event.eventId,
        subtopicId: event.subtopics[0]!.subtopicId,
        rfpVersionId: event.subtopics[0]!.rfpVersionId,
      })
    const requestId = created.body.request.id as string
    await uploadProposal(app, 'company-user-1', requestId, 'proposal.pdf')
    const financial = await request(app)
      .post('/documents')
      .set(auth('company-user-1'))
      .field('category', 'financialStatements')
      .field('requestId', requestId)
      .attach('file', Buffer.from('%PDF-1.4 statements'), { filename: 'statements.pdf', contentType: 'application/pdf' })
    expect(financial.status).toBe(201)
    expect((await request(app).post(`/requests/${requestId}/submit`).set(auth('company-user-1')).send(consent)).status).toBe(200)
    await triage(app, 'chief', requestId, { action: 'return', reason: 'اصلاح لازم است' })

    // A submitted non-proposal file survives the correction cycle.
    const del = await request(app).delete(`/documents/${financial.body.document.id}`).set(auth('company-user-1'))
    expect(del.status).toBe(403)
    const upload = await request(app)
      .post('/documents')
      .set(auth('company-user-1'))
      .field('category', 'financialStatements')
      .field('requestId', requestId)
      .attach('file', Buffer.from('%PDF-1.4 late'), { filename: 'late.pdf', contentType: 'application/pdf' })
    expect(upload.status).toBe(404)

    // A proposal file added during the correction stays removable until resubmission.
    const added = await uploadProposal(app, 'company-user-1', requestId, 'proposal-draft.pdf')
    expect((await request(app).delete(`/documents/${added}`).set(auth('company-user-1'))).status).toBe(200)
  })

  it('serializes concurrent decisions so exactly one transition and notification is recorded', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)
    const results = await Promise.all([
      triage(app, 'chief', submitted.id, { action: 'return', reason: 'اصلاح' }),
      triage(app, 'chief', submitted.id, { action: 'reject', reason: 'رد' }),
      triage(app, 'chief', submitted.id, { action: 'accept' }),
    ])
    expect(results.map((res) => res.status).sort()).toEqual([200, 409, 409])
    const transitions = await pool.query(
      "SELECT action FROM dashboard.activities WHERE request_id = $1 AND action LIKE 'chief_%'",
      [submitted.id],
    )
    expect(transitions.rows).toHaveLength(1)
  })

  it('requires a reason in the database for return, reject and reopen history', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const submitted = await submitApplication(app, 'company-user-1', event)
    await expect(
      pool.query(
        `INSERT INTO dashboard.activities
           (owner_id, request_id, type, title, actor_id, action, reason, from_state, to_state, revision)
         VALUES ('company-user-1', $1, 'transition', 'x', 'chief', 'chief_return', ' ', 'in_review', 'action_needed', 9)`,
        [submitted.id],
      ),
    ).rejects.toThrow(/activities_triage_reason_required/)
  })
})
