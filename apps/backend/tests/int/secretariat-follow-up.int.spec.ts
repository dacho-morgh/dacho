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
const pool = new Pool({ connectionString, application_name: 't33-secretariat-follow-up' })

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'company-user-2', phone: 'company-user-2', operationalRole: 'representative', isActive: true },
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
  { name: 'شرکت فناور پیشرو', nationalId: 'T33-company-1', representativeId: 'company-user-1', establishmentDate: '2010' },
  { name: 'شرکت دیگر', nationalId: 'T33-company-2', representativeId: 'company-user-2', establishmentDate: '2011' },
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

const INTERNAL_MEMO = 'متن محرمانه یادداشت سرمایه‌گذاری'
const PUBLIC_TEXT = 'متن نتیجه برای شرکت'
const NOTICE_TITLE = 'انتشار نتیجه پرونده'

const post = (app: App, user: string, path: string, body: unknown) =>
  request(app).post(path).set(auth(user)).send(body as object)
const get = (app: App, user: string, path: string) => request(app).get(path).set(auth(user))

async function sentMemo(app: App, id: string, body = INTERNAL_MEMO) {
  const saved = await post(app, 'investment', `/investment/cases/${id}/memo`, { body })
  expect(saved.status).toBe(201)
  const sent = await post(app, 'investment', `/investment/cases/${id}/memo/send`, { version: saved.body.memo.version })
  expect(sent.status).toBe(200)
}

const uploadReply = async (app: App, id: string) => {
  const uploaded = await request(app)
    .post('/documents')
    .set(auth('company-user-1'))
    .field('category', 'correspondenceAttachment')
    .field('requestId', id)
    .attach('file', Buffer.from('%PDF-1.4 supplementary'), { filename: 'supplementary.pdf', contentType: 'application/pdf' })
  expect(uploaded.status).toBe(201)
  return uploaded.body.document.id as string
}

const historyOf = async (app: App, user: string, id: string) =>
  ((await get(app, user, `/requests/${id}/history`)).body.items as { action: string | null }[]).map((item) => item.action)

const noticesFor = async (app: App, user: string, id: string) =>
  ((await get(app, user, '/letters')).body.items as { title: string; body: string; requestId: string }[])
    .filter((letter) => letter.title === NOTICE_TITLE && letter.requestId === id)

const WRITE_PATHS = (id: string): [string, unknown][] => [
  [`/requests/${id}/supplementary-requests`, { body: 'x' }],
  [`/requests/${id}/supplementary-files`, { documentId: '00000000-0000-4000-8000-000000000000' }],
  [`/requests/${id}/result`, { body: 'x' }],
  [`/requests/${id}/result/publish`, { version: 1 }],
]

describe('T33: Secretariat follow-up and result publication (int)', () => {
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

  it('takes a case from a sent memo to a published result the company reads', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)

    // No memo yet: the Secretariat has nothing to act on.
    expect((await post(app, 'secretariat', `/requests/${id}/result`, { body: PUBLIC_TEXT })).body.error).toBe('memo_not_sent')
    expect((await post(app, 'secretariat', `/requests/${id}/supplementary-requests`, { body: 'x' })).body.error).toBe('memo_not_sent')
    expect((await get(app, 'secretariat', '/investment/follow-ups')).body.total).toBe(0)

    await sentMemo(app, id)
    const queue = await get(app, 'secretariat', '/investment/follow-ups')
    expect(queue.body.items).toEqual([expect.objectContaining({ requestId: id, latestMemoVersion: 1, publishedAt: null })])

    // Sending a memo publishes nothing.
    expect((await get(app, 'company-user-1', `/requests/${id}/result`)).body.result).toBeNull()

    const saved = await post(app, 'secretariat', `/requests/${id}/result`, { body: `  ${PUBLIC_TEXT}  ` })
    expect(saved.status).toBe(201)
    expect(saved.body.result).toMatchObject({ version: 1, body: PUBLIC_TEXT, authorId: 'secretariat', publishedAt: null })
    const retried = await post(app, 'secretariat', `/requests/${id}/result`, { body: PUBLIC_TEXT })
    expect(retried.status).toBe(200)
    expect(retried.body.result.id).toBe(saved.body.result.id)

    // A saved draft stays with the Secretariat.
    expect((await get(app, 'company-user-1', `/requests/${id}/result`)).body.result).toBeNull()
    expect(await historyOf(app, 'company-user-1', id)).not.toContain('result_save')
    expect(await historyOf(app, 'investment', id)).not.toContain('result_save')

    const published = await post(app, 'secretariat', `/requests/${id}/result/publish`, { version: 1 })
    expect(published.status).toBe(200)
    expect(published.body.result).toMatchObject({ publishedBy: 'secretariat' })
    expect(published.body.result.publishedAt).toEqual(expect.any(String))
    expect(published.body.result.sourceMemoId).toEqual(expect.any(String))

    // The company gets the disclosed text and time, and nothing that points at the memo.
    const company = await get(app, 'company-user-1', `/requests/${id}/result`)
    expect(company.status).toBe(200)
    expect(company.body.result).toEqual({ body: PUBLIC_TEXT, publishedAt: published.body.result.publishedAt })
    expect(JSON.stringify((await get(app, 'company-user-1', `/requests/${id}`)).body)).not.toContain(INTERNAL_MEMO)

    // One notice in the company's mailbox, holding no memo text.
    const notices = await noticesFor(app, 'company-user-1', id)
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({ requestId: id })
    expect(notices[0]!.body).not.toContain(INTERNAL_MEMO)

    // A repeat changes nothing and sends nothing further.
    const repeat = await post(app, 'secretariat', `/requests/${id}/result/publish`, { version: 1 })
    expect(repeat.status).toBe(200)
    expect(repeat.body.result.publishedAt).toBe(published.body.result.publishedAt)
    expect(await noticesFor(app, 'company-user-1', id)).toHaveLength(1)

    // Publication decides nothing on the case.
    expect((await get(app, 'owner', `/requests/${id}`)).body.request).toMatchObject({ status: 'in_review', reviewStage: 'advanced' })

    expect((await get(app, 'secretariat', '/investment/follow-ups')).body.items[0].publishedAt).toBe(published.body.result.publishedAt)
    const companyHistory = await historyOf(app, 'company-user-1', id)
    expect(companyHistory).toContain('result_publish')
    expect(companyHistory).not.toContain('investment_memo_send')
  })

  it('never publishes a replaced version and keeps earlier publications in the history', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    await sentMemo(app, id)

    await post(app, 'secretariat', `/requests/${id}/result`, { body: 'نسخه نخست' })
    await post(app, 'secretariat', `/requests/${id}/result`, { body: 'نسخه دوم' })
    const stale = await post(app, 'secretariat', `/requests/${id}/result/publish`, { version: 1 })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toBe('result_version_stale')
    expect((await get(app, 'company-user-1', `/requests/${id}/result`)).body.result).toBeNull()
    expect((await post(app, 'secretariat', `/requests/${id}/result/publish`, { version: 9 })).status).toBe(404)
    expect((await post(app, 'secretariat', `/requests/${id}/result/publish`, { version: 2 })).status).toBe(200)

    // A correction is a new version: the company keeps reading the old text until it is published.
    await post(app, 'secretariat', `/requests/${id}/result`, { body: 'نسخه اصلاحی' })
    expect((await get(app, 'company-user-1', `/requests/${id}/result`)).body.result.body).toBe('نسخه دوم')
    expect((await post(app, 'secretariat', `/requests/${id}/result/publish`, { version: 3 })).status).toBe(200)
    expect((await get(app, 'company-user-1', `/requests/${id}/result`)).body.result.body).toBe('نسخه اصلاحی')
    expect(await noticesFor(app, 'company-user-1', id)).toHaveLength(2)

    const followUp = await get(app, 'secretariat', `/requests/${id}/follow-up`)
    expect(followUp.body.results.map((item: { version: number; publishedAt: string | null }) => [item.version, Boolean(item.publishedAt)]))
      .toEqual([[3, true], [2, true], [1, false]])
  })

  it('requests documents as correspondence and opens only delivered files to the holder', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    await sentMemo(app, id)
    const ask = 'صورت حساب سال گذشته را بفرستید'

    const asked = await post(app, 'secretariat', `/requests/${id}/supplementary-requests`, { body: ask })
    expect(asked.status).toBe(201)
    const again = await post(app, 'secretariat', `/requests/${id}/supplementary-requests`, { body: ask })
    expect(again.status).toBe(200)
    expect(again.body.supplementaryRequest.id).toBe(asked.body.supplementaryRequest.id)

    // The company receives one actionable letter, not a result.
    const letters = (await get(app, 'company-user-1', '/letters')).body.items as { body: string; requestId: string }[]
    const letter = letters.filter((item) => item.body === ask)
    expect(letter).toHaveLength(1)
    expect(letter[0]!.requestId).toBe(id)
    expect((await get(app, 'company-user-1', `/requests/${id}/result`)).body.result).toBeNull()
    expect((await get(app, 'company-user-1', `/requests/${id}/supplementary-requests`)).body.items)
      .toEqual([{ id: asked.body.supplementaryRequest.id, body: ask, createdAt: expect.any(String) }])

    const documentId = await uploadReply(app, id)

    // Uploaded but not delivered: the holder cannot read it, the Secretariat can.
    expect((await get(app, 'investment', `/documents/${documentId}/download`)).status).toBe(404)
    expect((await get(app, 'investment', `/investment/cases/${id}`)).body.supplementaryFiles).toEqual([])
    expect((await get(app, 'secretariat', `/documents/${documentId}/download`)).status).toBe(200)
    const before = await get(app, 'secretariat', `/requests/${id}/follow-up`)
    expect(before.body.files).toEqual([expect.objectContaining({ id: documentId, deliveredAt: null })])

    const delivered = await post(app, 'secretariat', `/requests/${id}/supplementary-files`, { documentId })
    expect(delivered.status).toBe(201)
    expect(delivered.body.file.deliveredAt).toEqual(expect.any(String))
    expect((await post(app, 'secretariat', `/requests/${id}/supplementary-files`, { documentId })).status).toBe(200)
    expect((await historyOf(app, 'secretariat', id)).filter((action) => action === 'supplementary_delivery')).toHaveLength(1)

    expect((await get(app, 'investment', `/documents/${documentId}/download`)).status).toBe(200)
    expect((await get(app, 'investment', `/investment/cases/${id}`)).body.supplementaryFiles)
      .toEqual([expect.objectContaining({ id: documentId, downloadUrl: `/api/dashboard/documents/${documentId}/download` })])

    // The holder can follow it with another memo.
    await sentMemo(app, id, 'یادداشت پس از مدرک تکمیلی')

    // Delivery opens nothing to anyone else on the case.
    for (const user of ['chief', 'reviewer-1', 'employer-1', 'investment-2', 'company-user-2']) {
      expect((await get(app, user, `/documents/${documentId}/download`)).status, user).toBe(404)
    }

    // Revoking the holder ends access on the next request.
    const revoked = await request(app)
      .delete(`/admin/requests/${id}/assignments/investment`)
      .set(auth('owner'))
      .send({ reason: 'reassigned' })
    expect(revoked.status).toBe(200)
    expect((await get(app, 'investment', `/documents/${documentId}/download`)).status).toBe(404)
  })

  it('delivers only correspondence files of the same case', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    await sentMemo(app, id)
    const { rows } = await pool.query<{ id: string }>(
      "SELECT id FROM dashboard.private_documents WHERE request_id = $1 AND category = 'proposal' LIMIT 1",
      [id],
    )
    expect((await post(app, 'secretariat', `/requests/${id}/supplementary-files`, { documentId: rows[0]!.id })).status).toBe(404)
    expect((await post(app, 'secretariat', `/requests/${id}/supplementary-files`, { documentId: 'nope' })).status).toBe(400)
  })

  it('keeps every command with the Secretariat and every read inside its audience', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    await sentMemo(app, id)
    await post(app, 'secretariat', `/requests/${id}/result`, { body: 'متن آماده انتشار' })

    for (const user of ['owner', 'chief', 'reviewer-1', 'employer-1', 'investment', 'company-user-1']) {
      for (const [path, body] of WRITE_PATHS(id)) {
        expect((await post(app, user, path, body)).status, `${user} ${path}`).toBe(403)
      }
    }
    for (const user of ['chief', 'reviewer-1', 'employer-1', 'investment', 'company-user-1']) {
      expect((await get(app, user, `/requests/${id}/follow-up`)).status).toBe(403)
      expect((await get(app, user, '/investment/follow-ups')).status).toBe(403)
    }
    for (const user of ['chief', 'reviewer-1', 'employer-1', 'investment']) {
      expect((await get(app, user, `/requests/${id}/supplementary-requests`)).status).toBe(403)
    }
    expect((await get(app, 'owner', `/requests/${id}/follow-up`)).body.canAct).toBe(false)
    expect((await get(app, 'secretariat', `/requests/${id}/follow-up`)).body.canAct).toBe(true)

    // Another company does not learn the case exists.
    expect((await get(app, 'company-user-2', `/requests/${id}/result`)).status).toBe(404)
    expect((await get(app, 'company-user-2', `/requests/${id}/supplementary-requests`)).status).toBe(404)

    // An assigned reader sees the text only after publication.
    expect((await get(app, 'chief', `/requests/${id}/result`)).body.result).toBeNull()
    expect((await post(app, 'secretariat', `/requests/${id}/result/publish`, { version: 1 })).status).toBe(200)
    expect((await get(app, 'chief', `/requests/${id}/result`)).body.result.body).toBe('متن آماده انتشار')
    expect((await get(app, 'investment', `/requests/${id}/result`)).body.result.body).toBe('متن آماده انتشار')
  })

  it('hides the follow-up history from the chief and reviewers', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    await sentMemo(app, id)
    await post(app, 'secretariat', `/requests/${id}/supplementary-requests`, { body: 'مدرک بفرستید' })
    const documentId = await uploadReply(app, id)
    await post(app, 'secretariat', `/requests/${id}/supplementary-files`, { documentId })

    for (const user of ['chief', 'reviewer-1', 'employer-1']) {
      const history = await historyOf(app, user, id)
      expect(history).not.toContain('supplementary_request')
      expect(history).not.toContain('supplementary_delivery')
    }
    const company = await historyOf(app, 'company-user-1', id)
    expect(company).toContain('supplementary_request')
    expect(company).not.toContain('supplementary_delivery')
    expect(await historyOf(app, 'investment', id)).toContain('supplementary_delivery')
  })

  it('rejects invalid input and closes commands outside the open stage', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    await sentMemo(app, id)

    expect((await post(app, 'secretariat', `/requests/${id}/result`, { body: '   ' })).body.error).toBe('invalid_result')
    expect((await post(app, 'secretariat', `/requests/${id}/result`, { body: 'x'.repeat(20_001) })).status).toBe(400)
    expect((await post(app, 'secretariat', `/requests/${id}/result/publish`, { version: 'one' })).body.error).toBe('invalid_result_version')
    expect((await post(app, 'secretariat', `/requests/${id}/supplementary-requests`, {})).body.error).toBe('invalid_supplementary_request')
    expect((await post(app, 'secretariat', '/requests/not-a-uuid/result', { body: 'x' })).status).toBe(404)

    await post(app, 'secretariat', `/requests/${id}/result`, { body: 'متن' })
    await pool.query("UPDATE dashboard.requests SET status = 'approved' WHERE id = $1", [id])
    for (const [path, body] of WRITE_PATHS(id)) {
      const closed = await post(app, 'secretariat', path, body)
      expect(closed.status, path).toBe(409)
      expect(closed.body.error).toBe('investment_stage_closed')
    }
  })

  it('stays closed on a case whose package is not submitted', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app, { submit: false })
    const closed = await post(app, 'secretariat', `/requests/${id}/result`, { body: 'متن' })
    expect(closed.status).toBe(409)
    expect(closed.body.error).toBe('investment_stage_closed')
  })

  it('publishes one version when two publishes race', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    await sentMemo(app, id)
    await post(app, 'secretariat', `/requests/${id}/result`, { body: 'متن' })
    const responses = await Promise.all([
      post(app, 'secretariat', `/requests/${id}/result/publish`, { version: 1 }),
      post(app, 'secretariat', `/requests/${id}/result/publish`, { version: 1 }),
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(responses[0]!.body.result.publishedAt).toBe(responses[1]!.body.result.publishedAt)
    const jobs = await pool.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM dashboard.notification_jobs WHERE request_id = $1 AND action LIKE $2',
      [id, 'result_publish%'],
    )
    expect(jobs.rows[0]!.total).toBe(1)
  })
})
