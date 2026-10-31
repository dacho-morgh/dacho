import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { PrivateDocumentStorage } from '../../src/documents/storage.js'
import { FINANCIAL_CHECKLIST, FINANCIAL_CHECKLIST_VERSION } from '../../src/dashboard/financial-invitation.js'
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
const pool = new Pool({ connectionString, application_name: 't29-financial-invitation' })

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

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'T29-company-1', representativeId: 'company-user-1' },
  { name: 'شرکت فناور دیگر', nationalId: 'T29-company-2', representativeId: 'company-user-2' },
])

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

const finalize = (app: App, user: string, id: string, revision: number) =>
  request(app)
    .post(`/requests/${id}/evaluation/finalize`)
    .set(auth(user))
    .send({ revision, scores: scores(), answers: user.startsWith('employer') ? employerAnswers() : ordinaryAnswers() })

const decide = (app: App, id: string, body: Record<string, unknown>) =>
  request(app).post(`/requests/${id}/review-decision`).set(auth('chief')).send(body)

const readInvitation = (app: App, user: string, id: string) =>
  request(app).get(`/requests/${id}/financial-invitation`).set(auth(user))

const uploadAs = (app: App, user: string, id: string, category: string, filename: string) =>
  request(app)
    .post('/documents')
    .set(auth(user))
    .field('category', category)
    .field('requestId', id)
    .attach('file', Buffer.from(`%PDF-1.4 ${filename}`), { filename, contentType: 'application/pdf' })

const invitationRows = async (id: string) =>
  (
    await pool.query<{ request_revision: number; proposal_revision: number; invited_by: string }>(
      'SELECT request_revision, proposal_revision, invited_by FROM dashboard.financial_invitations WHERE request_id = $1 ORDER BY request_revision',
      [id],
    )
  ).rows

async function cleanup() {
  const files = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.rfp_files')).rows
  const docFiles = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all(
    [...files, ...docFiles].map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)),
  )
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
  return { id, trackingCode: created.body.request.trackingCode as string }
}

async function acceptAndStartRound(app: App, id: string, submittedRevision: number) {
  const accepted = await request(app)
    .post(`/requests/${id}/triage`)
    .set(auth('chief'))
    .send({ action: 'accept', expectedRevision: submittedRevision })
  expect(accepted.status).toBe(200)
  const revision = accepted.body.request.revision as number
  const started = await request(app)
    .post(`/requests/${id}/review-round`)
    .set(auth('chief'))
    .send({ reviewerIds: THREE, expectedRevision: revision })
  expect(started.status).toBe(201)
  return { revision, proposalRevision: started.body.round.proposalRevision as number }
}

/** A case whose round holds its four final evaluations and awaits the chief. */
async function completedCase(app: App) {
  const { id, trackingCode } = await draftCase(app)
  const submitted = await request(app).post(`/requests/${id}/submit`).set(auth('company-user-1')).send(consent)
  expect(submitted.status).toBe(200)
  const round = await acceptAndStartRound(app, id, submitted.body.request.revision)
  for (const user of FOUR) expect((await finalize(app, user, id, round.revision)).status).toBe(200)
  return { id, trackingCode, ...round }
}

describe('T29: Financial package invitation (int)', () => {
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

  it('keeps the stage closed at every step before the chief advances', async () => {
    const app = await makeApp()
    const expectClosed = async (id: string) => {
      const invitation = await readInvitation(app, 'company-user-1', id)
      expect(invitation.status).toBe(409)
      expect(invitation.body.error).toBe('financial_stage_not_open')
      expect((await uploadAs(app, 'company-user-1', id, 'financialStatements', 'early.pdf')).status).toBe(404)
    }

    const { id } = await draftCase(app)
    await expectClosed(id)
    const submitted = await request(app).post(`/requests/${id}/submit`).set(auth('company-user-1')).send(consent)
    expect(submitted.status).toBe(200)
    await expectClosed(id)
    const { revision } = await acceptAndStartRound(app, id, submitted.body.request.revision)
    await expectClosed(id)
    // 4/4 alone opens nothing.
    for (const user of FOUR) expect((await finalize(app, user, id, revision)).status).toBe(200)
    await expectClosed(id)
    expect(await invitationRows(id)).toEqual([])
    const listed = await request(app).get(`/documents?requestId=${id}`).set(auth('company-user-1'))
    expect(listed.body.items.map((item: { category: string }) => item.category)).toEqual(['proposal'])
  })

  it('invites the owning company with the exact list, linked to its case and revisions', async () => {
    const app = await makeApp()
    const { id, trackingCode, revision, proposalRevision } = await completedCase(app)

    const advanced = await decide(app, id, { action: 'advance', expectedRevision: revision })
    expect(advanced.status).toBe(200)
    expect(advanced.body.request.revision).toBe(revision + 1)

    const invitation = await readInvitation(app, 'company-user-1', id)
    expect(invitation.status).toBe(200)
    expect(invitation.headers['cache-control']).toContain('no-store')
    expect(invitation.body.invitation).toEqual({
      id: expect.any(String),
      requestId: id,
      trackingCode,
      requestRevision: revision + 1,
      proposalRevision,
      checklistVersion: FINANCIAL_CHECKLIST_VERSION,
      checklist: FINANCIAL_CHECKLIST,
      invitedAt: expect.any(String),
    })
    expect(await invitationRows(id)).toEqual([
      { request_revision: revision + 1, proposal_revision: proposalRevision, invited_by: 'chief' },
    ])

    // The in-app letter reaches the company on this case and names every category.
    const letters = await pool.query<{ recipient_id: string; request_id: string; title: string; body: string }>(
      "SELECT recipient_id, request_id, title, body FROM dashboard.letters WHERE request_id = $1 AND type = 'notification' AND title = 'دعوت به ارسال بسته مالی'",
      [id],
    )
    expect(letters.rows).toHaveLength(1)
    expect(letters.rows[0]).toMatchObject({ recipient_id: 'company-user-1', request_id: id })
    expect(letters.rows[0]!.body).toContain(trackingCode)
    for (const item of FINANCIAL_CHECKLIST) expect(letters.rows[0]!.body).toContain(item.title)
  })

  it('opens financial files for the company and leaves the rest of the case closed', async () => {
    const app = await makeApp()
    const { id, revision } = await completedCase(app)
    expect((await decide(app, id, { action: 'advance', expectedRevision: revision })).status).toBe(200)

    const detail = await request(app).get(`/requests/${id}`).set(auth('company-user-1'))
    expect(detail.body.request.allowedActions).toEqual(['read', 'uploadDocument', 'deleteDocument'])

    for (const item of FINANCIAL_CHECKLIST) {
      expect((await uploadAs(app, 'company-user-1', id, item.category, `${item.category}.pdf`)).status, item.category).toBe(201)
    }
    const removable = await uploadAs(app, 'company-user-1', id, 'financialStatements', 'wrong-file.pdf')
    expect((await request(app).delete(`/documents/${removable.body.document.id}`).set(auth('company-user-1'))).status).toBe(200)

    // The reviewed proposal is finished and its pinned file stays.
    expect((await uploadAs(app, 'company-user-1', id, 'proposal', 'late.pdf')).status).toBe(404)
    const listed = await request(app).get(`/documents?requestId=${id}`).set(auth('company-user-1'))
    const proposal = listed.body.items.find((item: { category: string }) => item.category === 'proposal')
    expect((await request(app).delete(`/documents/${proposal.id}`).set(auth('company-user-1'))).status).toBe(403)

    // Another company cannot reach the case or add to it.
    expect((await uploadAs(app, 'company-user-2', id, 'financialStatements', 'foreign.pdf')).status).toBe(404)
  })

  it('shows the invitation only to the financial audience that exists today', async () => {
    const app = await makeApp()
    const { id, revision } = await completedCase(app)
    expect((await decide(app, id, { action: 'advance', expectedRevision: revision })).status).toBe(200)

    for (const user of ['owner', 'secretariat', 'company-user-1']) {
      expect((await readInvitation(app, user, id)).status, user).toBe(200)
    }
    expect((await readInvitation(app, 'company-user-2', id)).status).toBe(404)
    for (const user of ['chief', 'investment', 'employer-1', ...THREE]) {
      expect((await readInvitation(app, user, id)).status, user).toBe(403)
    }
    // The chief's identity and the round are not part of what the company reads.
    const body = (await readInvitation(app, 'company-user-1', id)).body.invitation
    expect(Object.keys(body)).not.toEqual(expect.arrayContaining(['invitedBy']))
    expect(JSON.stringify(body)).not.toContain('chief')
  })

  it('does not invite on a return or a rejection', async () => {
    const app = await makeApp()
    const returned = await completedCase(app)
    expect((await decide(app, returned.id, { action: 'return', reason: REASON })).status).toBe(200)
    expect(await invitationRows(returned.id)).toEqual([])
    expect((await readInvitation(app, 'company-user-1', returned.id)).status).toBe(409)
    expect((await uploadAs(app, 'company-user-1', returned.id, 'financialStatements', 'x.pdf')).status).toBe(404)

    await cleanup()
    await seedVerifiedCompanies(pool, companyStore)
    const rejected = await completedCase(app)
    expect((await decide(app, rejected.id, { action: 'reject', reason: REASON })).status).toBe(200)
    expect(await invitationRows(rejected.id)).toEqual([])
    expect((await readInvitation(app, 'company-user-1', rejected.id)).status).toBe(409)
  })

  it('links a corrected case to the proposal its advancing round reviewed', async () => {
    const app = await makeApp()
    const first = await completedCase(app)
    expect((await decide(app, first.id, { action: 'return', reason: REASON, expectedRevision: first.revision })).status).toBe(200)

    expect((await uploadAs(app, 'company-user-1', first.id, 'proposal', 'proposal-corrected.pdf')).status).toBe(201)
    const resubmitted = await request(app).post(`/requests/${first.id}/resubmit`).set(auth('company-user-1')).send(consent)
    expect(resubmitted.status).toBe(200)
    const second = await acceptAndStartRound(app, first.id, resubmitted.body.request.revision)
    expect(second.proposalRevision).toBeGreaterThan(first.proposalRevision)
    for (const user of FOUR) expect((await finalize(app, user, first.id, second.revision)).status).toBe(200)
    expect((await decide(app, first.id, { action: 'advance', expectedRevision: second.revision })).status).toBe(200)

    const invitation = await readInvitation(app, 'company-user-1', first.id)
    expect(invitation.body.invitation).toMatchObject({
      requestRevision: second.revision + 1,
      proposalRevision: second.proposalRevision,
    })
    expect(await invitationRows(first.id)).toHaveLength(1)
  })

  it('records one invitation and one letter under simultaneous advances', async () => {
    const app = await makeApp()
    const { id, revision } = await completedCase(app)

    const results = await Promise.all([
      decide(app, id, { action: 'advance', expectedRevision: revision }),
      decide(app, id, { action: 'advance', expectedRevision: revision }),
      decide(app, id, { action: 'advance' }),
    ])
    expect(results.map((result) => result.status).sort()).toEqual([200, 409, 409])
    expect(await invitationRows(id)).toHaveLength(1)
    const jobs = await pool.query(
      "SELECT id FROM dashboard.notification_jobs WHERE request_id = $1 AND action = 'chief_review_advance'",
      [id],
    )
    expect(jobs.rows).toHaveLength(1)
  })

  it('rolls the advance back when the invitation cannot be recorded', async () => {
    const app = await makeApp()
    const { id, revision } = await completedCase(app)
    await pool.query(
      `ALTER TABLE dashboard.financial_invitations
       ADD CONSTRAINT t29_refuse_all CHECK (checklist_version = 'never') NOT VALID`,
    )
    try {
      expect((await decide(app, id, { action: 'advance', expectedRevision: revision })).status).toBe(500)
    } finally {
      await pool.query('ALTER TABLE dashboard.financial_invitations DROP CONSTRAINT t29_refuse_all')
    }
    const detail = await request(app).get(`/requests/${id}`).set(auth('chief'))
    expect(detail.body.request).toMatchObject({ status: 'in_review', reviewStage: 'triaged', revision })
    expect(detail.body.request.allowedActions).toEqual(['read', 'decideReview'])

    // The same decision then goes through.
    expect((await decide(app, id, { action: 'advance', expectedRevision: revision })).status).toBe(200)
    expect(await invitationRows(id)).toHaveLength(1)
  })
})
