import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { FINANCIAL_CATEGORIES } from '../../src/access/policy.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { PostgresVerificationStore } from '../../src/dashboard/verification-repo.js'
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

// Each stage has its own spec. These walk one case across the stages, so a branch
// taken early is checked against what it must and must not open later.

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString, application_name: 't43-workflow-branches' })
const verifications = new PostgresVerificationStore(pool)

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'employer-1', phone: 'employer-1', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'employer-2', phone: 'employer-2', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'reviewer-1', phone: 'reviewer-1', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-2', phone: 'reviewer-2', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-3', phone: 'reviewer-3', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-4', phone: 'reviewer-4', operationalRole: 'reviewer', isActive: true },
  { id: 'secretariat', phone: 'secretariat', operationalRole: 'central-secretariat', isActive: true },
]

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'T43-company-1', representativeId: 'company-user-1', establishmentDate: '2010' },
])

const lastCompleted = new Date().getUTCFullYear() - 1
const YEARS = [lastCompleted - 2, lastCompleted - 1, lastCompleted]
const OTHER_CATEGORIES = FINANCIAL_CATEGORIES.filter((category) => category !== 'financialStatements')

const auth = (id: string) => ({
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
const REASON = 'بودجه پروپوزال باید بازنگری شود'
const INTERNAL_MEMO = 'متن محرمانه یادداشت سرمایه‌گذاری'
const PUBLIC_TEXT = 'متن نتیجه برای شرکت'

const scores = {
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

const ordinaryAnswers = {
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

const employerAnswers = {
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

const post = (app: App, user: string, path: string, body: unknown = {}) =>
  request(app).post(path).set(auth(user)).send(body as object)
const get = (app: App, user: string, path: string) => request(app).get(path).set(auth(user))

const upload = (app: App, id: string, category: string, filename: string, statementYear?: number) => {
  const pending = request(app)
    .post('/documents')
    .set(auth('company-user-1'))
    .field('category', category)
    .field('requestId', id)
  if (statementYear !== undefined) pending.field('statementYear', String(statementYear))
  return pending.attach('file', Buffer.from(`%PDF-1.4 ${filename}`), { filename, contentType: 'application/pdf' })
}

const triage = (app: App, id: string, body: Record<string, unknown>) => post(app, 'chief', `/requests/${id}/triage`, body)
const decide = (app: App, id: string, body: Record<string, unknown>) => post(app, 'chief', `/requests/${id}/review-decision`, body)
const finalize = (app: App, user: string, id: string, revision: number) =>
  post(app, user, `/requests/${id}/evaluation/finalize`, {
    revision,
    scores,
    answers: user.startsWith('employer') ? employerAnswers : ordinaryAnswers,
  })

async function finalizeAll(app: App, id: string, revision: number, people: string[]) {
  for (const user of people) expect((await finalize(app, user, id, revision)).status, user).toBe(200)
}

const caseState = async (id: string) =>
  (
    await pool.query<{ status: string; review_stage: string; revision: number }>(
      'SELECT status::text AS status, review_stage, revision FROM dashboard.requests WHERE id = $1',
      [id],
    )
  ).rows[0]

const actions = async (id: string) =>
  (
    await pool.query<{ action: string }>(
      'SELECT action FROM dashboard.activities WHERE request_id = $1 ORDER BY at, id',
      [id],
    )
  ).rows.map((row) => row.action)

async function cleanup() {
  const files = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.rfp_files')).rows
  const docFiles = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all([...files, ...docFiles].map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)))
  await clearVerifiedCompanies(pool)
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id = 'company-user-1'")
}

/** A draft of company-user-1 with its proposal uploaded, on an event of chief and employer-1. */
async function draftCase(app: App) {
  const eventRes = await post(app, 'owner', '/admin/events', {
    title: 'رویداد هوش مصنوعی ۲۰۲۶',
    description: 'توضیحات رویداد',
    registrationOpenAt: '2020-01-01T00:00:00Z',
    registrationCloseAt: '2099-01-01T00:00:00Z',
    responsibleChiefId: 'chief',
    responsibleInvestmentId: 'investment',
  })
  expect(eventRes.status).toBe(201)
  const eventId = eventRes.body.event.id as string
  const catRes = await post(app, 'owner', `/admin/events/${eventId}/categories`, { title: 'دسته هوش مصنوعی' })
  const subtopicRes = await post(app, 'owner', `/admin/events/${eventId}/subtopics`, {
    title: 'پردازش تصویر',
    categoryId: catRes.body.category.id,
    employerId: 'employer-1',
  })
  const subtopicId = subtopicRes.body.subtopic.id as string
  const rfpRes = await request(app)
    .post(`/admin/events/${eventId}/subtopics/${subtopicId}/rfp`)
    .set(auth('owner'))
    .field('expectedVersionId', '')
    .field('reason', 'نسخه اولیه')
    .attach('files', Buffer.from('%PDF-Initial-RFP'), { filename: 'rfp.pdf', contentType: 'application/pdf' })
  expect(rfpRes.status).toBe(201)

  const created = await post(app, 'company-user-1', '/requests', {
    serviceId: 'event-service',
    title: 'طرح سامانه بینایی ماشین',
    answers: { applicationTeam: [{ name: 'سارا حسینی', role: 'مدیر پروژه' }], summary: 'خلاصه اولیه' },
    eventId,
    subtopicId,
    rfpVersionId: rfpRes.body.version.id,
  })
  expect(created.status).toBe(201)
  const id = created.body.request.id as string
  expect((await upload(app, id, 'proposal', 'proposal.pdf')).status).toBe(201)
  return id
}

async function submittedCase(app: App) {
  const id = await draftCase(app)
  const submitted = await post(app, 'company-user-1', `/requests/${id}/submit`, consent)
  expect(submitted.status).toBe(200)
  return { id, revision: submitted.body.request.revision as number }
}

async function startRound(app: App, id: string, revision: number, reviewerIds = THREE) {
  const started = await post(app, 'chief', `/requests/${id}/review-round`, { reviewerIds, expectedRevision: revision })
  expect(started.status).toBe(201)
  return started
}

/** A submitted case accepted at triage with a started round of employer-1 and reviewers 1-3. */
async function roundCase(app: App) {
  const { id, revision: submitted } = await submittedCase(app)
  const accepted = await triage(app, id, { action: 'accept', expectedRevision: submitted })
  expect(accepted.status).toBe(200)
  const revision = accepted.body.request.revision as number
  await startRound(app, id, revision)
  return { id, revision }
}

/** The company corrects a returned case and the chief accepts the new revision at triage. */
async function correctAndAccept(app: App, id: string, summary = 'خلاصه اصلاح‌شده') {
  const patched = await request(app)
    .patch(`/requests/${id}`)
    .set(auth('company-user-1'))
    .send({ answers: { applicationTeam: [{ name: 'سارا حسینی', role: 'مدیر پروژه' }], summary } })
  expect(patched.status).toBe(200)
  const resubmitted = await post(app, 'company-user-1', `/requests/${id}/resubmit`, consent)
  expect(resubmitted.status).toBe(200)
  const accepted = await triage(app, id, { action: 'accept', expectedRevision: resubmitted.body.request.revision })
  expect(accepted.status).toBe(200)
  return accepted.body.request.revision as number
}

const uploadOtherCategories = async (app: App, id: string, categories: readonly string[] = OTHER_CATEGORIES) => {
  for (const category of categories) expect((await upload(app, id, category, `${category}.pdf`)).status, category).toBe(201)
}

const uploadStatements = async (app: App, id: string, years: number[] = YEARS) => {
  for (const year of years) expect((await upload(app, id, 'financialStatements', `statements-${year}.pdf`, year)).status).toBe(201)
}

/** Every door after the chief decision stays shut on a case the chief has not advanced. */
async function expectAfterDecisionClosed(app: App, id: string) {
  const invitation = await get(app, 'company-user-1', `/requests/${id}/financial-invitation`)
  expect(invitation.status).toBe(409)
  expect(invitation.body.error).toBe('financial_stage_not_open')
  expect((await upload(app, id, 'financialStatements', 'early.pdf', YEARS[0])).status).toBe(404)
  const pkg = await post(app, 'company-user-1', `/requests/${id}/financial-package`)
  expect(pkg.status).toBe(409)
  expect(pkg.body.error).toBe('financial_stage_not_open')
  expect((await post(app, 'investment', `/investment/cases/${id}/memo`, { body: 'زودهنگام' })).status).toBe(404)
  const result = await post(app, 'secretariat', `/requests/${id}/result`, { body: PUBLIC_TEXT })
  expect(result.status).toBe(409)
  expect(result.body.error).toBe('investment_stage_closed')
  expect((await get(app, 'company-user-1', `/requests/${id}/result`)).body.result ?? null).toBeNull()
}

describe('T43: Workflow branches across stages (int)', () => {
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

  it('holds the same draft out of review until the company is approved, and again if approval is lost', async () => {
    const app = await makeApp()
    const [company] = await companyStore.list()
    const companyId = company!.id
    const id = await draftCase(app)
    await pool.query('DELETE FROM dashboard.company_verifications WHERE company_id = $1', [companyId])

    const expectRefused = async () => {
      const refused = await post(app, 'company-user-1', `/requests/${id}/submit`, consent)
      expect(refused.status).toBe(403)
      expect(refused.body.error).toBe('company_not_verified')
      expect(await caseState(id)).toMatchObject({ status: 'draft' })
      expect((await triage(app, id, { action: 'accept' })).status).not.toBe(200)
    }

    // Never submitted, waiting, and returned are all the same answer.
    await expectRefused()
    const first = await verifications.submit({ companyId, representativeId: 'company-user-1', snapshot: {} })
    if (!first.ok) throw new Error('Verification fixture failed')
    await expectRefused()
    await verifications.decide({ id: first.verification.id, action: 'return', reviewerId: 'secretariat', reason: REASON })
    await expectRefused()
    expect(await actions(id)).toEqual([])

    const second = await verifications.submit({ companyId, representativeId: 'company-user-1', snapshot: {} })
    if (!second.ok) throw new Error('Verification fixture failed')
    await verifications.decide({ id: second.verification.id, action: 'approve', reviewerId: 'secretariat' })

    const submitted = await post(app, 'company-user-1', `/requests/${id}/submit`, consent)
    expect(submitted.status).toBe(200)
    expect(submitted.body.request.id).toBe(id)
    const returned = await triage(app, id, { action: 'return', reason: REASON, expectedRevision: submitted.body.request.revision })
    expect(returned.status).toBe(200)

    // An identity change during a correction blocks the resubmit but keeps the case and the correction.
    await verifications.invalidateApproval(companyId, 'Changed registration')
    const blocked = await post(app, 'company-user-1', `/requests/${id}/resubmit`, consent)
    expect(blocked.status).toBe(403)
    expect(blocked.body.error).toBe('company_not_verified')
    expect(await caseState(id)).toMatchObject({ status: 'action_needed', revision: returned.body.request.revision })

    const third = await verifications.submit({ companyId, representativeId: 'company-user-1', snapshot: {} })
    if (!third.ok) throw new Error('Verification fixture failed')
    await verifications.decide({ id: third.verification.id, action: 'approve', reviewerId: 'secretariat' })
    expect((await post(app, 'company-user-1', `/requests/${id}/resubmit`, consent)).status).toBe(200)
    expect(await caseState(id)).toMatchObject({ status: 'in_review', review_stage: 'chief_triage' })
  })

  it('takes one case through return, correction, rejection and reopen before any review starts', async () => {
    const app = await makeApp()
    const { id, revision: submitted } = await submittedCase(app)

    const returned = await triage(app, id, { action: 'return', reason: REASON, expectedRevision: submitted })
    expect(returned.status).toBe(200)
    expect(returned.body.request.status).toBe('action_needed')
    const patched = await request(app)
      .patch(`/requests/${id}`)
      .set(auth('company-user-1'))
      .send({ answers: { applicationTeam: [{ name: 'سارا حسینی', role: 'مدیر پروژه' }], summary: 'خلاصه اصلاح‌شده' } })
    expect(patched.status).toBe(200)
    expect((await upload(app, id, 'proposal', 'proposal-corrected.pdf')).status).toBe(201)
    const resubmitted = await post(app, 'company-user-1', `/requests/${id}/resubmit`, consent)
    expect(resubmitted.status).toBe(200)
    const correctedRevision = resubmitted.body.request.revision as number

    const rejected = await triage(app, id, { action: 'reject', reason: REASON, expectedRevision: correctedRevision })
    expect(rejected.status).toBe(200)
    expect(rejected.body.request.status).toBe('rejected')

    // Rejected is closed to the company, to the chief, and to a reopen without a reason or by anyone else.
    expect((await request(app).patch(`/requests/${id}`).set(auth('company-user-1')).send({ title: 'تلاش' })).status).toBe(409)
    expect((await post(app, 'company-user-1', `/requests/${id}/resubmit`, consent)).status).toBe(409)
    expect((await triage(app, id, { action: 'accept' })).status).toBe(409)
    expect((await post(app, 'chief', `/admin/requests/${id}/reopen`, { reason: 'x' })).status).toBe(403)
    expect((await post(app, 'owner', `/admin/requests/${id}/reopen`, {})).status).toBe(400)
    await expectAfterDecisionClosed(app, id)

    const reopened = await post(app, 'owner', `/admin/requests/${id}/reopen`, { reason: 'بازبینی صاحب سیستم' })
    expect(reopened.status).toBe(200)
    expect(reopened.body.request).toMatchObject({ id, status: 'in_review', reviewStage: 'chief_triage' })

    // Reopen returns to triage and skips nothing.
    const early = await post(app, 'chief', `/requests/${id}/review-round`, { reviewerIds: THREE })
    expect(early.status).toBe(409)
    const accepted = await triage(app, id, { action: 'accept' })
    expect(accepted.status).toBe(200)
    const started = await startRound(app, id, accepted.body.request.revision)
    expect(started.body.round.proposalRevision).toBe(correctedRevision)

    // The correction stayed on this one case, with the first version still readable.
    const owned = await pool.query('SELECT id FROM dashboard.requests WHERE owner_id = $1', ['company-user-1'])
    expect(owned.rows).toEqual([{ id }])
    const proposal = await get(app, 'chief', `/requests/${id}/proposal`)
    expect(proposal.body.proposal.answers.summary).toBe('خلاصه اصلاح‌شده')
    expect(proposal.body.revisions).toEqual(expect.arrayContaining([submitted, correctedRevision]))
    const history = await actions(id)
    expect(history.filter((action) => ['chief_return', 'chief_reject', 'owner_reopen', 'chief_accept'].includes(action)))
      .toEqual(['chief_return', 'chief_reject', 'owner_reopen', 'chief_accept'])
  })

  it('carries incomplete reviews and replacements through correction rounds to one decision', async () => {
    const app = await makeApp()
    const { id, revision: firstRevision } = await roundCase(app)

    // Round one: three of four are final, and the one missing person is swapped out.
    await finalizeAll(app, id, firstRevision, ['employer-1', 'reviewer-2', 'reviewer-3'])
    const short = await decide(app, id, { action: 'advance', expectedRevision: firstRevision })
    expect(short.status).toBe(409)
    expect(short.body.error).toBe('round_not_ready')
    expect((await post(app, 'chief', `/requests/${id}/review-round/reviewers/reviewer-2/replace`, {
      replacementId: 'reviewer-4', reason: 'دیرهنگام', expectedRevision: firstRevision,
    })).status).toBe(409)
    const replaced = await post(app, 'chief', `/requests/${id}/review-round/reviewers/reviewer-1/replace`, {
      replacementId: 'reviewer-4', reason: 'عدم دسترسی', expectedRevision: firstRevision,
    })
    expect(replaced.status).toBe(200)
    expect((await finalize(app, 'reviewer-1', id, firstRevision)).status).toBe(404)
    expect((await decide(app, id, { action: 'advance', expectedRevision: firstRevision })).body.error).toBe('round_not_ready')
    await finalizeAll(app, id, firstRevision, ['reviewer-4'])

    // Complete does not mean advanced: the chief sends it back and nothing later opens.
    const returned = await decide(app, id, { action: 'return', reason: REASON, expectedRevision: firstRevision })
    expect(returned.status).toBe(200)
    await expectAfterDecisionClosed(app, id)
    const secondRevision = await correctAndAccept(app, id)
    await expectAfterDecisionClosed(app, id)

    // Round two: the owner swaps the employer mid-round, with old scores out of the count.
    const SECOND_THREE = ['reviewer-2', 'reviewer-3', 'reviewer-4']
    await startRound(app, id, secondRevision, SECOND_THREE)
    expect((await decide(app, id, { action: 'advance', expectedRevision: secondRevision })).body.error).toBe('round_not_ready')
    await finalizeAll(app, id, secondRevision, SECOND_THREE)
    const employerSwap = await post(app, 'owner', `/requests/${id}/review-round/employer/replace`, {
      employerId: 'employer-2', reason: 'تعارض منافع', expectedRevision: secondRevision,
    })
    expect(employerSwap.status).toBe(200)
    expect((await finalize(app, 'employer-1', id, secondRevision)).status).toBe(404)
    await finalizeAll(app, id, secondRevision, ['employer-2'])
    expect((await decide(app, id, { action: 'return', reason: 'اصلاح دوم', expectedRevision: secondRevision })).status).toBe(200)

    // Round three inherits the owner's employer, and only this round decides the case.
    const thirdRevision = await correctAndAccept(app, id, 'خلاصه اصلاح دوم')
    const third = await startRound(app, id, thirdRevision, SECOND_THREE)
    expect(third.body.round.slots.filter((slot: { active: boolean }) => slot.active).map((slot: { userId: string }) => slot.userId).sort())
      .toEqual(['employer-2', ...SECOND_THREE].sort())
    expect((await finalize(app, 'employer-1', id, thirdRevision)).status).toBe(404)
    await finalizeAll(app, id, thirdRevision, ['employer-2', ...SECOND_THREE])
    const advanced = await decide(app, id, { action: 'advance', expectedRevision: thirdRevision })
    expect(advanced.status).toBe(200)
    expect(advanced.body.request).toMatchObject({ id, status: 'in_review', reviewStage: 'advanced' })

    const rounds = await get(app, 'chief', `/requests/${id}/review-rounds`)
    expect(rounds.body.items.map((round: { requestRevision: number; decision: { action: string } | null }) =>
      [round.requestRevision, round.decision?.action])).toEqual([
      [thirdRevision, 'advance'],
      [secondRevision, 'return'],
      [firstRevision, 'return'],
    ])
    const finals = await pool.query<{ revision: number; count: string }>(
      `SELECT revision, COUNT(*) AS count FROM dashboard.evaluations
       WHERE request_id = $1 AND state = 'final' GROUP BY revision ORDER BY revision`,
      [id],
    )
    expect(finals.rows.map((row) => [row.revision, Number(row.count)])).toEqual([
      [firstRevision, 4],
      [secondRevision, 4],
      [thirdRevision, 4],
    ])
    expect((await actions(id)).filter((action) => action === 'chief_review_advance')).toHaveLength(1)
  })

  it('keeps a case rejected after review out of every later stage until a new round advances it', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    await expectAfterDecisionClosed(app, id)
    await finalizeAll(app, id, revision, ['employer-1', ...THREE])

    // 4/4 opens nothing by itself.
    await expectAfterDecisionClosed(app, id)

    expect((await decide(app, id, { action: 'reject', reason: REASON, expectedRevision: revision })).status).toBe(200)
    await expectAfterDecisionClosed(app, id)
    expect((await get(app, 'secretariat', '/investment/follow-ups')).body.total).toBe(0)

    // Reopening does not revive the old 4/4.
    expect((await post(app, 'owner', `/admin/requests/${id}/reopen`, { reason: 'بازبینی صاحب سیستم' })).status).toBe(200)
    await expectAfterDecisionClosed(app, id)
    expect((await decide(app, id, { action: 'advance' })).status).toBe(409)
    const accepted = await triage(app, id, { action: 'accept' })
    expect(accepted.status).toBe(200)
    const nextRevision = accepted.body.request.revision as number
    await startRound(app, id, nextRevision)
    await expectAfterDecisionClosed(app, id)
    await finalizeAll(app, id, nextRevision, ['employer-1', ...THREE])
    expect((await decide(app, id, { action: 'advance', expectedRevision: nextRevision })).status).toBe(200)

    // Only now does the company see the invitation.
    expect((await get(app, 'company-user-1', `/requests/${id}/financial-invitation`)).status).toBe(200)
  })

  it('moves from missing financial documents through memo and follow-up to a published result', async () => {
    const app = await makeApp()
    const { id, revision: firstRevision } = await roundCase(app)
    await finalizeAll(app, id, firstRevision, ['employer-1', ...THREE])
    expect((await decide(app, id, { action: 'return', reason: REASON, expectedRevision: firstRevision })).status).toBe(200)
    const revision = await correctAndAccept(app, id)
    await startRound(app, id, revision)
    await finalizeAll(app, id, revision, ['employer-1', ...THREE])
    expect((await decide(app, id, { action: 'advance', expectedRevision: revision })).status).toBe(200)

    // Missing documents: the refusal names them, and nothing downstream opens.
    const [missingCategory, ...presentCategories] = OTHER_CATEGORIES
    await uploadOtherCategories(app, id, presentCategories)
    await uploadStatements(app, id, YEARS.slice(1))
    const incomplete = await post(app, 'company-user-1', `/requests/${id}/financial-package`)
    expect(incomplete.status).toBe(422)
    expect(incomplete.body).toEqual({
      error: 'financial_package_incomplete',
      missingCategories: [missingCategory],
      missingStatementYears: [YEARS[0]],
    })
    expect((await get(app, 'investment', `/investment/cases/${id}`)).status).toBe(404)
    expect((await post(app, 'investment', `/investment/cases/${id}/memo`, { body: INTERNAL_MEMO })).status).toBe(404)
    expect((await post(app, 'secretariat', `/requests/${id}/result`, { body: PUBLIC_TEXT })).body.error).toBe('investment_stage_closed')
    expect(await actions(id)).not.toContain('financial_package_submit')

    // Completing the same case hands it off once.
    await uploadOtherCategories(app, id, [missingCategory!])
    await uploadStatements(app, id, YEARS.slice(0, 1))
    expect((await post(app, 'company-user-1', `/requests/${id}/financial-package`)).status).toBe(201)
    expect((await post(app, 'company-user-1', `/requests/${id}/financial-package`)).status).not.toBe(201)
    expect((await actions(id)).filter((action) => action === 'financial_package_submit')).toHaveLength(1)
    expect((await get(app, 'investment', `/investment/cases/${id}`)).status).toBe(200)

    // The Secretariat waits for a sent memo; a saved one is not enough.
    const saved = await post(app, 'investment', `/investment/cases/${id}/memo`, { body: INTERNAL_MEMO })
    expect(saved.status).toBe(201)
    expect((await post(app, 'secretariat', `/requests/${id}/result`, { body: PUBLIC_TEXT })).body.error).toBe('memo_not_sent')
    expect((await post(app, 'investment', `/investment/cases/${id}/memo/send`, { version: saved.body.memo.version })).status).toBe(200)

    // A supplementary round trip is correspondence: it publishes nothing and moves nothing.
    const asked = await post(app, 'secretariat', `/requests/${id}/supplementary-requests`, { body: 'مدرک تکمیلی را بفرستید' })
    expect(asked.status).toBe(201)
    const reply = await upload(app, id, 'correspondenceAttachment', 'supplementary.pdf')
    expect(reply.status).toBe(201)
    expect((await post(app, 'secretariat', `/requests/${id}/supplementary-files`, { documentId: reply.body.document.id })).status).toBe(201)
    expect((await get(app, 'investment', `/documents/${reply.body.document.id}/download`)).status).toBe(200)
    expect((await get(app, 'company-user-1', `/requests/${id}/result`)).body.result).toBeNull()

    // Publication: draft stays private, the published text reaches the company without the memo.
    const draft = await post(app, 'secretariat', `/requests/${id}/result`, { body: PUBLIC_TEXT })
    expect(draft.status).toBe(201)
    expect((await get(app, 'company-user-1', `/requests/${id}/result`)).body.result).toBeNull()
    const published = await post(app, 'secretariat', `/requests/${id}/result/publish`, { version: draft.body.result.version })
    expect(published.status).toBe(200)
    expect((await get(app, 'company-user-1', `/requests/${id}/result`)).body.result)
      .toEqual({ body: PUBLIC_TEXT, publishedAt: published.body.result.publishedAt })
    expect(JSON.stringify((await get(app, 'company-user-1', `/requests/${id}`)).body)).not.toContain(INTERNAL_MEMO)

    // The published case still belongs to the Secretariat's stage: nobody can pull it back through review.
    expect(await caseState(id)).toMatchObject({ status: 'in_review', review_stage: 'advanced' })
    expect((await decide(app, id, { action: 'return', reason: REASON })).status).toBe(409)
    expect((await finalize(app, 'reviewer-1', id, revision)).status).not.toBe(200)
    expect((await post(app, 'owner', `/admin/requests/${id}/reopen`, { reason: 'x' })).status).toBe(409)
    for (const user of ['chief', 'reviewer-1', 'employer-1']) {
      const history = await get(app, user, `/requests/${id}/history`)
      expect(JSON.stringify(history.body), user).not.toContain(INTERNAL_MEMO)
    }

    const ordered = (await actions(id)).filter((action) =>
      ['chief_review_return', 'chief_review_advance', 'financial_package_submit', 'investment_memo_send', 'supplementary_request', 'supplementary_delivery', 'result_publish'].includes(action))
    expect(ordered).toEqual([
      'chief_review_return',
      'chief_review_advance',
      'financial_package_submit',
      'investment_memo_send',
      'supplementary_request',
      'supplementary_delivery',
      'result_publish',
    ])
  })
})
