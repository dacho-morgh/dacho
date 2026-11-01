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
const pool = new Pool({ connectionString, application_name: 't34-role-scoped-letters' })

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
  { name: 'شرکت فناور پیشرو', nationalId: 'T34-company-1', representativeId: 'company-user-1', establishmentDate: '2010' },
  { name: 'شرکت دیگر', nationalId: 'T34-company-2', representativeId: 'company-user-2', establishmentDate: '2011' },
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
  await pool.query("DELETE FROM dashboard.letters; DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
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

const get = (app: App, user: string, path: string) => request(app).get(path).set(auth(user))

const send = (app: App, sender: string, recipientId: string, requestId?: string, extra: object = {}) =>
  request(app)
    .post('/letters')
    .set(auth(sender))
    .send({ title: 'نامه', body: 'متن نامه', recipientId, ...(requestId ? { requestId } : {}), ...extra })

const recipientIds = async (app: App, user: string, requestId?: string) => {
  const res = await get(app, user, `/letters/recipients${requestId ? `?requestId=${requestId}` : ''}`)
  expect(res.status).toBe(200)
  return (res.body.items as { id: string }[]).map((item) => item.id).sort()
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

describe('T34: role-scoped letters (int)', () => {
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

  it('lets the person holding the case write with the Secretariat and the owner, and nobody else', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)

    expect(await recipientIds(app, 'investment', id)).toEqual(['owner', 'secretariat'])
    expect(await recipientIds(app, 'investment')).toEqual([])

    const sent = await send(app, 'investment', 'secretariat', id)
    expect(sent.status).toBe(201)
    expect(sent.body.letter).toMatchObject({ senderId: 'investment', senderRole: 'investment-reviewer', requestId: id, type: 'official' })
    expect((await send(app, 'investment', 'owner', id)).status).toBe(201)
    expect((await send(app, 'secretariat', 'investment', id)).status).toBe(201)
    expect((await send(app, 'owner', 'investment', id)).status).toBe(201)

    // The mailbox holds both directions, and only the recipient marks a letter read.
    const mailbox = (await get(app, 'investment', '/letters?read=false')).body.items as { id: string; recipientId: string }[]
    expect(mailbox).toHaveLength(4)
    const reply = mailbox.find((letter) => letter.recipientId === 'investment')!
    expect((await get(app, 'investment', `/letters/${reply.id}`)).body.letter.read).toBe(true)
    expect((await get(app, 'investment', `/letters/${sent.body.letter.id}`)).body.letter.read).toBe(false)

    // Injected recipients are refused even though the case is the sender's.
    for (const recipient of ['chief', 'reviewer-1', 'employer-1', 'company-user-1', 'company-user-2', 'investment-2']) {
      expect((await send(app, 'investment', recipient, id)).status).toBe(403)
    }
    expect((await send(app, 'investment', 'secretariat')).status).toBe(403)

    // Nobody else reaches the investment person on a case, or reads their letters.
    for (const sender of ['chief', 'reviewer-1', 'employer-1', 'company-user-1', 'company-user-2', 'investment-2']) {
      expect((await send(app, sender, 'investment', id)).status).toBe(403)
      expect((await get(app, sender, `/letters/${sent.body.letter.id}`)).status).toBe(404)
      expect((await get(app, sender, '/letters')).body.items.map((l: { id: string }) => l.id)).not.toContain(sent.body.letter.id)
    }
    expect((await send(app, 'secretariat', 'investment-2', id)).status).toBe(403)
  })

  it('stays closed on a generic assignment until the package hands the case off', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app, { submit: false })
    const granted = await request(app)
      .post(`/admin/requests/${id}/assignments`)
      .set(auth('owner'))
      .send({ userId: 'investment', role: 'investment-reviewer' })
    expect(granted.status).toBe(201)

    expect(await recipientIds(app, 'investment', id)).toEqual([])
    expect(await recipientIds(app, 'secretariat', id)).not.toContain('investment')
    expect((await send(app, 'investment', 'secretariat', id)).status).toBe(403)
    expect((await send(app, 'secretariat', 'investment', id)).status).toBe(403)
    expect((await send(app, 'owner', 'investment', id)).status).toBe(403)

    expect((await request(app).post(`/requests/${id}/financial-package`).set(auth('company-user-1'))).status).toBe(201)
    expect(await recipientIds(app, 'investment', id)).toEqual(['owner', 'secretariat'])
    expect(await recipientIds(app, 'secretariat', id)).toContain('investment')
    expect((await send(app, 'investment', 'secretariat', id)).status).toBe(201)
  })

  it('ends sending and reading when the assignment is revoked', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    const sent = await send(app, 'secretariat', 'investment', id)
    expect(sent.status).toBe(201)

    const revoked = await request(app)
      .delete(`/admin/requests/${id}/assignments/investment`)
      .set(auth('owner'))
      .send({ reason: 'جایگزینی مسئول' })
    expect(revoked.status).toBe(200)

    expect((await send(app, 'investment', 'secretariat', id)).status).toBe(403)
    expect((await send(app, 'secretariat', 'investment', id)).status).toBe(403)
    expect((await get(app, 'investment', `/letters/recipients?requestId=${id}`)).status).toBe(404)
    expect((await get(app, 'investment', `/letters/${sent.body.letter.id}`)).status).toBe(404)
    expect(await recipientIds(app, 'secretariat', id)).not.toContain('investment')
  })

  it('does not let a letter open a file the investment person cannot already read', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    const documentId = await uploadReply(app, id)

    const attach = { attachmentIds: [documentId] }
    expect((await send(app, 'secretariat', 'investment', id, attach)).status).toBe(403)
    expect((await send(app, 'investment', 'secretariat', id, attach)).status).toBe(403)

    expect((await request(app).post(`/requests/${id}/supplementary-files`).set(auth('secretariat')).send({ documentId })).status).toBe(201)
    const delivered = await send(app, 'secretariat', 'investment', id, attach)
    expect(delivered.status).toBe(201)
    const letterId = delivered.body.letter.id as string
    expect((await get(app, 'investment', `/letters/${letterId}/attachments/${documentId}/download`)).status).toBe(200)

    // Sending the case's financial files keeps their audience.
    const { rows } = await pool.query<{ id: string }>(
      "SELECT id FROM dashboard.private_documents WHERE request_id = $1 AND category = 'financialStatements' LIMIT 1",
      [id],
    )
    const financial = { attachmentIds: [rows[0]!.id] }
    expect((await send(app, 'investment', 'secretariat', id, financial)).status).toBe(201)
    expect((await send(app, 'chief', 'reviewer-1', id, financial)).status).toBe(403)
  })

  it('lists the recipients each role may write to, and each listed person is accepted', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)

    const expected: Record<string, string[]> = {
      'company-user-1': ['secretariat'],
      'employer-1': ['chief'],
      'reviewer-1': ['chief'],
      chief: ['company-user-1', 'employer-1', 'owner', 'reviewer-1', 'reviewer-2', 'reviewer-3', 'secretariat'],
      investment: ['owner', 'secretariat'],
      owner: ['chief', 'company-user-1', 'employer-1', 'investment', 'reviewer-1', 'reviewer-2', 'reviewer-3', 'secretariat'],
      secretariat: ['chief', 'company-user-1', 'employer-1', 'investment', 'owner', 'reviewer-1', 'reviewer-2', 'reviewer-3'],
    }
    for (const [sender, recipients] of Object.entries(expected)) {
      expect(await recipientIds(app, sender, id)).toEqual(recipients)
      for (const recipient of recipients) {
        expect((await send(app, sender, recipient, id)).status).toBe(201)
      }
    }

    // A case outside the actor's scope, and a malformed id, name nobody.
    for (const outsider of ['company-user-2', 'investment-2']) {
      expect((await get(app, outsider, `/letters/recipients?requestId=${id}`)).status).toBe(404)
    }
    expect((await get(app, 'owner', '/letters/recipients?requestId=not-a-uuid')).status).toBe(400)
  })

  it('names no one a reviewer cannot reach when the case has no unique chief', async () => {
    const app = await makeApp()
    const id = await handedOffCase(app)
    await pool.query(
      "UPDATE dashboard.case_assignments SET active = false WHERE request_id = $1 AND role = 'chief-reviewer'",
      [id],
    )
    expect(await recipientIds(app, 'reviewer-1', id)).toEqual([])
    expect((await send(app, 'reviewer-1', 'chief', id)).status).toBe(403)
  })

  it('lists general recipients by role with the fields a composer needs and no contact details', async () => {
    const app = await makeApp()

    expect(await recipientIds(app, 'company-user-1')).toEqual(['secretariat'])
    expect(await recipientIds(app, 'reviewer-1')).toEqual([])
    expect(await recipientIds(app, 'employer-1')).toEqual([])
    expect(await recipientIds(app, 'secretariat')).toEqual(['company-user-1', 'company-user-2'])
    const everyone = users.map((user) => user.id).sort()
    expect(await recipientIds(app, 'owner')).toEqual(everyone.filter((user) => user !== 'owner'))
    expect(await recipientIds(app, 'chief')).toEqual(everyone.filter((user) => user !== 'chief'))

    const res = await get(app, 'owner', '/letters/recipients?search=secretariat')
    expect(res.body.items).toEqual([{ id: 'secretariat', name: null, operationalRole: 'central-secretariat' }])
    expect((await send(app, 'owner', 'investment')).status).toBe(201)
    expect((await send(app, 'secretariat', 'investment')).status).toBe(403)
  })
})
