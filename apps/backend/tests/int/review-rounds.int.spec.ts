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
const pool = new Pool({ connectionString, application_name: 't22-review-rounds' })

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
  { name: 'شرکت فناور پیشرو', nationalId: 'T22-company-1', representativeId: 'company-user-1' },
  { name: 'شرکت نوآوران', nationalId: 'T22-company-2', representativeId: 'company-user-2' },
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

describe('T22: Review rounds and four distinct assignments (int)', () => {
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

  it('starts a round: subtopic employer plus three reviewers, bound to the proposal revision', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)

    const queue = await request(app).get('/admin/requests').set(auth('chief'))
    expect(queue.body.items.find((entry: { id: string }) => entry.id === triaged.id).allowedActions).toEqual([
      'read', 'startReview',
    ])
    const candidates = await request(app).get(`/requests/${triaged.id}/review-round/candidates`).set(auth('chief'))
    expect(candidates.status).toBe(200)
    expect(candidates.body.employerId).toBe('employer-1')
    expect(candidates.body.items.map((item: { id: string }) => item.id).sort()).toEqual(
      ['reviewer-1', 'reviewer-2', 'reviewer-3', 'reviewer-4', 'reviewer-5'],
    )

    const started = await startRound(app, 'chief', triaged.id, { reviewerIds: THREE, expectedRevision: triaged.revision })
    expect(started.status).toBe(201)
    expect(started.body.round).toMatchObject({
      requestId: triaged.id,
      requestRevision: triaged.revision,
      proposalRevision: triaged.submittedRevision,
      employerId: 'employer-1',
      startedBy: 'chief',
    })
    expect(
      started.body.round.slots.map((slot: { userId: string; role: string; slot: string; active: boolean }) =>
        [slot.userId, slot.role, slot.slot, slot.active]),
    ).toEqual([
      ['employer-1', 'employer-reviewer', 'employer', true],
      ['reviewer-1', 'reviewer', 'ordinary', true],
      ['reviewer-2', 'reviewer', 'ordinary', true],
      ['reviewer-3', 'reviewer', 'ordinary', true],
    ])
    expect(await activeSlots(triaged.id)).toHaveLength(4)

    // The case does not advance: starting a round changes neither state nor revision.
    const after = await request(app).get(`/requests/${triaged.id}`).set(auth('company-user-1'))
    expect(after.body.request).toMatchObject({ status: 'in_review', reviewStage: 'triaged', revision: triaged.revision })

    const refreshed = await request(app).get('/admin/requests').set(auth('chief'))
    expect(refreshed.body.items.find((entry: { id: string }) => entry.id === triaged.id).allowedActions).toEqual([
      'read', 'replaceReviewer',
    ])

    // Each of the four sees the case once in the scoped queue; others see nothing.
    for (const user of ['employer-1', ...THREE]) {
      const own = await request(app).get('/admin/requests').set(auth(user))
      expect(own.body.items.filter((entry: { id: string }) => entry.id === triaged.id), user).toHaveLength(1)
    }
    for (const user of ['reviewer-4', 'reviewer-5', 'employer-2']) {
      const other = await request(app).get('/admin/requests').set(auth(user))
      expect(other.body.items.map((entry: { id: string }) => entry.id), user).not.toContain(triaged.id)
    }

    const history = await pool.query(
      `SELECT actor_id, from_state, to_state, revision FROM dashboard.activities
       WHERE request_id = $1 AND action = 'review_round_start'`,
      [triaged.id],
    )
    expect(history.rows).toEqual([{ actor_id: 'chief', from_state: 'in_review', to_state: 'in_review', revision: triaged.revision }])
  })

  it('refuses duplicates, wrong counts, ineligible people and the fixed employer as an ordinary reviewer', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    const body = (reviewerIds: unknown) => ({ reviewerIds, expectedRevision: triaged.revision })

    expect((await startRound(app, 'chief', triaged.id, body(['reviewer-1', 'reviewer-1', 'reviewer-2']))).body.error).toBe('duplicate_people')
    expect((await startRound(app, 'chief', triaged.id, body(['reviewer-1', 'reviewer-2', 'employer-1']))).body.error).toBe('duplicate_people')
    expect((await startRound(app, 'chief', triaged.id, body(['reviewer-1', 'reviewer-2']))).body.error).toBe('three_reviewers_required')
    expect((await startRound(app, 'chief', triaged.id, body(THREE.concat('reviewer-4')))).body.error).toBe('three_reviewers_required')
    expect((await startRound(app, 'chief', triaged.id, body(['reviewer-1', 'reviewer-2', '  ']))).body.error).toBe('three_reviewers_required')
    expect((await startRound(app, 'chief', triaged.id, body('reviewer-1'))).body.error).toBe('three_reviewers_required')
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE, expectedRevision: 'x' })).body.error).toBe('invalid_revision')

    for (const bad of ['employer-2', 'chief-2', 'investment', 'owner', 'company-user-1', 'reviewer-off', 'ghost']) {
      const res = await startRound(app, 'chief', triaged.id, body(['reviewer-1', 'reviewer-2', bad]))
      expect(res.status, bad).toBe(400)
      expect(res.body, bad).toEqual({ error: 'reviewer_not_eligible', userId: bad })
    }

    const stale = await startRound(app, 'chief', triaged.id, { reviewerIds: THREE, expectedRevision: triaged.revision - 1 })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toBe('stale_revision')
    expect(await activeSlots(triaged.id)).toEqual([])
    expect((await pool.query('SELECT 1 FROM dashboard.review_rounds WHERE request_id = $1', [triaged.id])).rowCount).toBe(0)
  })

  it('lets only the responsible chief start a round, and only after triage', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر', 'پردازش گفتار'])
    const triaged = await triagedCase(app, event)
    const pending = await submitApplication(app, 'company-user-1', event, 1)
    const body = { reviewerIds: THREE }

    for (const user of ['chief-2', 'owner', 'secretariat', 'reviewer-1', 'employer-1', 'investment', 'company-user-1']) {
      const res = await startRound(app, user, triaged.id, body)
      expect(res.status, user).toBe(403)
    }
    expect((await request(app).get(`/requests/${triaged.id}/review-round/candidates`).set(auth('chief-2'))).status).toBe(404)
    expect((await request(app).get(`/requests/${triaged.id}/review-round/candidates`).set(auth('owner'))).status).toBe(403)

    const early = await startRound(app, 'chief', pending.id, body)
    expect(early.status).toBe(409)
    expect(early.body.error).toBe('invalid_round_state')
    expect((await startRound(app, 'chief', 'not-a-uuid', body)).status).toBe(404)
    expect((await startRound(app, 'chief', '00000000-0000-4000-8000-000000000000', body)).status).toBe(404)
    expect(await activeSlots(pending.id)).toEqual([])
  })

  it('starts one round per revision even when two starts race', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)

    const results = await Promise.all([
      startRound(app, 'chief', triaged.id, { reviewerIds: ['reviewer-1', 'reviewer-2', 'reviewer-3'] }),
      startRound(app, 'chief', triaged.id, { reviewerIds: ['reviewer-3', 'reviewer-4', 'reviewer-5'] }),
    ])
    expect(results.map((res) => res.status).sort()).toEqual([201, 409])
    expect(results.find((res) => res.status === 409)!.body.error).toBe('round_already_started')
    expect(await activeSlots(triaged.id)).toHaveLength(4)
    expect((await pool.query('SELECT 1 FROM dashboard.review_rounds WHERE request_id = $1', [triaged.id])).rowCount).toBe(1)
  })

  it('stops when the fixed employer is unavailable or hand-made reviewer grants exist', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر', 'پردازش گفتار'])
    const first = await triagedCase(app, event, 'company-user-1', 0)
    const second = await triagedCase(app, event, 'company-user-2', 1)

    // The subtopic's employer is no longer a usable employer-reviewer.
    await pool.query(`UPDATE dashboard.event_subtopics SET employer_id = 'ghost' WHERE id = $1`, [event.subtopics[0]!.subtopicId])
    const unavailable = await startRound(app, 'chief', first.id, { reviewerIds: THREE })
    expect(unavailable.status).toBe(409)
    expect(unavailable.body.error).toBe('employer_unavailable')

    await pool.query(
      `INSERT INTO dashboard.case_assignments (request_id, user_id, role, assigned_by)
       VALUES ($1, 'reviewer-4', 'reviewer', 'owner')`,
      [second.id],
    )
    const manual = await startRound(app, 'chief', second.id, { reviewerIds: THREE })
    expect(manual.status).toBe(409)
    expect(manual.body.error).toBe('existing_assignments')
    expect(await activeSlots(second.id)).toEqual([])
  })

  it('shows all four slots to oversight but only their own slot to a reviewer', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    const none = await request(app).get(`/requests/${triaged.id}/review-round`).set(auth('chief'))
    expect(none.body).toEqual({ round: null })
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })).status).toBe(201)

    for (const user of ['chief', 'owner', 'secretariat']) {
      const res = await request(app).get(`/requests/${triaged.id}/review-round`).set(auth(user))
      expect(res.status, user).toBe(200)
      expect(res.body.round.slots.map((slot: { userId: string }) => slot.userId).sort(), user).toEqual(
        ['employer-1', ...THREE].sort(),
      )
    }
    for (const user of ['reviewer-2', 'employer-1']) {
      const res = await request(app).get(`/requests/${triaged.id}/review-round`).set(auth(user))
      expect(res.status, user).toBe(200)
      expect(res.body.round.slots).toHaveLength(1)
      expect(res.body.round.slots[0].userId).toBe(user)
      expect(res.body.round).not.toHaveProperty('employerId')
      expect(res.body.round).not.toHaveProperty('startedBy')
    }
    expect((await request(app).get(`/requests/${triaged.id}/review-round`).set(auth('reviewer-4'))).status).toBe(404)
    expect((await request(app).get(`/requests/${triaged.id}/review-round`).set(auth('chief-2'))).status).toBe(404)
    for (const user of ['company-user-1', 'investment']) {
      expect((await request(app).get(`/requests/${triaged.id}/review-round`).set(auth(user))).status, user).toBe(403)
    }
  })

  it('opens the evaluation guard for the four people on the round revision, and for nobody else', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })).status).toBe(201)

    for (const user of ['employer-1', ...THREE]) {
      const res = await request(app).get(`/requests/${triaged.id}/evaluation`).set(auth(user))
      expect(res.status, user).toBe(200)
      expect(res.body.revision, user).toBe(triaged.revision)
    }
    expect((await request(app).get(`/requests/${triaged.id}/evaluation`).set(auth('reviewer-4'))).status).toBe(404)
  })

  it('keeps round slots out of the generic owner assignment commands', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    expect((await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })).status).toBe(201)

    const extra = await request(app)
      .post(`/admin/requests/${triaged.id}/assignments`)
      .set(auth('owner'))
      .send({ userId: 'reviewer-4', role: 'reviewer' })
    expect(extra.status).toBe(409)
    expect(extra.body.error).toBe('managed_by_review_round')
    const revoke = await request(app)
      .delete(`/admin/requests/${triaged.id}/assignments/reviewer-1`)
      .set(auth('owner'))
      .send({ reason: 'x' })
    expect(revoke.status).toBe(409)
    expect(revoke.body.error).toBe('managed_by_review_round')
    expect(await activeSlots(triaged.id)).toHaveLength(4)

    const listing = await request(app).get(`/admin/requests/${triaged.id}/assignments`).set(auth('owner'))
    expect(listing.body.items.filter((item: { roundId: string | null }) => item.roundId)).toHaveLength(4)
  })

  it('makes a hand-made reviewer grant wait for a round start in progress, then refuses it', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)

    // Hold the request lock a start takes, with its round written but not committed.
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT 1 FROM dashboard.requests WHERE id = $1 FOR NO KEY UPDATE', [triaged.id])
      await client.query(
        `INSERT INTO dashboard.review_rounds (request_id, request_revision, proposal_revision, employer_id, started_by)
         VALUES ($1, $2, $3, 'employer-1', 'chief')`,
        [triaged.id, triaged.revision, triaged.submittedRevision],
      )
      const pending = request(app)
        .post(`/admin/requests/${triaged.id}/assignments`)
        .set(auth('owner'))
        .send({ userId: 'reviewer-4', role: 'reviewer' })
        .then((res) => res)
      await new Promise((resolve) => setTimeout(resolve, 300))
      await client.query('COMMIT')
      const res = await pending
      expect(res.status).toBe(409)
      expect(res.body.error).toBe('managed_by_review_round')
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      client.release()
    }
    expect(
      (await pool.query(
        `SELECT 1 FROM dashboard.case_assignments WHERE request_id = $1 AND user_id = 'reviewer-4' AND active`,
        [triaged.id],
      )).rowCount,
    ).toBe(0)
  })

  it('supersedes the previous round when a new revision starts a new one, keeping history', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    const first = await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })
    expect(first.status).toBe(201)

    // A corrected proposal is a new revision of the same case, accepted again at triage.
    const next = triaged.revision + 1
    await pool.query(
      `INSERT INTO dashboard.request_proposals (request_id, revision, form_version, application_team, proposal_documents)
       VALUES ($1, $2, 'event-application-2026-v1', '[]', '[]')`,
      [triaged.id, next],
    )
    await pool.query(`UPDATE dashboard.requests SET revision = $2, review_stage = 'triaged' WHERE id = $1`, [triaged.id, next])

    const second = await startRound(app, 'chief', triaged.id, {
      reviewerIds: ['reviewer-3', 'reviewer-4', 'reviewer-5'],
      expectedRevision: next,
    })
    expect(second.status).toBe(201)
    expect(second.body.round).toMatchObject({ requestRevision: next, proposalRevision: next })
    expect(second.body.round.id).not.toBe(first.body.round.id)

    const slots = await activeSlots(triaged.id)
    expect(slots.map((slot) => slot.user_id).sort()).toEqual(['employer-1', 'reviewer-3', 'reviewer-4', 'reviewer-5'])
    expect(new Set(slots.map((slot) => slot.round_id))).toEqual(new Set([second.body.round.id]))

    const history = await pool.query<{ user_id: string; active: boolean; revoke_reason: string | null }>(
      `SELECT user_id, active, revoke_reason FROM dashboard.case_assignments WHERE round_id = $1 ORDER BY user_id`,
      [first.body.round.id],
    )
    expect(history.rows).toHaveLength(4)
    expect(history.rows.every((row) => !row.active && row.revoke_reason === 'superseded_by_new_round')).toBe(true)
    expect(
      (await pool.query('SELECT superseded_at FROM dashboard.review_rounds WHERE id = $1', [first.body.round.id])).rows[0]
        .superseded_at,
    ).not.toBeNull()

    // reviewer-1 lost the case; reviewer-4 gained it.
    expect((await request(app).get(`/requests/${triaged.id}/review-round`).set(auth('reviewer-1'))).status).toBe(404)
    expect((await request(app).get(`/requests/${triaged.id}/review-round`).set(auth('reviewer-4'))).status).toBe(200)
  })

  it('enforces four distinct people and the slot/role pairing in the database', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await triagedCase(app, event)
    const started = await startRound(app, 'chief', triaged.id, { reviewerIds: THREE })
    const roundId = started.body.round.id as string
    const insert = (userId: string, role: string, slot: string | null, round: string | null = roundId) =>
      pool.query(
        `INSERT INTO dashboard.case_assignments (request_id, user_id, role, assigned_by, round_id, slot)
         VALUES ($1, $2, $3, 'owner', $4, $5)`,
        [triaged.id, userId, role, round, slot],
      )

    // A second employer slot, or the same person twice in one round, is impossible.
    await expect(insert('employer-2', 'employer-reviewer', 'employer')).rejects.toMatchObject({ code: '23505' })
    await expect(insert('reviewer-1', 'reviewer', 'ordinary')).rejects.toMatchObject({ code: '23505' })
    // Slot and role must agree, and a slot never exists without its round.
    await expect(insert('reviewer-4', 'reviewer', 'employer')).rejects.toMatchObject({ code: '23514' })
    await expect(insert('employer-2', 'employer-reviewer', 'ordinary')).rejects.toMatchObject({ code: '23514' })
    await expect(insert('reviewer-4', 'reviewer', 'ordinary', null)).rejects.toMatchObject({ code: '23514' })
    expect(await activeSlots(triaged.id)).toHaveLength(4)
  })
})
