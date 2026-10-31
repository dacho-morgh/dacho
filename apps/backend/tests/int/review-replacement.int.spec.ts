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
const pool = new Pool({ connectionString, application_name: 't26-review-replacement' })

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'employer-1', phone: 'employer-1', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'employer-2', phone: 'employer-2', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'employer-3', phone: 'employer-3', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'employer-off', phone: 'employer-off', operationalRole: 'employer-reviewer', isActive: false },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'chief-2', phone: 'chief-2', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'reviewer-1', phone: 'reviewer-1', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-2', phone: 'reviewer-2', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-3', phone: 'reviewer-3', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-4', phone: 'reviewer-4', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-5', phone: 'reviewer-5', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-off', phone: 'reviewer-off', operationalRole: 'reviewer', isActive: false },
  { id: 'secretariat', phone: 'secretariat', operationalRole: 'central-secretariat', isActive: true },
]

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'T26-company-1', representativeId: 'company-user-1' },
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
type EventFixture = { eventId: string; subtopics: { subtopicId: string; rfpVersionId: string }[] }

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
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id IN ('company-user-1')")
}

async function createEvent(app: App, chief: string, subtopicTitles: string[]): Promise<EventFixture> {
  const eventRes = await request(app)
    .post('/admin/events')
    .set(auth('owner'))
    .send({
      title: 'رویداد هوش مصنوعی ۲۰۲۶',
      description: 'توضیحات رویداد',
      registrationOpenAt: '2020-01-01T00:00:00Z',
      registrationCloseAt: '2099-01-01T00:00:00Z',
      responsibleChiefId: chief,
      responsibleInvestmentId: 'investment',
    })
  expect(eventRes.status).toBe(201)
  const eventId = eventRes.body.event.id as string
  const catRes = await request(app)
    .post(`/admin/events/${eventId}/categories`)
    .set(auth('owner'))
    .send({ title: 'دسته هوش مصنوعی' })
  expect(catRes.status).toBe(201)
  const subtopics: EventFixture['subtopics'] = []
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

/** A submitted application the responsible chief has accepted at triage. */
async function triagedCase(app: App, event: EventFixture, index = 0) {
  const target = event.subtopics[index]!
  const created = await request(app)
    .post('/requests')
    .set(auth('company-user-1'))
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
  const upload = await request(app)
    .post('/documents')
    .set(auth('company-user-1'))
    .field('category', 'proposal')
    .field('requestId', requestId)
    .attach('file', Buffer.from('%PDF-1.4 proposal'), { filename: 'proposal.pdf', contentType: 'application/pdf' })
  expect(upload.status).toBe(201)
  const submitted = await request(app).post(`/requests/${requestId}/submit`).set(auth('company-user-1')).send(consent)
  expect(submitted.status).toBe(200)
  const accepted = await request(app)
    .post(`/requests/${requestId}/triage`)
    .set(auth('chief'))
    .send({ action: 'accept', expectedRevision: submitted.body.request.revision })
  expect(accepted.status).toBe(200)
  return {
    id: requestId,
    submittedRevision: submitted.body.request.revision as number,
    revision: accepted.body.request.revision as number,
  }
}

/** A triaged case with a started round of employer-1 and reviewers 1-3. */
async function roundCase(app: App, event: EventFixture, index = 0) {
  const triaged = await triagedCase(app, event, index)
  const started = await request(app)
    .post(`/requests/${triaged.id}/review-round`)
    .set(auth('chief'))
    .send({ reviewerIds: THREE, expectedRevision: triaged.revision })
  expect(started.status).toBe(201)
  return { ...triaged, roundId: started.body.round.id as string }
}

const THREE = ['reviewer-1', 'reviewer-2', 'reviewer-3']

const replaceReviewer = (app: App, user: string, id: string, outgoing: string, body: Record<string, unknown>) =>
  request(app).post(`/requests/${id}/review-round/reviewers/${outgoing}/replace`).set(auth(user)).send(body)

const replaceEmployer = (app: App, user: string, id: string, body: Record<string, unknown>) =>
  request(app).post(`/requests/${id}/review-round/employer/replace`).set(auth(user)).send(body)

const activeUsers = async (requestId: string) =>
  (
    await pool.query<{ user_id: string }>(
      `SELECT user_id FROM dashboard.case_assignments
       WHERE request_id = $1 AND round_id IS NOT NULL AND active ORDER BY user_id`,
      [requestId],
    )
  ).rows.map((row) => row.user_id)

const storeEvaluation = (requestId: string, userId: string, role: string, revision: number, state: 'draft' | 'final') =>
  pool.query(
    `INSERT INTO dashboard.evaluations (request_id, user_id, role, variant, state, revision, finalized_at)
     VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5 = 'final' THEN now() END)`,
    [requestId, userId, role, role === 'reviewer' ? 'ordinary' : 'employer', state, revision],
  )

const idsOf = (res: { body: { items: { id: string }[] } }) => res.body.items.map((item) => item.id)

describe('T26: Reviewer replacement and assignment history (int)', () => {
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

  it('lets the chief replace an unfinished ordinary reviewer: access ends, history stays', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)
    await storeEvaluation(triaged.id, 'reviewer-1', 'reviewer', triaged.revision, 'draft')

    const res = await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', {
      replacementId: 'reviewer-4',
      reason: 'عدم دسترسی',
      expectedRevision: triaged.revision,
    })
    expect(res.status).toBe(200)
    expect(
      res.body.round.slots.map((slot: { userId: string; active: boolean; revokeReason: string | null }) =>
        [slot.userId, slot.active, slot.revokeReason]),
    ).toEqual(expect.arrayContaining([
      ['reviewer-1', false, 'replaced_reviewer'],
      ['reviewer-4', true, null],
    ]))
    expect(res.body.round.replacements).toEqual([
      expect.objectContaining({
        slot: 'ordinary', oldUserId: 'reviewer-1', newUserId: 'reviewer-4', replacedBy: 'chief', reason: 'عدم دسترسی',
      }),
    ])
    expect(await activeUsers(triaged.id)).toEqual(['employer-1', 'reviewer-2', 'reviewer-3', 'reviewer-4'])

    // The replaced reviewer loses the case everywhere at the next request.
    expect((await request(app).get(`/requests/${triaged.id}/review-round`).set(auth('reviewer-1'))).status).toBe(404)
    expect((await request(app).get(`/requests/${triaged.id}/evaluation`).set(auth('reviewer-1'))).status).toBe(404)
    expect(idsOf(await request(app).get('/admin/requests').set(auth('reviewer-1')))).not.toContain(triaged.id)
    // The newcomer takes over the slot.
    expect((await request(app).get(`/requests/${triaged.id}/evaluation`).set(auth('reviewer-4'))).status).toBe(200)
    expect(idsOf(await request(app).get('/admin/requests').set(auth('reviewer-4')))).toContain(triaged.id)

    // The earlier draft is history, not deleted and not handed to the newcomer.
    const kept = await pool.query(
      `SELECT user_id, state FROM dashboard.evaluations WHERE request_id = $1`,
      [triaged.id],
    )
    expect(kept.rows).toEqual([{ user_id: 'reviewer-1', state: 'draft' }])
    const revoked = await pool.query(
      `SELECT revoked_by, revoke_reason, round_id, slot FROM dashboard.case_assignments
       WHERE request_id = $1 AND user_id = 'reviewer-1'`,
      [triaged.id],
    )
    expect(revoked.rows).toEqual([{ revoked_by: 'chief', revoke_reason: 'replaced_reviewer', round_id: triaged.roundId, slot: 'ordinary' }])

    const history = await pool.query(
      `SELECT actor_id, reason, from_state, to_state, revision FROM dashboard.activities
       WHERE request_id = $1 AND action = 'chief_replace_reviewer'`,
      [triaged.id],
    )
    expect(history.rows).toEqual([
      { actor_id: 'chief', reason: 'عدم دسترسی', from_state: 'in_review', to_state: 'in_review', revision: triaged.revision },
    ])

    // The case itself does not move.
    const after = await request(app).get(`/requests/${triaged.id}`).set(auth('company-user-1'))
    expect(after.body.request).toMatchObject({ status: 'in_review', reviewStage: 'triaged', revision: triaged.revision })
  })

  it('shows replacements to oversight only and never to a reviewer or the company', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', { replacementId: 'reviewer-4' })).status).toBe(200)

    for (const user of ['chief', 'owner', 'secretariat']) {
      const res = await request(app).get(`/requests/${triaged.id}/review-round`).set(auth(user))
      expect(res.status, user).toBe(200)
      expect(res.body.round.replacements, user).toHaveLength(1)
      expect(res.body.round.slots, user).toHaveLength(5)
    }
    for (const user of ['reviewer-4', 'reviewer-2', 'employer-1']) {
      const res = await request(app).get(`/requests/${triaged.id}/review-round`).set(auth(user))
      expect(res.status, user).toBe(200)
      expect(res.body.round, user).not.toHaveProperty('replacements')
      expect(res.body.round.slots.map((slot: { userId: string }) => slot.userId), user).toEqual([user])
    }
    expect((await request(app).get(`/requests/${triaged.id}/review-round`).set(auth('company-user-1'))).status).toBe(403)

    // The case history and activity feed carry the same oversight-only entries (with their reasons).
    expect((await replaceEmployer(app, 'owner', triaged.id, { employerId: 'employer-2', reason: 'تعارض منافع' })).status).toBe(200)
    const replacementActions = ['chief_replace_reviewer', 'owner_replace_employer']
    const actionsOf = (items: { action: string | null; requestId: string | null }[]) =>
      items
        .filter((entry) => entry.requestId === triaged.id)
        .map((entry) => entry.action)
        .filter((action) => replacementActions.includes(action ?? ''))
    for (const user of ['chief', 'owner', 'secretariat']) {
      const history = await request(app).get(`/requests/${triaged.id}/history`).set(auth(user))
      expect(history.status, user).toBe(200)
      expect(actionsOf(history.body.items), user).toEqual(replacementActions)
      const feed = await request(app).get('/activities?limit=50').set(auth(user))
      expect(actionsOf(feed.body.items).sort(), user).toEqual([...replacementActions].sort())
    }
    for (const user of ['company-user-1', 'reviewer-4', 'reviewer-2', 'employer-2', 'investment']) {
      const history = await request(app).get(`/requests/${triaged.id}/history`).set(auth(user))
      if (history.status === 200) expect(actionsOf(history.body.items), user).toEqual([])
      const detail = await request(app).get(`/requests/${triaged.id}`).set(auth(user))
      if (detail.status === 200) expect(actionsOf(detail.body.timeline), user).toEqual([])
      const feed = await request(app).get('/activities?limit=50').set(auth(user))
      expect(feed.status, user).toBe(200)
      expect(actionsOf(feed.body.items), user).toEqual([])
    }
    const company = await request(app).get(`/requests/${triaged.id}/history`).set(auth('company-user-1'))
    expect(company.status).toBe(200)
    expect(company.body.items.map((entry: { action: string | null }) => entry.action)).toContain('review_round_start')

    // The reason is optional for the chief; a blank one is stored as none.
    const blank = await replaceReviewer(app, 'chief', triaged.id, 'reviewer-2', { replacementId: 'reviewer-5', reason: '   ' })
    expect(blank.status).toBe(200)
    expect(blank.body.round.replacements.at(-1).reason).toBeNull()
  })

  it('lists replacement candidates without anyone who already held a slot', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', { replacementId: 'reviewer-4' })).status).toBe(200)

    const candidates = await request(app).get(`/requests/${triaged.id}/review-round/candidates`).set(auth('chief'))
    expect(candidates.status).toBe(200)
    expect(candidates.body.items.map((item: { id: string }) => item.id)).toEqual(['reviewer-5'])
    expect(candidates.body.employerId).toBe('employer-1')
  })

  it('refuses a reviewer who finalized, a missing slot, repeats and ineligible replacements', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)
    await storeEvaluation(triaged.id, 'reviewer-3', 'reviewer', triaged.revision, 'final')
    const body = (replacementId: unknown, extra: Record<string, unknown> = {}) => ({
      replacementId, expectedRevision: triaged.revision, ...extra,
    })

    const final = await replaceReviewer(app, 'chief', triaged.id, 'reviewer-3', body('reviewer-4'))
    expect(final.status).toBe(409)
    expect(final.body.error).toBe('evaluation_final')
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-5', body('reviewer-4'))).body.error).toBe('not_assigned')
    expect((await replaceReviewer(app, 'chief', triaged.id, 'employer-1', body('reviewer-4'))).body.error).toBe('not_assigned')
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', body('reviewer-2'))).body.error).toBe('already_assigned')
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', body('reviewer-1'))).body.error).toBe('duplicate_people')
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', body(''))).body.error).toBe('replacement_required')
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', body(7))).body.error).toBe('replacement_required')
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', body('reviewer-4', { reason: 7 }))).body.error).toBe('invalid_reason')
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', body('reviewer-4', { reason: 'x'.repeat(1001) }))).body.error).toBe('invalid_reason')
    expect(
      (await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', { replacementId: 'reviewer-4', expectedRevision: 'x' })).body.error,
    ).toBe('invalid_revision')
    for (const bad of ['employer-2', 'chief-2', 'investment', 'owner', 'company-user-1', 'reviewer-off', 'ghost']) {
      const res = await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', body(bad))
      expect(res.status, bad).toBe(400)
      expect(res.body, bad).toEqual({ error: 'reviewer_not_eligible', userId: bad })
    }
    const stale = await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', {
      replacementId: 'reviewer-4', expectedRevision: triaged.revision - 1,
    })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toBe('stale_revision')

    expect(await activeUsers(triaged.id)).toEqual(['employer-1', 'reviewer-1', 'reviewer-2', 'reviewer-3'])
    expect((await pool.query('SELECT 1 FROM dashboard.review_replacements WHERE request_id = $1', [triaged.id])).rowCount).toBe(0)
  })

  it('does not let a replaced reviewer come back into the same round', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', { replacementId: 'reviewer-4' })).status).toBe(200)

    const back = await replaceReviewer(app, 'chief', triaged.id, 'reviewer-2', { replacementId: 'reviewer-1' })
    expect(back.status).toBe(409)
    expect(back.body.error).toBe('previously_assigned')
    // The replaced reviewer is gone for good: the same slot cannot be replaced twice.
    const twice = await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', { replacementId: 'reviewer-5' })
    expect(twice.status).toBe(404)
    expect(twice.body.error).toBe('not_assigned')
    expect(await activeUsers(triaged.id)).toEqual(['employer-1', 'reviewer-2', 'reviewer-3', 'reviewer-4'])
  })

  it('limits ordinary replacement to the responsible chief of a started round on a triaged case', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر', 'پردازش گفتار'])
    const started = await roundCase(app, event, 0)
    const noRound = await triagedCase(app, event, 1)
    const body = { replacementId: 'reviewer-4' }

    for (const user of ['chief-2', 'owner', 'secretariat', 'reviewer-1', 'employer-1', 'investment', 'company-user-1']) {
      const res = await replaceReviewer(app, user, started.id, 'reviewer-1', body)
      expect(res.status, user).toBe(403)
    }
    const early = await replaceReviewer(app, 'chief', noRound.id, 'reviewer-1', body)
    expect(early.status).toBe(409)
    expect(early.body.error).toBe('round_not_started')
    expect((await replaceReviewer(app, 'chief', 'not-a-uuid', 'reviewer-1', body)).status).toBe(404)
    expect((await replaceReviewer(app, 'chief', '00000000-0000-4000-8000-000000000000', 'reviewer-1', body)).status).toBe(404)

    // Once the case leaves the reviewable state, no one can swap people in and out.
    await pool.query(`UPDATE dashboard.requests SET status = 'rejected' WHERE id = $1`, [started.id])
    const closed = await replaceReviewer(app, 'chief', started.id, 'reviewer-1', body)
    expect(closed.status).toBe(409)
    expect(closed.body.error).toBe('invalid_round_state')
    expect(await activeUsers(started.id)).toEqual(['employer-1', 'reviewer-1', 'reviewer-2', 'reviewer-3'])
  })

  it('advertises each replacement action only to the person who may use it', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)

    const find = (res: { body: { items: { id: string; allowedActions: string[] }[] } }) =>
      res.body.items.find((item) => item.id === triaged.id)!.allowedActions
    expect(find(await request(app).get('/admin/requests').set(auth('chief')))).toEqual(['read', 'replaceReviewer'])
    expect(find(await request(app).get('/admin/requests').set(auth('owner')))).toContain('replaceEmployer')
    expect(find(await request(app).get('/admin/requests').set(auth('owner')))).not.toContain('replaceReviewer')
    expect(find(await request(app).get('/admin/requests').set(auth('reviewer-1')))).toEqual(['read'])
    expect(find(await request(app).get('/admin/requests').set(auth('secretariat')))).toEqual(['read', 'uploadDocument'])
  })

  it('lets only the owner replace the employer, and only with a reason', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر', 'پردازش گفتار'])
    const triaged = await roundCase(app, event, 0)
    const noRound = await triagedCase(app, event, 1)
    const body = { employerId: 'employer-2', reason: 'تعارض منافع', expectedRevision: triaged.revision }

    for (const user of ['chief', 'chief-2', 'secretariat', 'reviewer-1', 'employer-1', 'investment', 'company-user-1']) {
      const res = await replaceEmployer(app, user, triaged.id, body)
      expect(res.status, user).toBe(403)
    }
    for (const reason of [undefined, '', '   ']) {
      const res = await replaceEmployer(app, 'owner', triaged.id, { ...body, reason })
      expect(res.status, String(reason)).toBe(400)
      expect(res.body.error).toBe('reason_required')
    }
    expect((await replaceEmployer(app, 'owner', triaged.id, { ...body, reason: 5 })).body.error).toBe('invalid_reason')
    expect((await replaceEmployer(app, 'owner', triaged.id, { ...body, employerId: '' })).body.error).toBe('replacement_required')
    expect((await replaceEmployer(app, 'owner', triaged.id, { ...body, expectedRevision: 'x' })).body.error).toBe('invalid_revision')
    for (const bad of ['reviewer-4', 'chief-2', 'owner', 'employer-off', 'ghost']) {
      const res = await replaceEmployer(app, 'owner', triaged.id, { ...body, employerId: bad })
      expect(res.status, bad).toBe(400)
      expect(res.body, bad).toEqual({ error: 'employer_not_eligible', userId: bad })
    }
    expect((await replaceEmployer(app, 'owner', triaged.id, { ...body, employerId: 'employer-1' })).body.error).toBe('already_assigned')
    const stale = await replaceEmployer(app, 'owner', triaged.id, { ...body, expectedRevision: triaged.revision - 1 })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toBe('stale_revision')
    const early = await replaceEmployer(app, 'owner', noRound.id, { employerId: 'employer-2', reason: 'تعارض منافع' })
    expect(early.status).toBe(409)
    expect(early.body.error).toBe('round_not_started')
    expect((await replaceEmployer(app, 'owner', 'not-a-uuid', body)).status).toBe(404)

    expect(await activeUsers(triaged.id)).toEqual(['employer-1', 'reviewer-1', 'reviewer-2', 'reviewer-3'])
    expect((await pool.query('SELECT 1 FROM dashboard.review_replacements WHERE request_id = $1', [triaged.id])).rowCount).toBe(0)
  })

  it('replaces the employer for the case, cuts the old access and keeps the subtopic and history', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)
    // The owner may even replace an employer who already finalized; the locked evaluation stays stored.
    await storeEvaluation(triaged.id, 'employer-1', 'employer-reviewer', triaged.revision, 'final')

    const candidates = await request(app).get(`/requests/${triaged.id}/review-round/employer-candidates`).set(auth('owner'))
    expect(candidates.status).toBe(200)
    expect(candidates.body.employerId).toBe('employer-1')
    expect(candidates.body.items.map((item: { id: string }) => item.id).sort()).toEqual(['employer-2', 'employer-3'])
    expect((await request(app).get(`/requests/${triaged.id}/review-round/employer-candidates`).set(auth('chief'))).status).toBe(403)

    const res = await replaceEmployer(app, 'owner', triaged.id, {
      employerId: 'employer-2', reason: '  تعارض منافع  ', expectedRevision: triaged.revision,
    })
    expect(res.status).toBe(200)
    expect(res.body.round.employerId).toBe('employer-2')
    expect(res.body.round.replacements).toEqual([
      expect.objectContaining({
        slot: 'employer', oldUserId: 'employer-1', newUserId: 'employer-2', replacedBy: 'owner', reason: 'تعارض منافع',
      }),
    ])
    expect(await activeUsers(triaged.id)).toEqual(['employer-2', 'reviewer-1', 'reviewer-2', 'reviewer-3'])

    expect((await request(app).get(`/requests/${triaged.id}/review-round`).set(auth('employer-1'))).status).toBe(404)
    expect((await request(app).get(`/requests/${triaged.id}/evaluation`).set(auth('employer-1'))).status).toBe(404)
    expect(idsOf(await request(app).get('/admin/requests').set(auth('employer-1')))).not.toContain(triaged.id)
    expect((await request(app).get(`/requests/${triaged.id}/evaluation`).set(auth('employer-2'))).status).toBe(200)
    expect(idsOf(await request(app).get('/admin/requests').set(auth('employer-2')))).toContain(triaged.id)

    // The case's employer changed; the event's subtopic configuration did not.
    const subtopic = await pool.query(
      'SELECT employer_id FROM dashboard.event_subtopics WHERE id = $1',
      [event.subtopics[0]!.subtopicId],
    )
    expect(subtopic.rows).toEqual([{ employer_id: 'employer-1' }])
    expect(
      (await pool.query(`SELECT user_id, state FROM dashboard.evaluations WHERE request_id = $1`, [triaged.id])).rows,
    ).toEqual([{ user_id: 'employer-1', state: 'final' }])
    const revoked = await pool.query(
      `SELECT revoked_by, revoke_reason FROM dashboard.case_assignments WHERE request_id = $1 AND user_id = 'employer-1'`,
      [triaged.id],
    )
    expect(revoked.rows).toEqual([{ revoked_by: 'owner', revoke_reason: 'replaced_employer' }])
    const history = await pool.query(
      `SELECT actor_id, reason FROM dashboard.activities WHERE request_id = $1 AND action = 'owner_replace_employer'`,
      [triaged.id],
    )
    expect(history.rows).toEqual([{ actor_id: 'owner', reason: 'تعارض منافع' }])

    // The earlier employer cannot return to this round, and the new one is replaceable in turn.
    const back = await replaceEmployer(app, 'owner', triaged.id, { employerId: 'employer-1', reason: 'بازگشت' })
    expect(back.status).toBe(409)
    expect(back.body.error).toBe('previously_assigned')
    const again = await replaceEmployer(app, 'owner', triaged.id, { employerId: 'employer-3', reason: 'مرخصی طولانی' })
    expect(again.status).toBe(200)
    expect(again.body.round.replacements.map((item: { newUserId: string }) => item.newUserId)).toEqual(['employer-2', 'employer-3'])
    expect(await activeUsers(triaged.id)).toEqual(['employer-3', 'reviewer-1', 'reviewer-2', 'reviewer-3'])
  })

  it('keeps the owner-chosen employer for the next round of the same case', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)
    expect((await replaceEmployer(app, 'owner', triaged.id, { employerId: 'employer-2', reason: 'تعارض منافع' })).status).toBe(200)

    // A corrected proposal is a new revision accepted again at triage.
    const next = triaged.revision + 1
    await pool.query(
      `INSERT INTO dashboard.request_proposals (request_id, revision, form_version, application_team, proposal_documents)
       VALUES ($1, $2, 'event-application-2026-v1', '[]', '[]')`,
      [triaged.id, next],
    )
    await pool.query(`UPDATE dashboard.requests SET revision = $2, review_stage = 'triaged' WHERE id = $1`, [triaged.id, next])

    const candidates = await request(app).get(`/requests/${triaged.id}/review-round/candidates`).set(auth('chief'))
    expect(candidates.body.employerId).toBe('employer-2')
    // The earlier revision's round does not narrow the pick for the new round.
    expect(idsOf(candidates).sort()).toEqual(['reviewer-1', 'reviewer-2', 'reviewer-3', 'reviewer-4', 'reviewer-5'])
    const second = await request(app)
      .post(`/requests/${triaged.id}/review-round`)
      .set(auth('chief'))
      .send({ reviewerIds: ['reviewer-3', 'reviewer-4', 'reviewer-5'], expectedRevision: next })
    expect(second.status).toBe(201)
    expect(second.body.round.employerId).toBe('employer-2')
    expect(await activeUsers(triaged.id)).toEqual(['employer-2', 'reviewer-3', 'reviewer-4', 'reviewer-5'])
    // The earlier round and its replacement history are still there.
    const rounds = await pool.query('SELECT 1 FROM dashboard.review_replacements WHERE request_id = $1', [triaged.id])
    expect(rounds.rowCount).toBe(1)
  })

  it('serializes competing replacements of the same reviewer', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)

    const results = await Promise.all([
      replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', { replacementId: 'reviewer-4' }),
      replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', { replacementId: 'reviewer-5' }),
    ])
    expect(results.map((res) => res.status).sort()).toEqual([200, 404])
    expect(await activeUsers(triaged.id)).toHaveLength(4)
    expect((await pool.query('SELECT 1 FROM dashboard.review_replacements WHERE request_id = $1', [triaged.id])).rowCount).toBe(1)
  })

  it('waits for a finalization in progress and then refuses the replacement', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)

    // Hold the share lock a finalization takes, with the final evaluation written but not committed.
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT 1 FROM dashboard.requests WHERE id = $1 FOR SHARE', [triaged.id])
      await client.query(
        `INSERT INTO dashboard.evaluations (request_id, user_id, role, variant, state, revision, finalized_at)
         VALUES ($1, 'reviewer-1', 'reviewer', 'ordinary', 'final', $2, now())`,
        [triaged.id, triaged.revision],
      )
      const pending = replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', { replacementId: 'reviewer-4' }).then((res) => res)
      await new Promise((resolve) => setTimeout(resolve, 300))
      await client.query('COMMIT')
      const res = await pending
      expect(res.status).toBe(409)
      expect(res.body.error).toBe('evaluation_final')
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      client.release()
    }
    expect(await activeUsers(triaged.id)).toEqual(['employer-1', 'reviewer-1', 'reviewer-2', 'reviewer-3'])
  })

  it('keeps replaced round slots out of the generic owner assignment commands', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', { replacementId: 'reviewer-4' })).status).toBe(200)

    const revoke = await request(app)
      .delete(`/admin/requests/${triaged.id}/assignments/reviewer-4`)
      .set(auth('owner'))
      .send({ reason: 'x' })
    expect(revoke.status).toBe(409)
    expect(revoke.body.error).toBe('managed_by_review_round')
    const listing = await request(app).get(`/admin/requests/${triaged.id}/assignments`).set(auth('owner'))
    expect(listing.body.items.filter((item: { roundId: string | null }) => item.roundId)).toHaveLength(5)
  })

  it('enforces replacement history rules in the database', async () => {
    const app = await makeApp()
    const event = await createEvent(app, 'chief', ['پردازش تصویر'])
    const triaged = await roundCase(app, event)
    expect((await replaceReviewer(app, 'chief', triaged.id, 'reviewer-1', { replacementId: 'reviewer-4' })).status).toBe(200)
    const row = (
      await pool.query<{ round_id: string; old_assignment_id: string; new_assignment_id: string }>(
        'SELECT round_id, old_assignment_id, new_assignment_id FROM dashboard.review_replacements WHERE request_id = $1',
        [triaged.id],
      )
    ).rows[0]!
    const insert = (slot: string, reason: string | null, oldUser = 'a', newUser = 'b', oldAssignment = row.old_assignment_id) =>
      pool.query(
        `INSERT INTO dashboard.review_replacements
           (request_id, round_id, slot, old_assignment_id, new_assignment_id, old_user_id, new_user_id, replaced_by, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'owner', $8)`,
        [triaged.id, row.round_id, slot, oldAssignment, row.new_assignment_id, oldUser, newUser, reason],
      )

    // An assignment is replaced at most once, the people must differ and an employer change needs its reason.
    await expect(insert('ordinary', null)).rejects.toMatchObject({ code: '23505' })
    await expect(insert('ordinary', null, 'a', 'a')).rejects.toMatchObject({ code: '23514' })
    await expect(insert('employer', null)).rejects.toMatchObject({ code: '23514' })
    await expect(insert('employer', '  ')).rejects.toMatchObject({ code: '23514' })
    await expect(
      pool.query(
        `INSERT INTO dashboard.activities (owner_id, request_id, type, title, actor_id, action, reason, from_state, to_state, revision)
         VALUES ('company-user-1', $1, 'transition', 't', 'owner', 'owner_replace_employer', NULL, 'in_review', 'in_review', 1)`,
        [triaged.id],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })
})
