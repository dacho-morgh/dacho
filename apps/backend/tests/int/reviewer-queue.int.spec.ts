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
const pool = new Pool({ connectionString, application_name: 't23-reviewer-queue' })

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'company-user-2', phone: 'company-user-2', operationalRole: 'representative', isActive: true },
  { id: 'employer-1', phone: 'employer-1', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'chief-2', phone: 'chief-2', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'reviewer-1', phone: 'reviewer-1', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-2', phone: 'reviewer-2', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-3', phone: 'reviewer-3', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-4', phone: 'reviewer-4', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-5', phone: 'reviewer-5', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-off', phone: 'reviewer-off', operationalRole: 'reviewer', isActive: false },
  { id: 'employer-2', phone: 'employer-2', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'secretariat', phone: 'secretariat', operationalRole: 'central-secretariat', isActive: true },
]

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'T23-company-1', representativeId: 'company-user-1' },
  { name: 'شرکت نوآوران', nationalId: 'T23-company-2', representativeId: 'company-user-2' },
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

/** A submitted application the responsible chief has accepted at triage. */
async function triagedCase(
  app: App,
  event: { eventId: string; subtopics: { subtopicId: string; rfpVersionId: string }[] },
  user = 'company-user-1',
  index = 0,
) {
  const submitted = await submitApplication(app, user, event, index)
  const accepted = await triage(app, 'chief', submitted.id, { action: 'accept', expectedRevision: submitted.revision })
  expect(accepted.status).toBe(200)
  return {
    id: submitted.id,
    submittedRevision: submitted.revision,
    revision: accepted.body.request.revision as number,
  }
}

const startRound = (app: App, user: string, id: string, body: Record<string, unknown>) =>
  request(app).post(`/requests/${id}/review-round`).set(auth(user)).send(body)

const activeSlots = async (requestId: string) =>
  (
    await pool.query<{ user_id: string; role: string; slot: string; round_id: string }>(
      `SELECT user_id, role, slot, round_id FROM dashboard.case_assignments
       WHERE request_id = $1 AND round_id IS NOT NULL AND active ORDER BY slot, user_id`,
      [requestId],
    )
  ).rows

const THREE = ['reviewer-1', 'reviewer-2', 'reviewer-3']


const get = (app: App, user: string, path: string) => request(app).get(path).set(auth(user))
const queue = async (app: App, user: string, view = 'all') =>
  (await get(app, user, `/review/queue?view=${view}`).expect(200)).body as {
    items: {
      requestId: string
      actionable: boolean
      proposalRevision: number | null
      assignment: { role: string; slot: string }
      round: { current: boolean; proposalRevision: number } | null
      evaluation: { state: string } | null
    }[]
    total: number
    counts: { open: number; closed: number; all: number }
  }

/** Temporarily change a seeded person; returns the undo. */
function changeUser(id: string, patch: Record<string, unknown>) {
  const user = users.find((entry) => entry.id === id)!
  const before = { ...user }
  Object.assign(user, patch)
  return () => Object.assign(user, before)
}

describe('T23: Assigned reviewer queue and case file (int)', () => {
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

  it('feeds each queue from the persisted assignments of that person only', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر', 'پردازش گفتار', 'تحلیل متن'])
    const first = await triagedCase(app, event, 'company-user-1', 0)
    const second = await triagedCase(app, event, 'company-user-2', 1)
    const unstarted = await triagedCase(app, event, 'company-user-1', 2)
    expect((await startRound(app, 'chief', first.id, { reviewerIds: THREE })).status).toBe(201)
    expect((await startRound(app, 'chief', second.id, { reviewerIds: ['reviewer-3', 'reviewer-4', 'reviewer-5'] })).status).toBe(201)

    const ids = async (user: string) => (await queue(app, user)).items.map((item) => item.requestId).sort()
    expect(await ids('reviewer-1')).toEqual([first.id])
    expect(await ids('reviewer-2')).toEqual([first.id])
    expect(await ids('reviewer-3')).toEqual([first.id, second.id].sort())
    expect(await ids('reviewer-4')).toEqual([second.id])
    expect(await ids('employer-1')).toEqual([first.id, second.id].sort())
    expect(await ids('employer-2')).toEqual([])

    // A triaged case with no round, and a hand-picked scope in the query, add nothing.
    expect(await ids('employer-1')).not.toContain(unstarted.id)
    const scoped = await get(app, 'reviewer-1', '/review/queue?userId=reviewer-4&role=employer-reviewer').expect(200)
    expect(scoped.body.items.map((item: { requestId: string }) => item.requestId)).toEqual([first.id])

    const own = await queue(app, 'reviewer-1')
    expect(own.items[0]).toMatchObject({
      actionable: true,
      proposalRevision: first.submittedRevision,
      assignment: { role: 'reviewer', slot: 'ordinary' },
      round: { current: true, proposalRevision: first.submittedRevision },
      evaluation: null,
    })
    expect(own.counts).toEqual({ open: 1, closed: 0, all: 1 })
    expect((await queue(app, 'employer-1')).items[0]!.assignment).toMatchObject({ role: 'employer-reviewer', slot: 'employer' })

    // Counts and totals follow the same rows as the list.
    const paged = await get(app, 'employer-1', '/review/queue?view=all&limit=1&page=2').expect(200)
    expect(paged.body).toMatchObject({ total: 2, page: 2, totalPages: 2, counts: { open: 2, closed: 0, all: 2 } })
    expect(paged.body.items).toHaveLength(1)
    expect((await get(app, 'reviewer-1', '/review/queue?view=closed').expect(200)).body.items).toEqual([])

    // The other five roles have no reviewer queue.
    for (const user of ['owner', 'secretariat', 'chief', 'investment', 'company-user-1']) {
      expect((await get(app, user, '/review/queue')).status, user).toBe(403)
      expect((await get(app, user, `/review/cases/${first.id}`)).status, user).toBe(403)
    }
    expect((await get(app, 'reviewer-1', '/review/queue?view=bogus')).status).toBe(400)
  })

  it('removes access the moment the role changes, the account is deactivated or the slot ends', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })).status).toBe(201)
    expect((await queue(app, 'reviewer-1')).total).toBe(1)

    const restoreRole = changeUser('reviewer-1', { operationalRole: 'central-secretariat' })
    try {
      expect((await get(app, 'reviewer-1', '/review/queue')).status).toBe(403)
      expect((await get(app, 'reviewer-1', `/review/cases/${triaged.id}`)).status).toBe(403)
    } finally { restoreRole() }

    const restoreActive = changeUser('reviewer-2', { isActive: false })
    try {
      expect((await get(app, 'reviewer-2', '/review/queue')).status).toBeGreaterThanOrEqual(401)
      expect((await get(app, 'reviewer-2', `/review/cases/${triaged.id}`)).status).toBeGreaterThanOrEqual(401)
    } finally { restoreActive() }

    await pool.query(
      `UPDATE dashboard.case_assignments SET active = false WHERE request_id = $1 AND user_id = 'reviewer-3'`,
      [triaged.id],
    )
    expect((await queue(app, 'reviewer-3')).total).toBe(0)
    expect((await get(app, 'reviewer-3', `/review/cases/${triaged.id}`)).status).toBe(404)
    expect((await queue(app, 'reviewer-1')).total).toBe(1)
  })

  it('opens the case file to the assigned only, with the pinned proposal, RFP and necessary profile', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر', 'پردازش گفتار'])
    const triaged = await triagedCase(app, event)
    const other = await triagedCase(app, event, 'company-user-2', 1)
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })).status).toBe(201)
    expect((await startRound(app, 'chief', other.id, { reviewerIds: ['reviewer-3', 'reviewer-4', 'reviewer-5'] })).status).toBe(201)

    for (const user of ['reviewer-1', 'reviewer-2', 'reviewer-3', 'employer-1']) {
      const res = await get(app, user, `/review/cases/${triaged.id}`)
      expect(res.status, user).toBe(200)
      expect(res.headers['cache-control']).toContain('no-store')
      expect(res.body.case).toMatchObject({
        requestId: triaged.id, status: 'in_review', reviewStage: 'triaged', actionable: true,
        subtopic: { title: 'پردازش تصویر' }, event: { title: 'رویداد هوش مصنوعی ۲۰۲۶' },
        companyName: 'شرکت فناور پیشرو', proposalRevision: triaged.submittedRevision,
      })
      expect(res.body.proposal).toMatchObject({
        revision: triaged.submittedRevision,
        applicationTeam: team,
        answers: { summary: 'خلاصه اولیه' },
      })
      expect(res.body.proposal.documents.map((doc: { filename: string }) => doc.filename)).toEqual(['proposal.pdf'])
      expect(res.body.rfp.files.map((file: { filename: string }) => file.filename)).toEqual(['rfp.pdf'])
      // Only the necessary fields can appear; the fixture's other company fields never do.
      expect(res.body.company.company.name).toBe('شرکت فناور پیشرو')
      for (const key of Object.keys(res.body.company.company)) expect(['city', 'name', 'nationalId', 'province', 'type']).toContain(key)
      for (const key of Object.keys(res.body.company.dossier)) {
        expect(['activityDomain', 'classification', 'legalEntityType', 'productsServices']).toContain(key)
      }
      expect(JSON.stringify(res.body.company)).not.toContain('company-user-1')

      // The listed download links really work for this person.
      const download = await get(app, user, res.body.proposal.documents[0].downloadUrl.replace('/api/dashboard', ''))
      expect(download.status, user).toBe(200)
      const rfp = await get(app, user, res.body.rfp.files[0].downloadUrl.replace('/api/dashboard', ''))
      expect(rfp.status, user).toBe(200)

      // Nothing about the other three, the chief's roster, the owner or other reviewers' work.
      const text = JSON.stringify(res.body)
      const others = ['reviewer-1', 'reviewer-2', 'reviewer-3', 'employer-1'].filter((id) => id !== user)
      for (const leaked of ['company-user-1', 'ownerId', 'startedBy', 'chief', ...others]) {
        expect(text, `${user} sees ${leaked}`).not.toContain(leaked)
      }
    }

    // Unassigned people and other cases look exactly like missing ones.
    for (const user of ['reviewer-4', 'reviewer-5', 'employer-2']) {
      const res = await get(app, user, `/review/cases/${triaged.id}`)
      expect(res.status, user).toBe(404)
      expect(res.body).toEqual({ error: 'not_found' })
    }
    expect((await get(app, 'reviewer-1', `/review/cases/${other.id}`)).status).toBe(404)
    expect((await get(app, 'reviewer-1', '/review/cases/not-a-uuid')).status).toBe(404)
    expect((await get(app, 'reviewer-1', `/requests/${other.id}`)).status).toBe(404)
  })

  it('shows only the person own evaluation state, never anyone else', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })).status).toBe(201)

    const saved = await request(app)
      .put(`/requests/${triaged.id}/evaluation`)
      .set(auth('reviewer-1'))
      .send({ revision: triaged.revision, scores: { a: { interdisciplinary: 4 } }, answers: { technicalApproachClear: 'yes' } })
    expect(saved.status).toBe(200)

    const own = await queue(app, 'reviewer-1')
    expect(own.items[0]!.evaluation).toMatchObject({ state: 'draft' })
    expect((await queue(app, 'reviewer-2')).items[0]!.evaluation).toBeNull()
    expect((await queue(app, 'employer-1')).items[0]!.evaluation).toBeNull()
    const ownCase = await get(app, 'reviewer-1', `/review/cases/${triaged.id}`)
    expect(ownCase.body.case.evaluation).toMatchObject({ state: 'draft', revision: triaged.revision })
    // Only the state, never the draft's answers or scores.
    expect(JSON.stringify(ownCase.body)).not.toContain('technicalApproachClear')
    expect((await get(app, 'reviewer-2', `/review/cases/${triaged.id}`)).body.case.evaluation).toBeNull()
    expect((await get(app, 'reviewer-2', `/requests/${triaged.id}/evaluations`)).status).toBe(403)
  })

  it('gives reviewers only the proposal files pinned to the revision they review', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })).status).toBe(201)
    const pinned = (await get(app, 'reviewer-1', `/review/cases/${triaged.id}`)).body.proposal.documents[0].id as string

    // Files that arrive after the submission: an unpinned proposal file and financial evidence.
    const extraProposal = await request(app)
      .post('/documents').set(auth('owner'))
      .field('category', 'proposal').field('requestId', triaged.id)
      .attach('file', Buffer.from('%PDF-1.4 later'), { filename: 'later.pdf', contentType: 'application/pdf' })
    expect(extraProposal.status).toBe(201)
    const financial = await request(app)
      .post('/documents').set(auth('owner'))
      .field('category', 'financialStatements').field('requestId', triaged.id)
      .attach('file', Buffer.from('%PDF-1.4 money'), { filename: 'money.pdf', contentType: 'application/pdf' })
    expect(financial.status).toBe(201)
    const laterId = extraProposal.body.document.id as string
    const financialId = financial.body.document.id as string

    for (const user of ['reviewer-1', 'reviewer-3', 'employer-1']) {
      expect((await get(app, user, `/documents/${pinned}/download`)).status, user).toBe(200)
      for (const hidden of [laterId, financialId]) {
        expect((await get(app, user, `/documents/${hidden}/download`)).status, `${user} ${hidden}`).toBe(404)
        expect((await get(app, user, `/documents/${hidden}`)).status, `${user} ${hidden}`).toBe(404)
      }
      const listed = (await get(app, user, `/documents?requestId=${triaged.id}`).expect(200)).body.items.map((item: { id: string }) => item.id)
      expect(listed, user).toEqual([pinned])
    }
    // Oversight still sees everything on the case.
    const all = (await get(app, 'owner', `/documents?requestId=${triaged.id}`).expect(200)).body.items.map((item: { id: string }) => item.id)
    expect(all.sort()).toEqual([pinned, laterId, financialId].sort())

    // The company dossier stays closed; the proposal snapshot is the reviewed revision only.
    expect((await get(app, 'reviewer-1', '/documents?companyId=anything')).status).toBe(403)
    const proposal = await get(app, 'reviewer-1', `/requests/${triaged.id}/proposal`).expect(200)
    expect(proposal.body.revisions).toEqual([triaged.submittedRevision])
    expect(proposal.body.proposal.revision).toBe(triaged.submittedRevision)
    expect((await get(app, 'reviewer-1', `/requests/${triaged.id}/proposal?revision=${triaged.submittedRevision + 5}`)).status).toBe(404)
    const profile = await get(app, 'reviewer-1', `/requests/${triaged.id}/verification`).expect(200)
    expect(Object.keys(profile.body.verification.snapshot).sort()).toEqual(['company', 'dossier'])
  })

  it('closes the old round for the reviewer and opens the new revision for the new four', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })).status).toBe(201)

    // A corrected proposal: a new revision exists, but no new round has started yet.
    const next = triaged.revision + 1
    await pool.query(
      `INSERT INTO dashboard.request_proposals (request_id, revision, form_version, application_team, proposal_documents)
       VALUES ($1, $2, 'event-application-2026-v1', '[]', '[]')`,
      [triaged.id, next],
    )
    await pool.query(`UPDATE dashboard.requests SET revision = $2, review_stage = 'triaged' WHERE id = $1`, [triaged.id, next])

    const stale = await queue(app, 'reviewer-1')
    expect(stale.counts).toEqual({ open: 0, closed: 1, all: 1 })
    expect(stale.items[0]).toMatchObject({ actionable: false, proposalRevision: triaged.submittedRevision, round: { current: false } })
    expect((await queue(app, 'reviewer-1', 'open')).items).toEqual([])
    expect((await queue(app, 'reviewer-1', 'closed')).items).toHaveLength(1)
    // The old reviewer still reads exactly what was reviewed, not the unreviewed new revision.
    expect((await get(app, 'reviewer-1', `/review/cases/${triaged.id}`).expect(200)).body.proposal.revision).toBe(triaged.submittedRevision)

    const second = await startRound(app, 'chief', triaged.id, {
      reviewerIds: ['reviewer-3', 'reviewer-4', 'reviewer-5'],
      expectedRevision: next,
    })
    expect(second.status).toBe(201)
    expect((await queue(app, 'reviewer-1')).total).toBe(0)
    expect((await get(app, 'reviewer-1', `/review/cases/${triaged.id}`)).status).toBe(404)
    const fresh = await queue(app, 'reviewer-4')
    expect(fresh.items[0]).toMatchObject({ actionable: true, proposalRevision: next, round: { current: true, proposalRevision: next } })
    expect((await get(app, 'reviewer-4', `/review/cases/${triaged.id}`).expect(200)).body.proposal.revision).toBe(next)
    // reviewer-3 sat in both rounds, but only the active assignment counts, once.
    expect((await queue(app, 'reviewer-3')).total).toBe(1)
  })

  it('gives reviewers and employers a minimal view from the generic request routes', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })).status).toBe(201)

    for (const user of ['reviewer-1', 'employer-1']) {
      const list = await get(app, user, '/requests').expect(200)
      const admin = await get(app, user, '/admin/requests').expect(200)
      for (const body of [list.body, admin.body]) {
        expect(body.items).toHaveLength(1)
        expect(body.items[0]).toMatchObject({ id: triaged.id, answers: {}, allowedActions: ['read'] })
        for (const hidden of ['ownerId', 'companyId', 'submittedBy']) expect(body.items[0], user).not.toHaveProperty(hidden)
      }
      expect(admin.body.items[0].owner).toBeNull()

      for (const path of [`/requests/${triaged.id}`, `/admin/requests/${triaged.id}`]) {
        const detail = await get(app, user, path).expect(200)
        expect(detail.body.owner, path).toBeNull()
        for (const hidden of ['ownerId', 'companyId', 'submittedBy']) expect(detail.body.request, path).not.toHaveProperty(hidden)
        // Event applications show the reviewed revision's answers.
        expect(detail.body.request.answers, path).toMatchObject({ summary: 'خلاصه اولیه' })
        expect(detail.body.timeline.length, path).toBeGreaterThan(0)
        for (const entry of detail.body.timeline) {
          for (const hidden of ['ownerId', 'actorId', 'reason', 'description']) expect(entry, path).not.toHaveProperty(hidden)
        }
        expect(JSON.stringify(detail.body), path).not.toContain('company-user-1')
      }
      const history = await get(app, user, `/requests/${triaged.id}/history`).expect(200)
      for (const entry of history.body.items) expect(entry).not.toHaveProperty('actorId')
      const feed = await get(app, user, '/activities').expect(200)
      for (const entry of feed.body.items) expect(entry).not.toHaveProperty('ownerId')
    }

    // Oversight and the owning company keep their full views.
    const full = await get(app, 'owner', `/requests/${triaged.id}`).expect(200)
    expect(full.body.owner).toEqual({ id: 'company-user-1', name: null })
    expect(full.body.request.ownerId).toBe('company-user-1')
    const own = await get(app, 'company-user-1', `/requests/${triaged.id}`).expect(200)
    expect(own.body.request.ownerId).toBe('company-user-1')
  })

  it('does not list a case that is no longer in review as open work', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })).status).toBe(201)
    await pool.query(`UPDATE dashboard.requests SET status = 'approved' WHERE id = $1`, [triaged.id])
    const closed = await queue(app, 'employer-1')
    expect(closed.counts).toEqual({ open: 0, closed: 1, all: 1 })
    expect(closed.items[0]!.actionable).toBe(false)
  })
})
