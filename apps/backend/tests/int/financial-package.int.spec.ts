import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { FINANCIAL_CATEGORIES } from '../../src/access/policy.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { FINANCIAL_CHECKLIST_VERSION } from '../../src/dashboard/financial-invitation.js'
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
const pool = new Pool({ connectionString, application_name: 't30-financial-package' })

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'company-user-2', phone: 'company-user-2', operationalRole: 'representative', isActive: true },
  { id: 'employer-1', phone: 'employer-1', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'reviewer-1', phone: 'reviewer-1', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-2', phone: 'reviewer-2', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-3', phone: 'reviewer-3', operationalRole: 'reviewer', isActive: true },
  { id: 'secretariat', phone: 'secretariat', operationalRole: 'central-secretariat', isActive: true },
]

// Established in 2010: the package must cover the last three completed years.
const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'T30-company-1', representativeId: 'company-user-1', establishmentDate: '2010' },
  { name: 'شرکت فناور دیگر', nationalId: 'T30-company-2', representativeId: 'company-user-2', establishmentDate: '2010' },
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
const FOUR = ['employer-1', ...THREE]

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

const finalize = (app: App, user: string, id: string, revision: number) =>
  request(app)
    .post(`/requests/${id}/evaluation/finalize`)
    .set(auth(user))
    .send({ revision, scores: scores(), answers: user.startsWith('employer') ? employerAnswers() : ordinaryAnswers() })

const decide = (app: App, id: string, body: Record<string, unknown>) =>
  request(app).post(`/requests/${id}/review-decision`).set(auth('chief')).send(body)

const submitPackage = (app: App, user: string, id: string) =>
  request(app).post(`/requests/${id}/financial-package`).set(auth(user))

const readPackage = (app: App, user: string, id: string) =>
  request(app).get(`/requests/${id}/financial-package`).set(auth(user))

const uploadAs = (app: App, user: string, id: string, category: string, filename: string, statementYear?: number) => {
  const upload = request(app)
    .post('/documents')
    .set(auth(user))
    .field('category', category)
    .field('requestId', id)
  if (statementYear !== undefined) upload.field('statementYear', String(statementYear))
  return upload.attach('file', Buffer.from(`%PDF-1.4 ${filename}`), { filename, contentType: 'application/pdf' })
}

/** Uploads every category, but a statement only for each year not listed in `skipYears`. */
async function uploadPackage(app: App, id: string, options: { skipCategories?: string[]; skipYears?: number[] } = {}) {
  for (const category of OTHER_CATEGORIES) {
    if (options.skipCategories?.includes(category)) continue
    expect((await uploadAs(app, 'company-user-1', id, category, `${category}.pdf`)).status).toBe(201)
  }
  if (options.skipCategories?.includes('financialStatements')) return
  for (const year of YEARS) {
    if (options.skipYears?.includes(year)) continue
    const statement = await uploadAs(app, 'company-user-1', id, 'financialStatements', `statements-${year}.pdf`, year)
    expect(statement.status).toBe(201)
  }
}

async function cleanup() {
  const docFiles = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all(docFiles.map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)))
  await clearVerifiedCompanies(pool)
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id IN ('company-user-1', 'company-user-2')")
}

/** A draft event application of company 1 with its proposal uploaded. */
async function draftCase(app: App) {
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
      answers: { applicationTeam: [{ name: 'سارا حسینی', role: 'مدیر پروژه' }], summary: 'خلاصه اولیه' },
      eventId,
      subtopicId,
      rfpVersionId: rfpRes.body.version.id,
    })
  expect(created.status).toBe(201)
  const id = created.body.request.id as string
  expect((await uploadAs(app, 'company-user-1', id, 'proposal', 'proposal.pdf')).status).toBe(201)
  return { id }
}

/** A case the chief advanced: the financial stage is open for company 1. */
async function advancedCase(app: App) {
  const { id } = await draftCase(app)
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
  for (const user of FOUR) expect((await finalize(app, user, id, revision)).status).toBe(200)
  const advanced = await decide(app, id, { action: 'advance', expectedRevision: revision })
  expect(advanced.status).toBe(200)
  return { id }
}

const packageRows = async (id: string) =>
  (await pool.query<{ package_version: number }>('SELECT package_version FROM dashboard.financial_packages WHERE request_id = $1', [id])).rows

describe('T30: Financial package submission (int)', () => {
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

  it('refuses to submit before the chief advances the case', async () => {
    const app = await makeApp()
    const { id } = await draftCase(app)
    const submitted = await submitPackage(app, 'company-user-1', id)
    expect(submitted.status).toBe(409)
    expect(submitted.body.error).toBe('financial_stage_not_open')
    expect(await packageRows(id)).toEqual([])
  })

  it('names every missing category and year, stores nothing, and keeps the case where it was', async () => {
    const app = await makeApp()
    const { id } = await advancedCase(app)
    await uploadPackage(app, id, { skipCategories: ['debtFacilityEvidence'], skipYears: [YEARS[0]!] })

    const incomplete = await submitPackage(app, 'company-user-1', id)
    expect(incomplete.status).toBe(422)
    expect(incomplete.body).toEqual({
      error: 'financial_package_incomplete',
      missingCategories: ['debtFacilityEvidence'],
      missingStatementYears: [YEARS[0]],
    })
    expect(await packageRows(id)).toEqual([])
    expect((await readPackage(app, 'company-user-1', id)).status).toBe(404)

    const caseRow = await pool.query<{ status: string; review_stage: string }>(
      'SELECT status::text AS status, review_stage FROM dashboard.requests WHERE id = $1',
      [id],
    )
    expect(caseRow.rows[0]).toEqual({ status: 'in_review', review_stage: 'advanced' })
  })

  it('keeps a statement without a year out of the package and rejects a malformed year', async () => {
    const app = await makeApp()
    const { id } = await advancedCase(app)
    await uploadPackage(app, id, { skipYears: [YEARS[0]!] })
    const unlabelled = await uploadAs(app, 'company-user-1', id, 'financialStatements', 'unlabelled.pdf')
    expect(unlabelled.status).toBe(201)
    expect(unlabelled.body.document.statementYear).toBeNull()

    const incomplete = await submitPackage(app, 'company-user-1', id)
    expect(incomplete.status).toBe(422)
    expect(incomplete.body.missingStatementYears).toEqual([YEARS[0]])

    const malformed = await uploadAs(app, 'company-user-1', id, 'financialStatements', 'bad.pdf', 25)
    expect(malformed.status).toBe(422)
    expect(malformed.body.error).toBe('invalid_statement_year')
  })

  it('submits a complete package once, freezes its files, and leaves the case in place', async () => {
    const app = await makeApp()
    const { id } = await advancedCase(app)
    await uploadPackage(app, id)

    const first = await submitPackage(app, 'company-user-1', id)
    expect(first.status).toBe(201)
    const pkg = first.body.package
    expect(pkg).toMatchObject({
      requestId: id,
      packageVersion: 1,
      checklistVersion: FINANCIAL_CHECKLIST_VERSION,
      statementYears: YEARS,
      submittedBy: 'company-user-1',
    })
    expect(pkg.documents).toHaveLength(OTHER_CATEGORIES.length + YEARS.length)
    expect(pkg.documents.map((document: { statementYear: number | null }) => document.statementYear).filter((year: number | null) => year !== null)).toEqual(YEARS)

    // A repeated submit returns the stored package and writes nothing.
    const again = await submitPackage(app, 'company-user-1', id)
    expect(again.status).toBe(200)
    expect(again.body.package.id).toBe(pkg.id)
    expect(await packageRows(id)).toHaveLength(1)

    const stored = await readPackage(app, 'company-user-1', id)
    expect(stored.status).toBe(200)
    expect(stored.headers['cache-control']).toContain('no-store')
    expect(stored.body.package.id).toBe(pkg.id)
    expect((await readPackage(app, 'secretariat', id)).status).toBe(200)

    // The frozen files cannot change: no new financial upload, no delete.
    expect((await uploadAs(app, 'company-user-1', id, 'financialStatements', 'late.pdf', YEARS[0])).status).toBe(404)
    const listed = await request(app).get(`/documents?requestId=${id}`).set(auth('company-user-1'))
    const debt = listed.body.items.find((item: { category: string }) => item.category === 'debtFacilityEvidence')
    expect(debt.allowedActions).not.toContain('delete')
    const deleted = await request(app).delete(`/documents/${debt.id}`).set(auth('company-user-1'))
    expect(deleted.status).toBe(403)

    // The proposal stays closed as well, and the case did not move on.
    const requestView = await request(app).get(`/requests/${id}`).set(auth('company-user-1'))
    expect(requestView.body.request.allowedActions).not.toContain('submitFinancialPackage')
    expect(requestView.body.request.allowedActions).not.toContain('uploadDocument')
    expect(requestView.body.request.reviewStage).toBe('advanced')

    const transitions = await pool.query<{ action: string }>(
      "SELECT action FROM dashboard.activities WHERE request_id = $1 AND action = 'financial_package_submit'",
      [id],
    )
    expect(transitions.rows).toHaveLength(1)
  })

  it('stores exactly one package when two submits race', async () => {
    const app = await makeApp()
    const { id } = await advancedCase(app)
    await uploadPackage(app, id)

    const results = await Promise.all([submitPackage(app, 'company-user-1', id), submitPackage(app, 'company-user-1', id)])
    expect(results.map((result) => result.status).sort()).toEqual([200, 201])
    expect(new Set(results.map((result) => result.body.package.id)).size).toBe(1)
    expect(await packageRows(id)).toHaveLength(1)
  })

  it('shows the package only to the owning company, Secretariat and the owner, and never to other companies', async () => {
    const app = await makeApp()
    const { id } = await advancedCase(app)
    await uploadPackage(app, id)
    expect((await submitPackage(app, 'company-user-1', id)).status).toBe(201)

    expect((await submitPackage(app, 'company-user-2', id)).status).toBe(404)
    expect((await readPackage(app, 'company-user-2', id)).status).toBe(404)
    expect((await submitPackage(app, 'chief', id)).status).toBe(403)
    expect((await submitPackage(app, 'secretariat', id)).status).toBe(403)
    expect((await readPackage(app, 'chief', id)).status).toBe(403)
    expect((await readPackage(app, 'investment', id)).status).toBe(403)
  })
})
