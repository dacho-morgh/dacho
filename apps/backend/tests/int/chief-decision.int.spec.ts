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
const pool = new Pool({ connectionString, application_name: 't28-chief-decision' })

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'employer-1', phone: 'employer-1', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'employer-2', phone: 'employer-2', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'chief-2', phone: 'chief-2', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'reviewer-1', phone: 'reviewer-1', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-2', phone: 'reviewer-2', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-3', phone: 'reviewer-3', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-4', phone: 'reviewer-4', operationalRole: 'reviewer', isActive: true },
  { id: 'secretariat', phone: 'secretariat', operationalRole: 'central-secretariat', isActive: true },
]

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'T28-company-1', representativeId: 'company-user-1' },
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

const consent = {
  nonCompeteAcceptance: { accepted: true, textVersionId: CURRENT_NON_COMPETE_VERSION },
  eventRulesAcceptance: { accepted: true, textVersionId: CURRENT_EVENT_RULES_VERSION },
}

const THREE = ['reviewer-1', 'reviewer-2', 'reviewer-3']
const FOUR = ['employer-1', ...THREE]
const REASON = 'بودجه پروپوزال باید بازنگری شود'

function scores() {
  return {
    a: {
      technologyLevel: { tier: 'mid', score: 5 },
      interdisciplinary: 6,
      innovation: { articles: true, domesticPatentCount: 2, international: true },
      customization: 7,
      developmentMethod: { tier: 'improvement', score: 5 },
      environment: { tier: 'appropriate', score: 7 },
    },
    b: {
      developmentStage: { tier: 'industrial', score: 8 },
      addedValue: 6,
      marketReach: { tier: 'international', score: 12 },
      futureOilGasDemand: 7,
      importSubstitution: 8,
    },
    c: {
      technicalReportQuality: { tier: 'appropriate', score: 8 },
      scientificAuthorityEndorsement: 5,
      nationalStandard: 10,
      isoProductQuality: 10,
      salesContracts: 4,
    },
  }
}

function ordinaryAnswers() {
  return {
    technicalApproachClear: 'yes',
    objectivesAchievableOnTime: 'yes',
    scientificPrinciplesSound: 'yes',
    operationsDetailedRealistic: 'yes',
    resourcesListed: 'no',
    scheduleExecutable: 'yes',
    budgetBreakdown: 'yes',
    costsJustified: 'yes',
    costBenefitAnalysis: 'yes',
    environmentalImpactsIdentified: 'yes',
    environmentalMitigation: 'yes',
    riskAssessmentDone: 'yes',
    risksMitigated: 'no',
    recommendation: 'recommend',
    topFive: { answer: 'yes', rationale: 'Strong proposal with high impact.' },
  }
}

function employerAnswers() {
  return {
    risk: {
      assessment: { done: 'yes' },
      financial: { budgetSufficiency: 'no', costDrivers: 'Raw material volatility', minMaxCosts: 'Between 10M and 30M' },
      technical: { newTechnology: 'yes', teamSkills: 'yes', materialsEquipmentTimely: 'yes', productionIssues: 'Minor supply chain risks' },
      schedule: { schedule: '3 months milestone phase', supplyDelays: 'no', otherTimingFactors: 'Weather dependent' },
      legal: { permits: 'yes', localNationalCompliance: 'yes', futureIssues: 'no' },
      human: { teamSizeSkills: 'yes', tensionsConflicts: 'no', training: 'yes' },
      environment: { negativeImpacts: 'no', mitigation: 'yes' },
      stakeholders: { keyStakeholders: 'Ministry of Petroleum', support: 'yes', conflicts: 'no' },
      external: { economicPoliticalSocial: 'no', unpredictable: 'Currency fluctuations' },
    },
    recommendation: 'strongly_recommend',
    topFive: { answer: 'yes', rationale: 'Key industry fit.' },
  }
}

const evaluationBody = (user: string, revision: number) => ({
  revision,
  scores: scores(),
  answers: user.startsWith('employer') ? employerAnswers() : ordinaryAnswers(),
})

const finalize = (app: App, user: string, id: string, revision: number) =>
  request(app).post(`/requests/${id}/evaluation/finalize`).set(auth(user)).send(evaluationBody(user, revision))

const saveDraft = (app: App, user: string, id: string, revision: number) =>
  request(app).put(`/requests/${id}/evaluation`).set(auth(user)).send(evaluationBody(user, revision))

const decide = (app: App, user: string, id: string, body: Record<string, unknown>) =>
  request(app).post(`/requests/${id}/review-decision`).set(auth(user)).send(body)

const readRound = (app: App, user: string, id: string) =>
  request(app).get(`/requests/${id}/review-round`).set(auth(user))

const readRounds = (app: App, user: string, id: string) =>
  request(app).get(`/requests/${id}/review-rounds`).set(auth(user))

const readEvaluations = (app: App, user: string, id: string, revision?: number | string) =>
  request(app)
    .get(`/requests/${id}/evaluations${revision === undefined ? '' : `?revision=${revision}`}`)
    .set(auth(user))

const historyRows = async (requestId: string, action: string) =>
  (
    await pool.query<{ actor_id: string; reason: string | null; from_state: string; to_state: string; revision: number }>(
      `SELECT actor_id, reason, from_state, to_state, revision FROM dashboard.activities
       WHERE request_id = $1 AND action = $2`,
      [requestId, action],
    )
  ).rows

const notificationRecipients = async (requestId: string, action: string) =>
  (
    await pool.query<{ recipient_id: string }>(
      'SELECT recipient_id FROM dashboard.notification_jobs WHERE request_id = $1 AND action = $2',
      [requestId, action],
    )
  ).rows.map((row) => row.recipient_id)

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

const uploadProposal = (app: App, id: string, filename: string) =>
  request(app)
    .post('/documents')
    .set(auth('company-user-1'))
    .field('category', 'proposal')
    .field('requestId', id)
    .attach('file', Buffer.from(`%PDF-1.4 ${filename}`), { filename, contentType: 'application/pdf' })

/** A case of employer-1 and reviewers 1-3 with a started round. */
async function roundCase(app: App) {
  const eventRes = await request(app)
    .post('/admin/events')
    .set(auth('owner'))
    .send({
      title: 'رویداد هوش مصنوعی ۲۰۲۶',
      description: 'توضیحات رویداد',
      registrationOpenAt: '2020-01-01T00:00:00Z',
      registrationCloseAt: '2099-01-01T00:00:00Z',
      responsibleChiefId: 'chief',
      responsibleInvestmentId: 'investment',
    })
  expect(eventRes.status).toBe(201)
  const eventId = eventRes.body.event.id as string
  const catRes = await request(app)
    .post(`/admin/events/${eventId}/categories`)
    .set(auth('owner'))
    .send({ title: 'دسته هوش مصنوعی' })
  expect(catRes.status).toBe(201)
  const subtopicRes = await request(app)
    .post(`/admin/events/${eventId}/subtopics`)
    .set(auth('owner'))
    .send({ title: 'پردازش تصویر', categoryId: catRes.body.category.id, employerId: 'employer-1' })
  expect(subtopicRes.status).toBe(201)
  const subtopicId = subtopicRes.body.subtopic.id as string
  const rfpRes = await request(app)
    .post(`/admin/events/${eventId}/subtopics/${subtopicId}/rfp`)
    .set(auth('owner'))
    .field('expectedVersionId', '')
    .field('reason', 'نسخه اولیه')
    .attach('files', Buffer.from('%PDF-Initial-RFP'), { filename: 'rfp.pdf', contentType: 'application/pdf' })
  expect(rfpRes.status).toBe(201)

  const created = await request(app)
    .post('/requests')
    .set(auth('company-user-1'))
    .send({
      serviceId: 'event-service',
      title: 'طرح سامانه بینایی ماشین',
      answers: {
        applicationTeam: [
          { name: 'سارا حسینی', role: 'مدیر پروژه' },
          { name: 'رضا کمالی', role: 'متخصص یادگیری ماشین' },
        ],
        summary: 'خلاصه اولیه',
      },
      eventId,
      subtopicId,
      rfpVersionId: rfpRes.body.version.id,
    })
  expect(created.status).toBe(201)
  const id = created.body.request.id as string
  expect((await uploadProposal(app, id, 'proposal.pdf')).status).toBe(201)
  const submitted = await request(app).post(`/requests/${id}/submit`).set(auth('company-user-1')).send(consent)
  expect(submitted.status).toBe(200)
  const accepted = await request(app)
    .post(`/requests/${id}/triage`)
    .set(auth('chief'))
    .send({ action: 'accept', expectedRevision: submitted.body.request.revision })
  expect(accepted.status).toBe(200)
  const revision = accepted.body.request.revision as number
  const started = await request(app)
    .post(`/requests/${id}/review-round`)
    .set(auth('chief'))
    .send({ reviewerIds: THREE, expectedRevision: revision })
  expect(started.status).toBe(201)
  return { id, revision }
}

async function completeRound(app: App, id: string, revision: number, people = FOUR) {
  for (const user of people) expect((await finalize(app, user, id, revision)).status).toBe(200)
}

/** Return after 4/4, correct and resubmit as the company, and accept at triage again. */
async function correctAndRetriage(app: App, id: string, revision: number) {
  const returned = await decide(app, 'chief', id, { action: 'return', reason: REASON, expectedRevision: revision })
  expect(returned.status).toBe(200)
  const patch = await request(app)
    .patch(`/requests/${id}`)
    .set(auth('company-user-1'))
    .send({ answers: { applicationTeam: [{ name: 'سارا حسینی', role: 'مدیر پروژه' }], summary: 'خلاصه اصلاح‌شده' } })
  expect(patch.status).toBe(200)
  expect((await uploadProposal(app, id, 'proposal-corrected.pdf')).status).toBe(201)
  const resubmitted = await request(app).post(`/requests/${id}/resubmit`).set(auth('company-user-1')).send(consent)
  expect(resubmitted.status).toBe(200)
  const accepted = await request(app)
    .post(`/requests/${id}/triage`)
    .set(auth('chief'))
    .send({ action: 'accept', expectedRevision: resubmitted.body.request.revision })
  expect(accepted.status).toBe(200)
  return {
    returnedRevision: returned.body.request.revision as number,
    resubmittedRevision: resubmitted.body.request.revision as number,
    revision: accepted.body.request.revision as number,
  }
}

describe('T28: Chief decision and correction rounds (int)', () => {
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

  it('needs the explicit decision after 4/4 and refuses it on an unfinished round', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)

    for (const user of THREE) expect((await finalize(app, user, id, revision)).status).toBe(200)
    const early = await decide(app, 'chief', id, { action: 'advance', expectedRevision: revision })
    expect(early.status).toBe(409)
    expect(early.body.error).toBe('round_not_ready')
    const chiefEarly = await request(app).get(`/requests/${id}`).set(auth('chief'))
    expect(chiefEarly.body.request).toMatchObject({ status: 'in_review', reviewStage: 'triaged', revision })
    expect(chiefEarly.body.request.allowedActions).toEqual(['read', 'replaceReviewer'])

    expect((await finalize(app, 'employer-1', id, revision)).status).toBe(200)
    // 4/4 by itself moves nothing: only the action becomes available.
    const chiefReady = await request(app).get(`/requests/${id}`).set(auth('chief'))
    expect(chiefReady.body.request).toMatchObject({ status: 'in_review', reviewStage: 'triaged', revision })
    expect(chiefReady.body.request.allowedActions).toEqual(['read', 'decideReview'])
    expect(await historyRows(id, 'chief_review_advance')).toEqual([])
    const queue = await request(app).get('/admin/requests').set(auth('chief'))
    const listed = queue.body.items.find((item: { id: string }) => item.id === id)
    expect(listed.allowedActions).toEqual(['read', 'decideReview'])
  })

  it('advances once on the explicit action, records it on the round and tells the company', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    await completeRound(app, id, revision)

    const advanced = await decide(app, 'chief', id, { action: 'advance', reason: 'ignored', expectedRevision: revision })
    expect(advanced.status).toBe(200)
    expect(advanced.body.request).toMatchObject({ status: 'in_review', reviewStage: 'advanced', revision: revision + 1 })
    expect(advanced.body.request.allowedActions).toEqual(['read'])

    expect(await historyRows(id, 'chief_review_advance')).toEqual([
      { actor_id: 'chief', reason: null, from_state: 'in_review', to_state: 'in_review', revision: revision + 1 },
    ])
    expect(await notificationRecipients(id, 'chief_review_advance')).toEqual(['company-user-1'])

    const round = await readRound(app, 'chief', id)
    expect(round.body.round.decision).toMatchObject({ action: 'advance', decidedBy: 'chief', reason: null })
    expect(round.body.round.decision.decidedAt).toEqual(expect.any(String))
    expect(round.body.round.completion).toMatchObject({ finalized: 4, ready: false })

    // A second click, a stale page or another action changes nothing.
    const again = await decide(app, 'chief', id, { action: 'advance', expectedRevision: revision + 1 })
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('invalid_decision_state')
    expect((await decide(app, 'chief', id, { action: 'reject', reason: REASON })).status).toBe(409)
    expect(await historyRows(id, 'chief_review_advance')).toHaveLength(1)

    // The reviewers' finished work stays theirs to read and nobody can write into the advanced case.
    expect((await saveDraft(app, 'reviewer-1', id, revision + 1)).body.error).toBe('stale_evaluation')
    expect((await finalize(app, 'reviewer-1', id, revision)).body.error).toBe('stale_evaluation')
    const own = await request(app).get(`/requests/${id}/evaluation`).set(auth('reviewer-1'))
    expect(own.body.revision).toBe(revision)
    expect(own.body.evaluation).toMatchObject({ state: 'final', revision })
    const reviewerQueue = await request(app).get('/review/queue?view=closed').set(auth('reviewer-1'))
    expect(reviewerQueue.body.items.map((item: { requestId: string }) => item.requestId)).toEqual([id])

    // The chief still reads the four evaluations of the decided round.
    const list = await readEvaluations(app, 'chief', id, revision)
    expect(list.body).toMatchObject({ revision, completedCount: 4, readyForChiefDecision: false })
    expect(list.body.items).toHaveLength(4)
    const current = await readEvaluations(app, 'chief', id)
    expect(current.body).toMatchObject({ revision: revision + 1, items: [], completedCount: 0, readyForChiefDecision: false })
  })

  it('keeps a hand-made grant from writing into an advanced case', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    await completeRound(app, id, revision)
    expect((await decide(app, 'chief', id, { action: 'advance' })).status).toBe(200)

    const granted = await request(app)
      .post(`/admin/requests/${id}/assignments`)
      .set(auth('owner'))
      .send({ userId: 'reviewer-4', role: 'reviewer' })
    expect(granted.status).toBe(201)
    const late = await saveDraft(app, 'reviewer-4', id, revision + 1)
    expect(late.status).toBe(409)
    expect(late.body.error).toBe('stale_evaluation')
    const queue = await request(app).get('/review/queue?view=open').set(auth('reviewer-4'))
    expect(queue.body.items).toEqual([])
  })

  it('builds a new revision and round from a correction and keeps the old scores out of it', async () => {
    const app = await makeApp()
    const { id, revision: firstRevision } = await roundCase(app)
    await completeRound(app, id, firstRevision)
    const before = await readEvaluations(app, 'chief', id)
    expect(before.body.completedCount).toBe(4)

    const { returnedRevision, resubmittedRevision, revision } = await correctAndRetriage(app, id, firstRevision)
    expect(returnedRevision).toBe(firstRevision + 1)
    expect(resubmittedRevision).toBe(firstRevision + 2)
    expect(revision).toBe(firstRevision + 3)
    expect(await historyRows(id, 'chief_review_return')).toEqual([
      { actor_id: 'chief', reason: REASON, from_state: 'in_review', to_state: 'action_needed', revision: returnedRevision },
    ])
    expect(await notificationRecipients(id, 'chief_review_return')).toEqual(['company-user-1'])

    // The same application, not a new one, and with its own proposal revision.
    const company = await request(app).get(`/requests/${id}`).set(auth('company-user-1'))
    expect(company.body.request).toMatchObject({ id, status: 'in_review', reviewStage: 'triaged', revision })
    const proposal = await request(app).get(`/requests/${id}/proposal`).set(auth('chief'))
    expect(proposal.body.proposal.revision).toBe(resubmittedRevision)
    expect(proposal.body.revisions).toEqual(expect.arrayContaining([resubmittedRevision]))
    expect(proposal.body.proposal.answers.summary).toBe('خلاصه اصلاح‌شده')

    // The new revision has no round and no count until the chief starts one.
    const chiefView = await request(app).get(`/requests/${id}`).set(auth('chief'))
    expect(chiefView.body.request.allowedActions).toEqual(['read', 'startReview'])
    const between = await readEvaluations(app, 'chief', id)
    expect(between.body).toMatchObject({ revision, completedCount: 0, readyForChiefDecision: false })
    expect(between.body.items).toEqual([])
    expect((await decide(app, 'chief', id, { action: 'advance', expectedRevision: revision })).body.error).toBe('round_not_ready')

    // A superseded person is dropped; the others are picked again and start clean.
    const started = await request(app)
      .post(`/requests/${id}/review-round`)
      .set(auth('chief'))
      .send({ reviewerIds: ['reviewer-2', 'reviewer-3', 'reviewer-4'], expectedRevision: revision })
    expect(started.status).toBe(201)
    expect(started.body.round).toMatchObject({
      requestRevision: revision,
      proposalRevision: resubmittedRevision,
      decision: null,
    })
    expect(started.body.round.completion).toEqual({ required: 4, finalized: 0, ready: false, completedAt: null })

    // Old evaluations and old slots cannot touch the new count.
    expect((await finalize(app, 'reviewer-1', id, revision)).status).toBe(404)
    expect((await finalize(app, 'reviewer-1', id, firstRevision)).status).toBe(404)
    expect((await request(app).get(`/review/cases/${id}`).set(auth('reviewer-1'))).status).toBe(404)
    expect((await finalize(app, 'reviewer-2', id, firstRevision)).body.error).toBe('stale_evaluation')
    const fresh = await request(app).get(`/requests/${id}/evaluation`).set(auth('reviewer-2'))
    expect(fresh.body).toEqual({ evaluation: null, revision })

    const NEW_FOUR = ['employer-1', 'reviewer-2', 'reviewer-3', 'reviewer-4']
    for (const [index, user] of NEW_FOUR.entries()) {
      const progress = await readRound(app, 'chief', id)
      expect(progress.body.round.completion).toMatchObject({ finalized: index, ready: false })
      expect((await decide(app, 'chief', id, { action: 'advance' })).body.error).toBe('round_not_ready')
      expect((await finalize(app, user, id, revision)).status).toBe(200)
    }
    const ready = await readRound(app, 'chief', id)
    expect(ready.body.round.completion).toMatchObject({ finalized: 4, ready: true })

    // Both rounds and both sets of scores remain readable to oversight, separately.
    for (const user of ['chief', 'owner', 'secretariat']) {
      const rounds = await readRounds(app, user, id)
      expect(rounds.status, user).toBe(200)
      expect(rounds.body.items.map((round: { requestRevision: number }) => round.requestRevision)).toEqual([revision, firstRevision])
      const [newest, oldest] = rounds.body.items
      expect(newest.decision).toBeNull()
      expect(newest.supersededAt).toBeNull()
      expect(oldest.decision).toMatchObject({ action: 'return', decidedBy: 'chief', reason: REASON })
      expect(oldest.supersededAt).toEqual(expect.any(String))
      expect(oldest.proposalRevision).toBeLessThan(newest.proposalRevision)
      expect(oldest.completion).toMatchObject({ finalized: 4, ready: false })
      expect(oldest.slots.every((slot: { active: boolean; revokeReason: string }) =>
        !slot.active && slot.revokeReason === 'superseded_by_new_round')).toBe(true)

      const oldList = await readEvaluations(app, user, id, firstRevision)
      expect(oldList.status, user).toBe(200)
      expect(oldList.body).toMatchObject({ revision: firstRevision, completedCount: 4, readyForChiefDecision: false })
      expect(oldList.body.items.map((item: { userId: string }) => item.userId).sort()).toEqual([...FOUR].sort())
      expect(oldList.body.items.every((item: { state: string; scores: unknown }) => item.state === 'final' && item.scores)).toBe(true)
      const newList = await readEvaluations(app, user, id)
      expect(newList.body).toMatchObject({ revision, completedCount: 4, readyForChiefDecision: true })
      expect(newList.body.items.map((item: { userId: string }) => item.userId).sort()).toEqual([...NEW_FOUR].sort())
    }

    // The new round is decided on its own.
    const decided = await decide(app, 'chief', id, { action: 'advance', expectedRevision: revision })
    expect(decided.status).toBe(200)
    expect(decided.body.request).toMatchObject({ reviewStage: 'advanced', revision: revision + 1 })
  })

  it('stops old slots at every point between the return and the new round', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    await completeRound(app, id, revision)

    const returned = await decide(app, 'chief', id, { action: 'return', reason: REASON })
    expect(returned.status).toBe(200)
    const returnedRevision = returned.body.request.revision as number
    expect(returned.body.request).toMatchObject({ status: 'action_needed', reviewStage: 'chief_triage' })

    // Returned: not in review, for the old or the new revision.
    expect((await finalize(app, 'reviewer-1', id, revision)).body.error).toBe('stale_evaluation')
    expect((await saveDraft(app, 'reviewer-1', id, returnedRevision)).body.error).toBe('stale_evaluation')

    const patch = await request(app).patch(`/requests/${id}`).set(auth('company-user-1')).send({ title: 'عنوان اصلاح‌شده' })
    expect(patch.status).toBe(200)
    const resubmitted = await request(app).post(`/requests/${id}/resubmit`).set(auth('company-user-1')).send(consent)
    expect(resubmitted.status).toBe(200)
    const resubmittedRevision = resubmitted.body.request.revision as number
    expect(resubmitted.body.request).toMatchObject({ status: 'in_review', reviewStage: 'chief_triage' })

    // Back in review on a newer revision: the round does not cover it, so the write guard refuses.
    const forward = await saveDraft(app, 'reviewer-1', id, resubmittedRevision)
    expect(forward.status).toBe(409)
    expect(forward.body.error).toBe('stale_evaluation')
    const rows = await pool.query('SELECT 1 FROM dashboard.evaluations WHERE request_id = $1 AND revision = $2', [id, resubmittedRevision])
    expect(rows.rowCount).toBe(0)

    // The reviewer still reads exactly what was reviewed, never the correction in progress.
    const reviewCase = await request(app).get(`/review/cases/${id}`).set(auth('reviewer-1'))
    expect(reviewCase.status).toBe(200)
    expect(reviewCase.body.proposal.revision).toBeLessThan(resubmittedRevision)
    const own = await request(app).get(`/requests/${id}/evaluation`).set(auth('reviewer-1'))
    expect(own.body.evaluation).toMatchObject({ state: 'final', revision })
  })

  it('rejects with a required reason, and the owner reopen leads to a new round', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    await completeRound(app, id, revision)

    for (const reason of [undefined, '', '   ', 7]) {
      for (const action of ['reject', 'return']) {
        const res = await decide(app, 'chief', id, { action, reason, expectedRevision: revision })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('reason_required')
      }
    }

    const rejected = await decide(app, 'chief', id, { action: 'reject', reason: `  ${REASON} `, expectedRevision: revision })
    expect(rejected.status).toBe(200)
    expect(rejected.body.request).toMatchObject({ status: 'rejected', reviewStage: 'chief_triage', revision: revision + 1 })
    expect(await historyRows(id, 'chief_review_reject')).toEqual([
      { actor_id: 'chief', reason: REASON, from_state: 'in_review', to_state: 'rejected', revision: revision + 1 },
    ])
    expect(await notificationRecipients(id, 'chief_review_reject')).toEqual(['company-user-1'])
    const round = await readRound(app, 'chief', id)
    expect(round.body.round.decision).toMatchObject({ action: 'reject', reason: REASON })

    const company = await request(app).get(`/requests/${id}`).set(auth('company-user-1'))
    expect(company.body.request.allowedActions).toEqual(['read'])

    const reopened = await request(app).post(`/admin/requests/${id}/reopen`).set(auth('owner')).send({ reason: 'بازبینی صاحب سیستم' })
    expect(reopened.status).toBe(200)
    expect(reopened.body.request).toMatchObject({ status: 'in_review', reviewStage: 'chief_triage' })
    const accepted = await request(app).post(`/requests/${id}/triage`).set(auth('chief')).send({ action: 'accept' })
    expect(accepted.status).toBe(200)
    const nextRevision = accepted.body.request.revision as number
    const started = await request(app)
      .post(`/requests/${id}/review-round`)
      .set(auth('chief'))
      .send({ reviewerIds: THREE, expectedRevision: nextRevision })
    expect(started.status).toBe(201)
    expect(started.body.round.completion.finalized).toBe(0)
  })

  it('lets only the responsible chief decide and validates the request', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    await completeRound(app, id, revision)
    const body = { action: 'advance', expectedRevision: revision }

    for (const user of ['owner', 'secretariat', 'reviewer-1', 'employer-1', 'investment', 'company-user-1']) {
      const res = await decide(app, user, id, body)
      expect(res.status, user).toBe(403)
    }
    expect((await decide(app, 'chief-2', id, body)).status).toBe(404)

    expect((await decide(app, 'chief', id, { action: 'approve' })).body.error).toBe('invalid_action')
    expect((await decide(app, 'chief', id, {})).body.error).toBe('invalid_action')
    expect((await decide(app, 'chief', id, { action: 'advance', expectedRevision: 'x' })).body.error).toBe('invalid_revision')
    const stale = await decide(app, 'chief', id, { action: 'advance', expectedRevision: revision - 1 })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toBe('stale_revision')
    expect((await decide(app, 'chief', 'not-a-uuid', body)).status).toBe(404)
    expect((await decide(app, 'chief', '00000000-0000-4000-8000-000000000000', body)).status).toBe(404)

    const round = await readRound(app, 'chief', id)
    expect(round.body.round.decision).toBeNull()
    expect(round.body.round.completion.ready).toBe(true)
  })

  it('refuses a decision while the owner has taken completion back', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    await completeRound(app, id, revision)

    const replaced = await request(app)
      .post(`/requests/${id}/review-round/employer/replace`)
      .set(auth('owner'))
      .send({ employerId: 'employer-2', reason: 'تعارض منافع', expectedRevision: revision })
    expect(replaced.status).toBe(200)

    const refused = await decide(app, 'chief', id, { action: 'advance', expectedRevision: revision })
    expect(refused.status).toBe(409)
    expect(refused.body.error).toBe('round_not_ready')
    const chiefView = await request(app).get(`/requests/${id}`).set(auth('chief'))
    expect(chiefView.body.request.allowedActions).toEqual(['read', 'replaceReviewer'])

    expect((await finalize(app, 'employer-2', id, revision)).status).toBe(200)
    const decided = await decide(app, 'chief', id, { action: 'advance', expectedRevision: revision })
    expect(decided.status).toBe(200)

    // After the decision the owner can no longer reopen the panel.
    const late = await request(app)
      .post(`/requests/${id}/review-round/employer/replace`)
      .set(auth('owner'))
      .send({ employerId: 'employer-1', reason: 'دیرهنگام' })
    expect(late.status).toBe(409)
    expect(late.body.error).toBe('invalid_round_state')
  })

  it('takes exactly one of two decisions made at the same moment', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    await completeRound(app, id, revision)

    const results = await Promise.all([
      decide(app, 'chief', id, { action: 'advance', expectedRevision: revision }),
      decide(app, 'chief', id, { action: 'return', reason: REASON, expectedRevision: revision }),
      decide(app, 'chief', id, { action: 'reject', reason: REASON, expectedRevision: revision }),
    ])
    expect(results.map((res) => res.status).sort()).toEqual([200, 409, 409])

    const decisions = await pool.query(
      `SELECT action FROM dashboard.activities
       WHERE request_id = $1 AND action IN ('chief_review_advance', 'chief_review_return', 'chief_review_reject')`,
      [id],
    )
    expect(decisions.rowCount).toBe(1)
    const jobs = await pool.query(
      `SELECT 1 FROM dashboard.notification_jobs
       WHERE request_id = $1 AND action IN ('chief_review_advance', 'chief_review_return', 'chief_review_reject')`,
      [id],
    )
    expect(jobs.rowCount).toBe(1)
    const current = await request(app).get(`/requests/${id}`).set(auth('chief'))
    expect(current.body.request.revision).toBe(revision + 1)
  })

  it('keeps the decision and round history from reviewers, the company and other chiefs', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    await completeRound(app, id, revision)
    expect((await decide(app, 'chief', id, { action: 'return', reason: REASON })).status).toBe(200)

    for (const user of ['reviewer-1', 'employer-1', 'investment', 'company-user-1']) {
      expect((await readRounds(app, user, id)).status, user).toBe(403)
      expect((await readEvaluations(app, user, id, revision)).status, user).toBe(403)
    }
    expect((await readRounds(app, 'chief-2', id)).status).toBe(404)
    expect((await readEvaluations(app, 'chief-2', id, revision)).status).toBe(404)
    expect((await readRounds(app, 'chief', 'not-a-uuid')).status).toBe(404)
    expect((await readEvaluations(app, 'chief', id, 'x')).status).toBe(400)

    // The reviewer's own round view names no decision, and their timeline carries no reason.
    const own = await readRound(app, 'reviewer-1', id)
    expect(own.status).toBe(200)
    expect(own.body.round).not.toHaveProperty('decision')
    expect(own.body.round).not.toHaveProperty('completion')
    const reviewerHistory = await request(app).get(`/requests/${id}/history`).set(auth('reviewer-1'))
    expect(JSON.stringify(reviewerHistory.body)).not.toContain(REASON)

    // The company sees why it was returned, but not who reviewed or that 4/4 happened.
    const companyHistory = await request(app).get(`/requests/${id}/history`).set(auth('company-user-1'))
    const entries = companyHistory.body.items as { action: string; reason: string | null }[]
    expect(entries.find((entry) => entry.action === 'chief_review_return')?.reason).toBe(REASON)
    expect(entries.map((entry) => entry.action)).not.toContain('review_round_complete')
    expect(JSON.stringify(companyHistory.body)).not.toContain('reviewer-1')
  })

  it('refuses a return or rejection without a reason at the database too', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    await completeRound(app, id, revision)
    const round = await pool.query<{ id: string }>('SELECT id FROM dashboard.review_rounds WHERE request_id = $1', [id])
    const roundId = round.rows[0]!.id

    await expect(pool.query(
      `UPDATE dashboard.review_rounds SET decision = 'return', decided_by = 'chief', decided_at = now() WHERE id = $1`,
      [roundId],
    )).rejects.toMatchObject({ constraint: 'review_rounds_decision_consistent' })
    await expect(pool.query(
      `UPDATE dashboard.review_rounds SET decision = 'advance', decided_by = 'chief', decided_at = now(), completed_at = NULL WHERE id = $1`,
      [roundId],
    )).rejects.toMatchObject({ constraint: 'review_rounds_decision_consistent' })
    await expect(pool.query(
      `INSERT INTO dashboard.activities (owner_id, request_id, type, title, actor_id, action, from_state, to_state, revision)
       VALUES ('company-user-1', $1, 'transition', 'x', 'chief', 'chief_review_reject', 'in_review', 'rejected', 9)`,
      [id],
    )).rejects.toMatchObject({ constraint: 'activities_triage_reason_required' })
  })
})
