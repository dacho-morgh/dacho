import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { FINANCIAL_CATEGORIES } from '../../src/access/policy.js'
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
const pool = new Pool({ connectionString, application_name: 't38-work-queues' })

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'company-user-2', phone: 'company-user-2', operationalRole: 'representative', isActive: true },
  { id: 'employer-1', phone: 'employer-1', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'chief-2', phone: 'chief-2', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'investment-2', phone: 'investment-2', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'reviewer-1', phone: 'reviewer-1', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-2', phone: 'reviewer-2', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-3', phone: 'reviewer-3', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-4', phone: 'reviewer-4', operationalRole: 'reviewer', isActive: true },
  { id: 'secretariat', phone: 'secretariat', operationalRole: 'central-secretariat', isActive: true },
]

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'T38-company-1', representativeId: 'company-user-1', establishmentDate: '2010' },
  { name: 'شرکت دیگر', nationalId: 'T38-company-2', representativeId: 'company-user-2', establishmentDate: '2011' },
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

const THREE = ['reviewer-1', 'reviewer-2', 'reviewer-3']
const FOUR = ['employer-1', ...THREE]

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


async function cleanup() {
  const docFiles = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all(docFiles.map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)))
  await clearVerifiedCompanies(pool)
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id = 'company-user-1'")
}

const consent = {
  nonCompeteAcceptance: { accepted: true, textVersionId: CURRENT_NON_COMPETE_VERSION },
  eventRulesAcceptance: { accepted: true, textVersionId: CURRENT_EVENT_RULES_VERSION },
}

const post = (app: App, user: string, path: string, body?: unknown) =>
  request(app).post(path).set(auth(user)).send(body as object)
const get = (app: App, user: string, path: string) => request(app).get(path).set(auth(user))

const upload = (app: App, id: string, category: string, statementYear?: number, user = 'company-user-1') => {
  const sent = request(app).post('/documents').set(auth(user)).field('category', category).field('requestId', id)
  if (statementYear !== undefined) sent.field('statementYear', String(statementYear))
  return sent.attach('file', Buffer.from(`%PDF-1.4 ${category}`), {
    filename: `${category}-${statementYear ?? 0}.pdf`,
    contentType: 'application/pdf',
  })
}

async function submitCase(app: App, id: string, user = 'company-user-1') {
  expect((await upload(app, id, 'proposal', undefined, user)).status).toBe(201)
  const submitted = await post(app, user, `/requests/${id}/submit`, consent)
  expect(submitted.status).toBe(200)
  return submitted.body.request as { revision: number; trackingCode: string }
}

/** One event case on its own event, so the event filter can tell cases apart. */
async function newCase(app: App, options: { company?: string; chief?: string; title?: string; submit?: boolean } = {}) {
  const company = options.company ?? 'company-user-1'
  const eventRes = await post(app, 'owner', '/admin/events', {
    title: `رویداد ${options.title ?? 'اصلی'}`,
    description: 'توضیحات رویداد',
    registrationOpenAt: '2020-01-01T00:00:00Z',
    registrationCloseAt: '2099-01-01T00:00:00Z',
    responsibleChiefId: options.chief ?? 'chief',
    responsibleInvestmentId: 'investment',
  })
  expect(eventRes.status).toBe(201)
  const eventId = eventRes.body.event.id as string
  const category = await post(app, 'owner', `/admin/events/${eventId}/categories`, { title: 'دسته' })
  const subtopic = await post(app, 'owner', `/admin/events/${eventId}/subtopics`, {
    title: 'زیرموضوع',
    categoryId: category.body.category.id,
    employerId: 'employer-1',
  })
  const subtopicId = subtopic.body.subtopic.id as string
  const rfp = await request(app)
    .post(`/admin/events/${eventId}/subtopics/${subtopicId}/rfp`)
    .set(auth('owner'))
    .field('expectedVersionId', '')
    .field('reason', 'نسخه اولیه')
    .attach('files', Buffer.from('%PDF-Initial-RFP'), { filename: 'rfp.pdf', contentType: 'application/pdf' })
  expect(rfp.status).toBe(201)
  const created = await post(app, company, '/requests', {
    serviceId: 'event-service',
    title: options.title ?? 'طرح سامانه بینایی ماشین',
    answers: { applicationTeam: [{ name: 'سارا حسینی', role: 'مدیر پروژه' }], summary: 'خلاصه' },
    eventId,
    subtopicId,
    rfpVersionId: rfp.body.version.id,
  })
  expect(created.status).toBe(201)
  const id = created.body.request.id as string
  const submitted = options.submit === false ? null : await submitCase(app, id, company)
  return { id, eventId, revision: submitted?.revision ?? 0, trackingCode: submitted?.trackingCode ?? '' }
}

async function acceptCase(app: App, id: string, expectedRevision: number) {
  const accepted = await post(app, 'chief', `/requests/${id}/triage`, { action: 'accept', expectedRevision })
  expect(accepted.status).toBe(200)
  return accepted.body.request.revision as number
}

async function startRound(app: App, id: string, expectedRevision: number) {
  expect((await post(app, 'chief', `/requests/${id}/review-round`, { reviewerIds: THREE, expectedRevision })).status).toBe(201)
}

async function finalize(app: App, id: string, user: string, revision: number) {
  const answers = user.startsWith('employer') ? employerAnswers : ordinaryAnswers
  expect((await post(app, user, `/requests/${id}/evaluation/finalize`, { revision, scores, answers })).status).toBe(200)
}

async function advance(app: App, id: string, expectedRevision: number) {
  expect((await post(app, 'chief', `/requests/${id}/review-decision`, { action: 'advance', expectedRevision })).status).toBe(200)
}

async function submitPackage(app: App, id: string) {
  for (const category of OTHER_CATEGORIES) expect((await upload(app, id, category)).status).toBe(201)
  for (const year of YEARS) expect((await upload(app, id, 'financialStatements', year)).status).toBe(201)
  expect((await post(app, 'company-user-1', `/requests/${id}/financial-package`)).status).toBe(201)
}

async function sendMemo(app: App, id: string, body: string) {
  const saved = await post(app, 'investment', `/investment/cases/${id}/memo`, { body })
  expect(saved.status).toBe(201)
  expect((await post(app, 'investment', `/investment/cases/${id}/memo/send`, { version: saved.body.memo.version })).status).toBe(200)
}

const countOf = async (app: App, user: string, key: string) => {
  const res = await get(app, user, '/stats/overview')
  expect(res.status).toBe(200)
  return (res.body.queues as { key: string; count: number }[]).find((queue) => queue.key === key)?.count
}

/** The acceptance rule: a queue's count is the size of its list, read as that person. */
async function expectQueue(app: App, user: string, key: string, ids: string[]) {
  const list = await get(app, user, `/requests?queue=${key}&limit=100`)
  expect(list.status).toBe(200)
  expect((list.body.items as { id: string }[]).map((item) => item.id).sort()).toEqual([...ids].sort())
  expect(list.body.total).toBe(ids.length)
  expect(await countOf(app, user, key)).toBe(ids.length)
  expect((await get(app, user, `/stats?queue=${key}`)).body.total).toBe(ids.length)
}

const clearOtherWork = async () => {
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id = 'company-user-2'")
  await pool.query('DELETE FROM dashboard.support_tickets')
}

describe('T38: scoped queues, counts and overview (int)', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await cleanup()
    await clearOtherWork()
    await seedVerifiedCompanies(pool, companyStore)
  })

  afterEach(async () => {
    await cleanup()
    await clearOtherWork()
  })

  afterAll(async () => {
    await pool.end()
  })

  it("moves one case through each role's queue as its real state changes", async () => {
    const app = await makeApp()
    const { id } = await newCase(app, { submit: false })

    await expectQueue(app, 'company-user-1', 'company_draft', [id])
    let revision = (await submitCase(app, id)).revision
    await expectQueue(app, 'company-user-1', 'company_draft', [])
    await expectQueue(app, 'chief', 'chief_triage', [id])

    const returned = await post(app, 'chief', `/requests/${id}/triage`, { action: 'return', reason: 'نیاز به اصلاح', expectedRevision: revision })
    expect(returned.status).toBe(200)
    await expectQueue(app, 'chief', 'chief_triage', [])
    await expectQueue(app, 'company-user-1', 'company_correction', [id])

    expect((await upload(app, id, 'proposal')).status).toBe(201)
    const resubmitted = await post(app, 'company-user-1', `/requests/${id}/resubmit`, consent)
    expect(resubmitted.status).toBe(200)
    revision = resubmitted.body.request.revision as number
    await expectQueue(app, 'company-user-1', 'company_correction', [])
    await expectQueue(app, 'chief', 'chief_triage', [id])

    revision = await acceptCase(app, id, revision)
    await expectQueue(app, 'chief', 'chief_triage', [])
    await expectQueue(app, 'chief', 'chief_start_review', [id])

    await startRound(app, id, revision)
    await expectQueue(app, 'chief', 'chief_start_review', [])
    await expectQueue(app, 'chief', 'chief_decide', [])
    for (const user of FOUR) await expectQueue(app, user, 'evaluation_pending', [id])

    // A draft is still owed work. Only a person's own final removes it, and only for them.
    expect((await request(app).put(`/requests/${id}/evaluation`).set(auth('reviewer-1')).send({ revision, scores, answers: {} })).status).toBe(200)
    await expectQueue(app, 'reviewer-1', 'evaluation_pending', [id])
    await finalize(app, id, 'reviewer-1', revision)
    await expectQueue(app, 'reviewer-1', 'evaluation_pending', [])
    await expectQueue(app, 'reviewer-2', 'evaluation_pending', [id])

    for (const user of FOUR.filter((person) => person !== 'reviewer-1')) await finalize(app, id, user, revision)
    await expectQueue(app, 'chief', 'chief_decide', [id])

    await advance(app, id, revision)
    await expectQueue(app, 'chief', 'chief_decide', [])
    await expectQueue(app, 'company-user-1', 'company_financial_package', [id])
    await expectQueue(app, 'investment', 'memo_pending', [])

    await submitPackage(app, id)
    await expectQueue(app, 'company-user-1', 'company_financial_package', [])
    await expectQueue(app, 'investment', 'memo_pending', [id])
    await expectQueue(app, 'secretariat', 'follow_up_unpublished', [])

    await sendMemo(app, id, 'یادداشت اول')
    await expectQueue(app, 'investment', 'memo_pending', [])
    await expectQueue(app, 'secretariat', 'follow_up_unpublished', [id])

    expect((await post(app, 'secretariat', `/requests/${id}/supplementary-requests`, { body: 'مدارک تکمیلی' })).status).toBe(201)
    await expectQueue(app, 'company-user-1', 'company_supplementary', [id])
    await expectQueue(app, 'secretariat', 'supplementary_undelivered', [])

    const reply = await upload(app, id, 'correspondenceAttachment')
    expect(reply.status).toBe(201)
    await expectQueue(app, 'company-user-1', 'company_supplementary', [])
    await expectQueue(app, 'secretariat', 'supplementary_undelivered', [id])

    expect((await post(app, 'secretariat', `/requests/${id}/supplementary-files`, { documentId: reply.body.document.id })).status).toBe(201)
    await expectQueue(app, 'secretariat', 'supplementary_undelivered', [])
    // A delivered file reopens the memo, and a new one closes it again.
    await expectQueue(app, 'investment', 'memo_pending', [id])
    await sendMemo(app, id, 'یادداشت دوم')
    await expectQueue(app, 'investment', 'memo_pending', [])

    const saved = await post(app, 'secretariat', `/requests/${id}/result`, { body: 'نتیجه' })
    expect(saved.status).toBe(201)
    await expectQueue(app, 'secretariat', 'follow_up_unpublished', [id])
    expect((await post(app, 'secretariat', `/requests/${id}/result/publish`, { version: saved.body.result.version })).status).toBe(200)
    await expectQueue(app, 'secretariat', 'follow_up_unpublished', [])
  })

  it('offers the owner a rejected case to reopen', async () => {
    const app = await makeApp()
    const { id, revision } = await newCase(app)
    await expectQueue(app, 'owner', 'reopen_rejected', [])
    expect((await post(app, 'chief', `/requests/${id}/triage`, { action: 'reject', reason: 'خارج از موضوع', expectedRevision: revision })).status).toBe(200)
    await expectQueue(app, 'owner', 'reopen_rejected', [id])
    await expectQueue(app, 'chief', 'chief_triage', [])
  })

  it('gives each chief the cases of their own event only', async () => {
    const app = await makeApp()
    const mine = await newCase(app, { title: 'طرح سردبیر اول' })
    const other = await newCase(app, { title: 'طرح سردبیر دوم', chief: 'chief-2', company: 'company-user-2' })
    await expectQueue(app, 'chief', 'chief_triage', [mine.id])
    await expectQueue(app, 'chief-2', 'chief_triage', [other.id])
  })

  it("never lets a search or filter reach a case outside the reader's scope", async () => {
    const app = await makeApp()
    const mine = await newCase(app, { title: 'طرح پیدا' })
    const hidden = await newCase(app, { title: 'طرح پنهان', chief: 'chief-2', company: 'company-user-2' })
    const found = encodeURIComponent('پیدا')
    const hiddenTitle = encodeURIComponent('پنهان')
    const hiddenFilters = [`search=${hiddenTitle}`, `search=${encodeURIComponent(hidden.trackingCode)}`, `eventId=${hidden.eventId}`]

    for (const user of ['company-user-1', 'chief', 'reviewer-1', 'employer-1', 'investment']) {
      for (const filter of hiddenFilters) {
        const list = await get(app, user, `/requests?${filter}`)
        expect(list.status).toBe(200)
        expect(list.body).toMatchObject({ items: [], total: 0 })
        expect((await get(app, user, `/stats?${filter}`)).body.total).toBe(0)
      }
      const events = (await get(app, user, '/stats/overview')).body.events as { id: string }[]
      expect(events.map((event) => event.id)).not.toContain(hidden.eventId)
    }

    // The same filters still work inside the scope.
    const query = `search=${found}&eventId=${mine.eventId}&stage=chief_triage`
    expect((await get(app, 'company-user-1', `/requests?${query}`)).body.items.map((item: { id: string }) => item.id)).toEqual([mine.id])
    expect((await get(app, 'company-user-1', `/stats?${query}`)).body).toMatchObject({ total: 1, in_review: 1 })
    expect((await get(app, 'chief', `/admin/requests?search=${found}`)).body.items.map((item: { id: string }) => item.id)).toEqual([mine.id])
    expect((await get(app, 'chief', `/admin/requests?search=${hiddenTitle}`)).body.total).toBe(0)

    // Wildcards are literal text, not a way to list everything.
    expect((await get(app, 'owner', '/requests?search=%25')).body.total).toBe(0)
    expect((await get(app, 'owner', '/requests?search=_')).body.total).toBe(0)
    // Oversight still sees both events.
    const ownerEvents = (await get(app, 'owner', '/stats/overview')).body.events as { id: string }[]
    expect(ownerEvents.map((event) => event.id).sort()).toEqual([mine.eventId, hidden.eventId].sort())
  })

  it('drops a case from the queue on the next request once the assignment ends', async () => {
    const app = await makeApp()
    const { id, revision: submitted } = await newCase(app)
    const revision = await acceptCase(app, id, submitted)
    await startRound(app, id, revision)
    for (const user of FOUR) await finalize(app, id, user, revision)
    await advance(app, id, revision)
    await submitPackage(app, id)
    await expectQueue(app, 'investment', 'memo_pending', [id])

    const revoked = await request(app).delete(`/admin/requests/${id}/assignments/investment`).set(auth('owner')).send({ reason: 'جابجایی' })
    expect(revoked.status).toBeLessThan(300)
    await expectQueue(app, 'investment', 'memo_pending', [])
    expect((await get(app, 'investment', '/stats')).body.total).toBe(0)
  })

  it('moves the work to the new reviewer on a replacement', async () => {
    const app = await makeApp()
    const { id, revision: submitted } = await newCase(app)
    const revision = await acceptCase(app, id, submitted)
    await startRound(app, id, revision)
    await expectQueue(app, 'reviewer-1', 'evaluation_pending', [id])
    const replaced = await post(app, 'chief', `/requests/${id}/review-round/reviewers/reviewer-1/replace`, {
      replacementId: 'reviewer-4',
      reason: 'در دسترس نیست',
      expectedRevision: revision,
    })
    expect(replaced.status).toBeLessThan(300)
    await expectQueue(app, 'reviewer-1', 'evaluation_pending', [])
    await expectQueue(app, 'reviewer-4', 'evaluation_pending', [id])
  })

  it('rejects a queue of another role and malformed filters', async () => {
    const app = await makeApp()
    expect((await get(app, 'reviewer-1', '/requests?queue=chief_triage')).body.error).toBe('invalid_queue')
    expect((await get(app, 'company-user-1', '/stats?queue=memo_pending')).body.error).toBe('invalid_queue')
    expect((await get(app, 'owner', '/admin/requests?queue=nope')).body.error).toBe('invalid_queue')
    expect((await get(app, 'owner', '/requests?eventId=not-a-uuid')).body.error).toBe('invalid_event_id')
    expect((await get(app, 'owner', '/requests?stage=nope')).body.error).toBe('invalid_stage')
    expect((await get(app, 'owner', `/requests?search=${'x'.repeat(101)}`)).body.error).toBe('invalid_search')
    expect((await get(app, 'owner', '/stats?stage=nope')).status).toBe(400)
  })

  it('keeps the overview counts equal to the status lists, and each role to its own queues', async () => {
    const app = await makeApp()
    await newCase(app, { title: 'پیش‌نویس', submit: false })
    await newCase(app, { title: 'ثبت‌شده' })
    await newCase(app, { title: 'شرکت دیگر', company: 'company-user-2' })
    const keys = (body: { queues: { key: string }[] }) => body.queues.map((queue) => queue.key)

    const overview = await get(app, 'company-user-1', '/stats/overview')
    expect(overview.headers['cache-control']).toContain('no-store')
    expect(overview.body.counts).toMatchObject({ total: 2, in_review: 1 })
    expect((await get(app, 'company-user-1', '/requests')).body.total).toBe(2)
    expect((await get(app, 'company-user-1', '/requests?status=in_review')).body.total).toBe(1)
    expect(keys(overview.body)).toEqual(['company_draft', 'company_correction', 'company_financial_package', 'company_supplementary'])

    const secretariat = await get(app, 'secretariat', '/stats/overview')
    expect(secretariat.body.counts.total).toBe((await get(app, 'secretariat', '/requests')).body.total)
    expect(keys(secretariat.body)).toEqual(['follow_up_unpublished', 'supplementary_undelivered', 'verification_pending', 'support_open'])
    expect(keys((await get(app, 'owner', '/stats/overview')).body)).toEqual(['reopen_rejected', 'support_open'])
  })

  it('counts verification and support work from the lists those roles already read', async () => {
    const app = await makeApp()
    const pending = (await get(app, 'secretariat', '/admin/verifications?status=pending')).body.total as number
    expect(await countOf(app, 'secretariat', 'verification_pending')).toBe(pending)

    expect((await post(app, 'company-user-1', '/support', { subject: 'موضوع', message: 'متن پیام' })).status).toBe(201)
    expect(await countOf(app, 'secretariat', 'support_open')).toBe(1)
    expect((await get(app, 'secretariat', '/support?status=open')).body.total).toBe(1)
    expect(await countOf(app, 'owner', 'support_open')).toBe(1)
    expect(await countOf(app, 'company-user-1', 'support_open')).toBeUndefined()

    expect(await countOf(app, 'company-user-1', 'company_verification_returned')).toBeUndefined()
    await pool.query("UPDATE dashboard.company_verifications SET status = 'returned' WHERE representative_id = 'company-user-1'")
    expect(await countOf(app, 'company-user-1', 'company_verification_returned')).toBe(1)
    expect(await countOf(app, 'company-user-2', 'company_verification_returned')).toBeUndefined()
  })
})
