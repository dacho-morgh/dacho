import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { MigrationBuilder } from 'node-pg-migrate'
import { Pool } from 'pg'
import request from 'supertest'

import { up as backfillHandoffs } from '../../migrations/1780511400032_investment_handoff.js'
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
const pool = new Pool({ connectionString, application_name: 't31-investment-handoff' })

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
  { name: 'شرکت فناور پیشرو', nationalId: 'T31-company-1', representativeId: 'company-user-1', establishmentDate: '2010' },
  { name: 'شرکت فناور دیگر', nationalId: 'T31-company-2', representativeId: 'company-user-2', establishmentDate: '2010' },
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

const submitPackage = (app: App, id: string) =>
  request(app).post(`/requests/${id}/financial-package`).set(auth('company-user-1'))

const queueOf = (app: App, user: string) => request(app).get('/investment/queue').set(auth(user))
const dossierOf = (app: App, user: string, id: string) => request(app).get(`/investment/cases/${id}`).set(auth(user))
const historyOf = async (app: App, user: string, id: string) =>
  ((await request(app).get(`/requests/${id}/history`).set(auth(user))).body.items as { action: string | null }[])
    .map((item) => item.action)

const uploadAs = (app: App, id: string, category: string, filename: string, statementYear?: number) => {
  const upload = request(app)
    .post('/documents')
    .set(auth('company-user-1'))
    .field('category', category)
    .field('requestId', id)
  if (statementYear !== undefined) upload.field('statementYear', String(statementYear))
  return upload.attach('file', Buffer.from(`%PDF-1.4 ${filename}`), { filename, contentType: 'application/pdf' })
}

async function uploadPackage(app: App, id: string) {
  for (const category of OTHER_CATEGORIES) {
    expect((await uploadAs(app, id, category, `${category}.pdf`)).status).toBe(201)
  }
  for (const year of YEARS) {
    expect((await uploadAs(app, id, 'financialStatements', `statements-${year}.pdf`, year)).status).toBe(201)
  }
}

const investmentRows = async (id: string) =>
  (await pool.query<{ user_id: string; active: boolean; assigned_by: string; revoke_reason: string | null }>(
    `SELECT user_id, active, assigned_by, revoke_reason FROM dashboard.case_assignments
     WHERE request_id = $1 AND role = 'investment-reviewer' ORDER BY assigned_at`,
    [id],
  )).rows

async function cleanup() {
  const docFiles = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all(docFiles.map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)))
  await clearVerifiedCompanies(pool)
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id IN ('company-user-1', 'company-user-2')")
}

/** A case the chief advanced, with every financial file uploaded and nothing submitted. */
async function readyCase(app: App) {
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
  expect((await uploadAs(app, id, 'proposal', 'proposal.pdf')).status).toBe(201)
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
  const advanced = await request(app)
    .post(`/requests/${id}/review-decision`)
    .set(auth('chief'))
    .send({ action: 'advance', expectedRevision: revision })
  expect(advanced.status).toBe(200)
  await uploadPackage(app, id)
  const files = await request(app).get(`/documents?requestId=${id}`).set(auth('company-user-1'))
  const financialFile = (files.body.items as { id: string; category: string }[])
    .find((item) => item.category === 'debtFacilityEvidence')!.id
  return { id, eventId, financialFile }
}

const grant = (app: App, id: string, userId: string) =>
  request(app).post(`/admin/requests/${id}/assignments`).set(auth('owner')).send({ userId, role: 'investment-reviewer' })

describe('T31: Investment handoff and dossier (int)', () => {
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

  it('hands the case to the event person only when a complete package is submitted', async () => {
    const app = await makeApp()
    const { id, financialFile } = await readyCase(app)

    // Before the package nobody holds the case, and an incomplete submit changes nothing.
    expect(await investmentRows(id)).toEqual([])
    const removed = await request(app).delete(`/documents/${financialFile}`).set(auth('company-user-1'))
    expect(removed.status).toBe(200)
    expect((await submitPackage(app, id)).status).toBe(422)
    expect(await investmentRows(id)).toEqual([])
    expect((await queueOf(app, 'investment')).body.items).toEqual([])
    expect((await dossierOf(app, 'investment', id)).status).toBe(404)

    expect((await uploadAs(app, id, 'debtFacilityEvidence', 'debt.pdf')).status).toBe(201)
    const submitted = await submitPackage(app, id)
    expect(submitted.status).toBe(201)
    expect(await investmentRows(id)).toEqual([
      expect.objectContaining({ user_id: 'investment', active: true, assigned_by: 'system' }),
    ])

    const queue = await queueOf(app, 'investment')
    expect(queue.status).toBe(200)
    expect(queue.headers['cache-control']).toContain('no-store')
    expect(queue.body.total).toBe(1)
    expect(queue.body.items[0]).toMatchObject({
      requestId: id,
      companyName: 'شرکت فناور پیشرو',
      package: { id: submitted.body.package.id, packageVersion: 1 },
    })

    // A repeated submit neither hands off again nor writes another history row.
    expect((await submitPackage(app, id)).status).toBe(200)
    expect(await investmentRows(id)).toHaveLength(1)
    expect((await historyOf(app, 'owner', id)).filter((action) => action === 'investment_handoff')).toHaveLength(1)
  })

  it('gives the assigned person the case, the four final evaluations and the financial files', async () => {
    const app = await makeApp()
    const { id, financialFile } = await readyCase(app)
    expect((await submitPackage(app, id)).status).toBe(201)

    const dossier = await dossierOf(app, 'investment', id)
    expect(dossier.status).toBe(200)
    expect(dossier.headers['cache-control']).toContain('no-store')
    expect(dossier.body.case.requestId).toBe(id)
    expect(dossier.body.company.company.name).toBe('شرکت فناور پیشرو')
    expect(dossier.body.proposal.documents[0].downloadUrl).toContain('/documents/')
    expect(dossier.body.rfp.files[0].downloadUrl).toContain('/rfp/files/')
    expect(dossier.body.package.documents).toHaveLength(OTHER_CATEGORIES.length + YEARS.length)
    expect(dossier.body.package.statementYears).toEqual(YEARS)

    expect(dossier.body.evaluations).toHaveLength(4)
    for (const evaluation of dossier.body.evaluations) {
      expect(evaluation.state).toBe('final')
      expect(evaluation).not.toHaveProperty('userId')
    }

    const download = await request(app).get(`/documents/${financialFile}/download`).set(auth('investment'))
    expect(download.status).toBe(200)
    const listed = await request(app).get(`/documents?requestId=${id}`).set(auth('investment'))
    expect((listed.body.items as { category: string }[]).map((item) => item.category)).toEqual(
      expect.arrayContaining(FINANCIAL_CATEGORIES as unknown as string[]),
    )

    const rfp = await request(app).get(dossier.body.rfp.files[0].downloadUrl.replace('/api/dashboard', '')).set(auth('investment'))
    expect(rfp.status).toBe(200)
    const detail = await request(app).get(`/requests/${id}`).set(auth('investment'))
    expect(detail.status).toBe(200)
    expect(detail.body.request.allowedActions).toEqual(['read'])

    // Oversight history stays with oversight.
    const history = await historyOf(app, 'investment', id)
    expect(history).toEqual(expect.arrayContaining(['financial_package_submit', 'investment_handoff']))
    expect(history).not.toContain('review_round_complete')
  })

  it('leaves out an evaluation whose author no longer holds a slot', async () => {
    const app = await makeApp()
    const { id } = await readyCase(app)
    expect((await submitPackage(app, id)).status).toBe(201)
    await pool.query(
      `UPDATE dashboard.case_assignments SET active = false, revoked_by = 'owner', revoked_at = now()
       WHERE request_id = $1 AND user_id = 'reviewer-3' AND active`,
      [id],
    )
    expect((await dossierOf(app, 'investment', id)).body.evaluations).toHaveLength(3)
  })

  it('keeps financial records from everyone outside the audience', async () => {
    const app = await makeApp()
    const { id, financialFile } = await readyCase(app)
    expect((await submitPackage(app, id)).status).toBe(201)

    for (const user of ['chief', 'employer-1', 'reviewer-1', 'investment-2', 'company-user-2']) {
      expect((await request(app).get(`/documents/${financialFile}`).set(auth(user))).status).toBe(404)
      expect((await request(app).get(`/documents/${financialFile}/download`).set(auth(user))).status).toBe(404)
    }
    for (const user of ['chief', 'employer-1', 'reviewer-1']) {
      const listed = await request(app).get(`/documents?requestId=${id}`).set(auth(user))
      expect((listed.body.items as { category: string }[]).filter((item) => (FINANCIAL_CATEGORIES as readonly string[]).includes(item.category))).toEqual([])
      const history = await historyOf(app, user, id)
      expect(history).not.toContain('financial_package_submit')
      expect(history).not.toContain('investment_handoff')
    }
    for (const user of ['company-user-1', 'secretariat', 'owner']) {
      expect((await request(app).get(`/documents/${financialFile}/download`).set(auth(user))).status).toBe(200)
    }

    // The company sees its own submission, not the internal handoff.
    const companyHistory = await historyOf(app, 'company-user-1', id)
    expect(companyHistory).toContain('financial_package_submit')
    expect(companyHistory).not.toContain('investment_handoff')

    // Another investment person gets nothing; other roles have no such surface.
    expect((await queueOf(app, 'investment-2')).body.items).toEqual([])
    expect((await dossierOf(app, 'investment-2', id)).status).toBe(404)
    expect((await request(app).get(`/requests/${id}`).set(auth('investment-2'))).status).toBe(404)
    for (const user of ['owner', 'secretariat', 'chief', 'reviewer-1', 'employer-1', 'company-user-1']) {
      expect((await queueOf(app, user)).status).toBe(403)
      expect((await dossierOf(app, user, id)).status).toBe(403)
    }
    expect((await dossierOf(app, 'investment', 'not-a-uuid')).status).toBe(404)
  })

  it('does not open the files on a hand-made grant, and ends that grant at the handoff', async () => {
    const app = await makeApp()
    const { id, financialFile } = await readyCase(app)

    expect((await grant(app, id, 'investment-2')).status).toBe(201)
    expect((await request(app).get(`/documents/${financialFile}/download`).set(auth('investment-2'))).status).toBe(404)
    expect((await queueOf(app, 'investment-2')).body.items).toEqual([])
    // One investment person per case.
    const second = await grant(app, id, 'investment')
    expect(second.status).toBe(409)
    expect(second.body.error).toBe('investment_person_assigned')

    expect((await submitPackage(app, id)).status).toBe(201)
    expect(await investmentRows(id)).toEqual([
      expect.objectContaining({ user_id: 'investment-2', active: false, revoke_reason: 'investment_handoff' }),
      expect.objectContaining({ user_id: 'investment', active: true }),
    ])
    expect((await request(app).get(`/requests/${id}`).set(auth('investment-2'))).status).toBe(404)
    expect((await request(app).get(`/documents/${financialFile}/download`).set(auth('investment'))).status).toBe(200)
  })

  it('moves access at once when the owner reassigns, and ignores a later change of the event', async () => {
    const app = await makeApp()
    const { id, eventId, financialFile } = await readyCase(app)
    expect((await submitPackage(app, id)).status).toBe(201)

    // Changing the event's person does not rewrite a case already handed off.
    const current = await request(app).get(`/admin/events/${eventId}`).set(auth('owner'))
    const patched = await request(app)
      .patch(`/admin/events/${eventId}`)
      .set(auth('owner'))
      .send({ responsibleInvestmentId: 'investment-2', revision: current.body.event.revision, reason: 'جابجایی مسئول' })
    expect(patched.status).toBe(200)
    expect((await dossierOf(app, 'investment', id)).status).toBe(200)
    expect((await dossierOf(app, 'investment-2', id)).status).toBe(404)

    expect((await grant(app, id, 'investment-2')).status).toBe(409)
    const revoked = await request(app)
      .delete(`/admin/requests/${id}/assignments/investment`)
      .set(auth('owner'))
      .send({ reason: 'جایگزینی مسئول' })
    expect(revoked.status).toBe(200)
    expect((await dossierOf(app, 'investment', id)).status).toBe(404)
    expect((await request(app).get(`/documents/${financialFile}/download`).set(auth('investment'))).status).toBe(404)

    expect((await grant(app, id, 'investment-2')).status).toBe(201)
    expect((await dossierOf(app, 'investment-2', id)).status).toBe(200)
    expect((await request(app).get(`/documents/${financialFile}/download`).set(auth('investment-2'))).status).toBe(200)
  })

  it('ends access on the next request when the account is deactivated', async () => {
    const app = await makeApp()
    const { id, financialFile } = await readyCase(app)
    expect((await submitPackage(app, id)).status).toBe(201)
    const account = await userStore.findById('investment')
    try {
      account!.isActive = false
      expect((await dossierOf(app, 'investment', id)).status).toBeGreaterThanOrEqual(401)
      expect((await request(app).get(`/documents/${financialFile}/download`).set(auth('investment'))).status).toBeGreaterThanOrEqual(401)
    } finally {
      account!.isActive = true
    }
  })

  it('backfills packages submitted before the handoff existed', async () => {
    const app = await makeApp()
    const { id } = await readyCase(app)
    expect((await submitPackage(app, id)).status).toBe(201)
    await pool.query(
      `UPDATE dashboard.case_assignments SET user_id = 'investment-2' WHERE request_id = $1 AND role = 'investment-reviewer'`,
      [id],
    )

    const statements: string[] = []
    await backfillHandoffs({ sql: (sql: string) => { statements.push(sql) } } as unknown as MigrationBuilder)
    for (const sql of statements) await pool.query(sql)
    for (const sql of statements) await pool.query(sql)

    expect(await investmentRows(id)).toEqual([
      expect.objectContaining({ user_id: 'investment-2', active: false }),
      expect.objectContaining({ user_id: 'investment', active: true, assigned_by: 'system' }),
    ])
  })
})
