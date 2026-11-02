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
const pool = new Pool({ connectionString, application_name: 't32-investment-memo' })

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'employer-1', phone: 'employer-1', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'investment-2', phone: 'investment-2', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'reviewer-1', phone: 'reviewer-1', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-2', phone: 'reviewer-2', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-3', phone: 'reviewer-3', operationalRole: 'reviewer', isActive: true },
  { id: 'secretariat', phone: 'secretariat', operationalRole: 'central-secretariat', isActive: true },
]

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'T32-company-1', representativeId: 'company-user-1', establishmentDate: '2010' },
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

const uploadAs = (app: App, id: string, category: string, filename: string, statementYear?: number) => {
  const upload = request(app)
    .post('/documents')
    .set(auth('company-user-1'))
    .field('category', category)
    .field('requestId', id)
  if (statementYear !== undefined) upload.field('statementYear', String(statementYear))
  return upload.attach('file', Buffer.from(`%PDF-1.4 ${filename}`), { filename, contentType: 'application/pdf' })
}

async function cleanup() {
  const docFiles = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all(docFiles.map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)))
  await clearVerifiedCompanies(pool)
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id = 'company-user-1'")
}

/** A case the chief advanced and the company completed. Without `submit`, the package is not sent. */
async function handedOffCase(app: App, options: { submit?: boolean } = {}) {
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
  const subtopicRes = await request(app)
    .post(`/admin/events/${eventId}/subtopics`)
    .set(auth('owner'))
    .send({ title: 'پردازش تصویر', categoryId: catRes.body.category.id, employerId: 'employer-1' })
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
      answers: { applicationTeam: [{ name: 'سارا حسینی', role: 'مدیر پروژه' }], summary: 'خلاصه اولیه' },
      eventId,
      subtopicId,
      rfpVersionId: rfpRes.body.version.id,
    })
  expect(created.status).toBe(201)
  const id = created.body.request.id as string
  expect((await uploadAs(app, id, 'proposal', 'proposal.pdf')).status).toBe(201)
  const submitted = await request(app)
    .post(`/requests/${id}/submit`)
    .set(auth('company-user-1'))
    .send({
      nonCompeteAcceptance: { accepted: true, textVersionId: CURRENT_NON_COMPETE_VERSION },
      eventRulesAcceptance: { accepted: true, textVersionId: CURRENT_EVENT_RULES_VERSION },
    })
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
  for (const user of FOUR) {
    const finalized = await request(app)
      .post(`/requests/${id}/evaluation/finalize`)
      .set(auth(user))
      .send({ revision, scores, answers: user.startsWith('employer') ? employerAnswers : ordinaryAnswers })
    expect(finalized.status).toBe(200)
  }
  const advanced = await request(app)
    .post(`/requests/${id}/review-decision`)
    .set(auth('chief'))
    .send({ action: 'advance', expectedRevision: revision })
  expect(advanced.status).toBe(200)
  for (const category of OTHER_CATEGORIES) {
    expect((await uploadAs(app, id, category, `${category}.pdf`)).status).toBe(201)
  }
  for (const year of YEARS) {
    expect((await uploadAs(app, id, 'financialStatements', `statements-${year}.pdf`, year)).status).toBe(201)
  }
  if (options.submit !== false) {
    expect((await request(app).post(`/requests/${id}/financial-package`).set(auth('company-user-1'))).status).toBe(201)
  }
  return id
}

const saveMemo = (app: App, user: string, id: string, body: unknown) =>
  request(app).post(`/investment/cases/${id}/memo`).set(auth(user)).send({ body })
const sendMemo = (app: App, user: string, id: string, version: unknown) =>
  request(app).post(`/investment/cases/${id}/memo/send`).set(auth(user)).send({ version })
const caseMemos = (app: App, user: string, id: string) =>
  request(app).get(`/requests/${id}/investment-memos`).set(auth(user))
const dossierOf = (app: App, user: string, id: string) => request(app).get(`/investment/cases/${id}`).set(auth(user))
const historyOf = async (app: App, user: string, id: string) =>
  ((await request(app).get(`/requests/${id}/history`).set(auth(user))).body.items as { action: string | null }[])
    .map((item) => item.action)

describe('T32: Investment memo (int)', () => {
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

  it('saves versions and sends the latest to the Secretariat with its author and time', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)

    const first = await saveMemo(app, 'investment', id, '  پیش‌نویس نخست  ')
    expect(first.status).toBe(201)
    expect(first.body.memo).toMatchObject({ requestId: id, version: 1, body: 'پیش‌نویس نخست', authorId: 'investment', sentAt: null })

    // A retry of the same text stores nothing; new text is a new version and the old one stays.
    const retried = await saveMemo(app, 'investment', id, 'پیش‌نویس نخست')
    expect(retried.status).toBe(200)
    expect(retried.body.memo.id).toBe(first.body.memo.id)
    expect((await saveMemo(app, 'investment', id, 'متن نهایی')).body.memo.version).toBe(2)

    // A draft does not reach the Secretariat; the owner oversees it.
    expect((await caseMemos(app, 'secretariat', id)).body.items).toEqual([])
    expect((await request(app).get('/investment/memos').set(auth('secretariat'))).body.total).toBe(0)
    expect((await caseMemos(app, 'owner', id)).body.items.map((memo: { version: number }) => memo.version)).toEqual([2, 1])

    // A stale screen cannot send replaced text.
    const stale = await sendMemo(app, 'investment', id, 1)
    expect(stale.status).toBe(409)
    expect(stale.body.error).toBe('memo_version_stale')

    const sent = await sendMemo(app, 'investment', id, 2)
    expect(sent.status).toBe(200)
    expect(sent.body.memo.sentAt).toEqual(expect.any(String))
    const again = await sendMemo(app, 'investment', id, 2)
    expect(again.status).toBe(200)
    expect(again.body.memo.sentAt).toBe(sent.body.memo.sentAt)

    const inbox = await request(app).get('/investment/memos').set(auth('secretariat'))
    expect(inbox.status).toBe(200)
    expect(inbox.headers['cache-control']).toContain('no-store')
    expect(inbox.body.total).toBe(1)
    expect(inbox.body.items[0]).toMatchObject({
      requestId: id,
      version: 2,
      body: 'متن نهایی',
      authorId: 'investment',
      authorName: expect.any(String),
      sentAt: sent.body.memo.sentAt,
      companyName: 'شرکت فناور پیشرو',
    })
    const received = await caseMemos(app, 'secretariat', id)
    expect(received.body.items.map((memo: { version: number }) => memo.version)).toEqual([2])

    // A later correction is a new version; what was sent stays as it was.
    expect((await saveMemo(app, 'investment', id, 'متن اصلاح‌شده')).body.memo.version).toBe(3)
    expect((await caseMemos(app, 'secretariat', id)).body.items).toHaveLength(1)
    expect((await caseMemos(app, 'secretariat', id)).body.items[0].body).toBe('متن نهایی')
    const dossier = await dossierOf(app, 'investment', id)
    expect(dossier.body.memos.map((memo: { version: number }) => memo.version)).toEqual([3, 2, 1])

    const history = await historyOf(app, 'owner', id)
    expect(history.filter((action) => action === 'investment_memo_save')).toHaveLength(3)
    expect(history.filter((action) => action === 'investment_memo_send')).toHaveLength(1)
  })

  it('carries no decision: the case does not move and no decision command exists', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    const before = await request(app).get(`/requests/${id}`).set(auth('owner'))

    await saveMemo(app, 'investment', id, 'متن یادداشت')
    await sendMemo(app, 'investment', id, 1)

    const after = await request(app).get(`/requests/${id}`).set(auth('owner'))
    expect(after.body.request).toMatchObject({
      status: before.body.request.status,
      reviewStage: before.body.request.reviewStage,
      revision: before.body.request.revision,
    })
    const held = await request(app).get(`/requests/${id}`).set(auth('investment'))
    expect(held.body.allowedActions ?? held.body.request.allowedActions).toEqual(['read'])
    for (const action of ['approve', 'reject', 'return', 'vote']) {
      const decided = await request(app).post(`/investment/cases/${id}/${action}`).set(auth('investment')).send({})
      expect(decided.status).toBe(404)
    }
  })

  it('keeps the memo from everyone outside its audience', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    await saveMemo(app, 'investment', id, 'محرمانه')
    await sendMemo(app, 'investment', id, 1)

    for (const user of ['company-user-1', 'chief', 'reviewer-1', 'employer-1']) {
      expect((await saveMemo(app, user, id, 'نفوذ')).status).toBe(403)
      expect((await sendMemo(app, user, id, 1)).status).toBe(403)
      expect((await caseMemos(app, user, id)).status).toBe(403)
      expect((await request(app).get('/investment/memos').set(auth(user))).status).toBe(403)
      const history = await historyOf(app, user, id)
      expect(history).not.toContain('investment_memo_save')
      expect(history).not.toContain('investment_memo_send')
      const detail = await request(app).get(`/requests/${id}`).set(auth(user))
      expect(JSON.stringify(detail.body)).not.toContain('محرمانه')
    }
    // Another investment person does not hold the case, and the holder has no inbox of their own.
    expect((await saveMemo(app, 'investment-2', id, 'نفوذ')).status).toBe(404)
    expect((await sendMemo(app, 'investment-2', id, 1)).status).toBe(404)
    expect((await request(app).get('/investment/memos').set(auth('investment'))).status).toBe(403)
    expect((await caseMemos(app, 'investment', id)).status).toBe(403)
    // The Secretariat receives; it does not write.
    expect((await saveMemo(app, 'secretariat', id, 'نفوذ')).status).toBe(403)
  })

  it('needs the handoff, valid text and a version the actor wrote', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app, { submit: false })
    expect((await saveMemo(app, 'investment', id, 'زودهنگام')).status).toBe(404)

    expect((await request(app).post(`/requests/${id}/financial-package`).set(auth('company-user-1'))).status).toBe(201)
    for (const body of ['', '   ', 12, null, 'x'.repeat(20_001)]) {
      const rejected = await saveMemo(app, 'investment', id, body)
      expect(rejected.status).toBe(400)
      expect(rejected.body.error).toBe('invalid_memo')
    }
    for (const version of [0, -1, '1', 1.5, null]) {
      expect((await sendMemo(app, 'investment', id, version)).status).toBe(400)
    }
    expect((await sendMemo(app, 'investment', id, 1)).status).toBe(404)
    expect((await saveMemo(app, 'investment', 'not-a-uuid', 'متن')).status).toBe(404)
  })

  it('closes on reassignment, keeps the history, and hides the old holder\'s draft from the new one', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    await saveMemo(app, 'investment', id, 'متن ارسال‌شده')
    await sendMemo(app, 'investment', id, 1)
    await saveMemo(app, 'investment', id, 'پیش‌نویس باز')

    const revoked = await request(app)
      .delete(`/admin/requests/${id}/assignments/investment`)
      .set(auth('owner'))
      .send({ reason: 'جابجایی' })
    expect(revoked.status).toBe(200)
    expect((await saveMemo(app, 'investment', id, 'پس از لغو')).status).toBe(404)
    expect((await sendMemo(app, 'investment', id, 2)).status).toBe(404)

    const granted = await request(app)
      .post(`/admin/requests/${id}/assignments`)
      .set(auth('owner'))
      .send({ userId: 'investment-2', role: 'investment-reviewer' })
    expect(granted.status).toBe(201)

    const dossier = await dossierOf(app, 'investment-2', id)
    expect(dossier.status).toBe(200)
    expect(dossier.body.memos.map((memo: { version: number }) => memo.version)).toEqual([1])
    // The old holder's draft cannot be sent by anyone else.
    expect((await sendMemo(app, 'investment-2', id, 2)).status).toBe(404)

    const next = await saveMemo(app, 'investment-2', id, 'متن مسئول جدید')
    expect(next.body.memo).toMatchObject({ version: 3, authorId: 'investment-2' })
    expect((await sendMemo(app, 'investment-2', id, 3)).status).toBe(200)
    expect((await caseMemos(app, 'owner', id)).body.items.map((memo: { authorId: string }) => memo.authorId))
      .toEqual(['investment-2', 'investment', 'investment'])
  })

  it('closes writes once the case leaves the stage, and two racing saves take separate versions', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)

    const raced = await Promise.all([saveMemo(app, 'investment', id, 'یک'), saveMemo(app, 'investment', id, 'دو')])
    expect(raced.map((res) => res.status)).toEqual([201, 201])
    expect(raced.map((res) => res.body.memo.version).sort()).toEqual([1, 2])

    await pool.query("UPDATE dashboard.requests SET review_stage = 'triaged' WHERE id = $1", [id])
    const closed = await saveMemo(app, 'investment', id, 'دیرهنگام')
    expect(closed.status).toBe(409)
    expect(closed.body.error).toBe('investment_stage_closed')
    expect((await sendMemo(app, 'investment', id, 2)).status).toBe(409)
    expect((await dossierOf(app, 'investment', id)).body.memos).toHaveLength(2)
  })
})
