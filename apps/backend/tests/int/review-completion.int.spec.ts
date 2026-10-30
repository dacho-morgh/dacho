import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { MigrationBuilder } from 'node-pg-migrate'
import { Pool } from 'pg'
import request from 'supertest'

import { up as migrateCompletion } from '../../migrations/1780511400028_review_round_completion.js'
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
const pool = new Pool({ connectionString, application_name: 't27-review-completion' })

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
  { name: 'شرکت فناور پیشرو', nationalId: 'T27-company-1', representativeId: 'company-user-1' },
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
    .send({
      revision,
      scores: scores(),
      answers: user.startsWith('employer') ? employerAnswers() : ordinaryAnswers(),
    })

const readRound = (app: App, user: string, id: string) =>
  request(app).get(`/requests/${id}/review-round`).set(auth(user))

const completions = async (requestId: string) =>
  (
    await pool.query<{ actor_id: string; from_state: string; to_state: string; revision: number }>(
      `SELECT actor_id, from_state, to_state, revision FROM dashboard.activities
       WHERE request_id = $1 AND action = 'review_round_complete'`,
      [requestId],
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
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id IN ('company-user-1')")
}

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
  const upload = await request(app)
    .post('/documents')
    .set(auth('company-user-1'))
    .field('category', 'proposal')
    .field('requestId', id)
    .attach('file', Buffer.from('%PDF-1.4 proposal'), { filename: 'proposal.pdf', contentType: 'application/pdf' })
  expect(upload.status).toBe(201)
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

describe('T27: Atomic 4/4 completion and confidentiality (int)', () => {
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

  it('stays incomplete at 1/4 to 3/4, completes on the fourth and never moves the case', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)

    const empty = await readRound(app, 'chief', id)
    expect(empty.body.round.completion).toEqual({ required: 4, finalized: 0, ready: false, completedAt: null })

    for (const [index, user] of THREE.entries()) {
      expect((await finalize(app, user, id, revision)).status).toBe(200)
      const round = await readRound(app, 'chief', id)
      expect(round.body.round.completion).toEqual({ required: 4, finalized: index + 1, ready: false, completedAt: null })
      const list = await request(app).get(`/requests/${id}/evaluations`).set(auth('chief'))
      expect(list.body).toMatchObject({ completedCount: index + 1, requiredCount: 4, readyForChiefDecision: false })
      expect(await completions(id)).toEqual([])
    }

    expect((await finalize(app, 'employer-1', id, revision)).status).toBe(200)
    const round = await readRound(app, 'chief', id)
    expect(round.body.round.completion).toMatchObject({ required: 4, finalized: 4, ready: true })
    expect(round.body.round.completion.completedAt).toEqual(expect.any(String))
    const list = await request(app).get(`/requests/${id}/evaluations`).set(auth('chief'))
    expect(list.body).toMatchObject({ completedCount: 4, requiredCount: 4, readyForChiefDecision: true })
    expect(await completions(id)).toEqual([
      { actor_id: 'employer-1', from_state: 'in_review', to_state: 'in_review', revision },
    ])

    // Readiness only: state and revision stand still, and no one is offered an advance.
    const company = await request(app).get(`/requests/${id}`).set(auth('company-user-1'))
    expect(company.body.request).toMatchObject({ status: 'in_review', reviewStage: 'triaged', revision })
    expect(company.body.request.allowedActions).toEqual(['read'])
    const chiefView = await request(app).get(`/requests/${id}`).set(auth('chief'))
    expect(chiefView.body.request.allowedActions).toEqual(['read', 'replaceReviewer'])
  })

  it('produces one completion when all four finalize at the same moment', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)

    const results = await Promise.all(FOUR.map((user) => finalize(app, user, id, revision)))
    expect(results.map((res) => res.status)).toEqual([200, 200, 200, 200])

    expect(await completions(id)).toHaveLength(1)
    const round = await readRound(app, 'chief', id)
    expect(round.body.round.completion).toMatchObject({ finalized: 4, ready: true })
  })

  it('counts one evaluation and no completion when one person finalizes twice at once', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    for (const user of THREE) expect((await finalize(app, user, id, revision)).status).toBe(200)

    const results = await Promise.all([
      finalize(app, 'employer-1', id, revision),
      finalize(app, 'employer-1', id, revision),
    ])
    expect(results.map((res) => res.status).sort()).toEqual([200, 409])
    expect(await completions(id)).toHaveLength(1)
    const again = await finalize(app, 'employer-1', id, revision)
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('evaluation_locked')
    expect(await completions(id)).toHaveLength(1)
  })

  it('does not count drafts or evaluations of people who left the round', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    for (const user of ['reviewer-1', 'reviewer-2', 'employer-1']) {
      expect((await finalize(app, user, id, revision)).status).toBe(200)
    }
    const draft = await request(app)
      .put(`/requests/${id}/evaluation`)
      .set(auth('reviewer-3'))
      .send({ revision, scores: scores(), answers: ordinaryAnswers() })
    expect(draft.status).toBe(200)
    expect((await readRound(app, 'chief', id)).body.round.completion).toMatchObject({ finalized: 3, ready: false })

    // A replaced reviewer's draft stays behind; the newcomer has to finish the slot.
    const replaced = await request(app)
      .post(`/requests/${id}/review-round/reviewers/reviewer-3/replace`)
      .set(auth('chief'))
      .send({ replacementId: 'reviewer-4', expectedRevision: revision })
    expect(replaced.status).toBe(200)
    expect(replaced.body.round.completion).toMatchObject({ finalized: 3, ready: false })
    expect(await completions(id)).toEqual([])
    expect((await finalize(app, 'reviewer-4', id, revision)).status).toBe(200)
    expect((await readRound(app, 'chief', id)).body.round.completion).toMatchObject({ finalized: 4, ready: true })
    expect(await completions(id)).toHaveLength(1)
  })

  it('takes readiness back when the owner replaces the employer of a complete round', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    for (const user of FOUR) expect((await finalize(app, user, id, revision)).status).toBe(200)

    const replaced = await request(app)
      .post(`/requests/${id}/review-round/employer/replace`)
      .set(auth('owner'))
      .send({ employerId: 'employer-2', reason: 'تعارض منافع', expectedRevision: revision })
    expect(replaced.status).toBe(200)
    expect(replaced.body.round.completion).toEqual({ required: 4, finalized: 3, ready: false, completedAt: null })
    const list = await request(app).get(`/requests/${id}/evaluations`).set(auth('chief'))
    expect(list.body).toMatchObject({ completedCount: 3, readyForChiefDecision: false })
    // The earlier employer's locked evaluation stays stored and attributable.
    expect(list.body.items.map((item: { userId: string }) => item.userId)).toContain('employer-1')

    expect((await finalize(app, 'employer-2', id, revision)).status).toBe(200)
    expect((await readRound(app, 'chief', id)).body.round.completion).toMatchObject({ finalized: 4, ready: true })
    expect(await completions(id)).toHaveLength(2)
  })

  it('keeps a slot of an earlier round from writing into a newer revision', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    const newer = revision + 1
    await pool.query('UPDATE dashboard.requests SET revision = $2 WHERE id = $1', [id, newer])

    for (const res of [
      await finalize(app, 'reviewer-1', id, newer),
      await request(app).put(`/requests/${id}/evaluation`).set(auth('reviewer-1')).send({ revision: newer, scores: scores() }),
    ]) {
      expect(res.status).toBe(409)
      expect(res.body.error).toBe('stale_evaluation')
    }
    const stored = await pool.query('SELECT 1 FROM dashboard.evaluations WHERE request_id = $1', [id])
    expect(stored.rowCount).toBe(0)
  })

  it('is no longer ready once the request moved on to a newer revision', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    for (const user of FOUR) expect((await finalize(app, user, id, revision)).status).toBe(200)
    await pool.query('UPDATE dashboard.requests SET revision = $2 WHERE id = $1', [id, revision + 1])

    const round = await readRound(app, 'chief', id)
    expect(round.body.round.requestRevision).toBe(revision)
    expect(round.body.round.completion).toMatchObject({ finalized: 4, ready: false })
    const list = await request(app).get(`/requests/${id}/evaluations`).set(auth('chief'))
    expect(list.body).toMatchObject({ revision: revision + 1, completedCount: 0, readyForChiefDecision: false })
  })

  it('completes a round whose four people already hold locked evaluations of this revision', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    // Roll the fixture back to before the round, as if hand-made grants had produced the evaluations.
    for (const user of FOUR) expect((await finalize(app, user, id, revision)).status).toBe(200)
    await pool.query(
      `UPDATE dashboard.case_assignments SET round_id = NULL, slot = NULL, active = false, revoked_at = now()
       WHERE request_id = $1 AND round_id IS NOT NULL`,
      [id],
    )
    await pool.query('DELETE FROM dashboard.review_rounds WHERE request_id = $1', [id])
    await pool.query(`DELETE FROM dashboard.activities WHERE request_id = $1 AND action = 'review_round_complete'`, [id])

    const started = await request(app)
      .post(`/requests/${id}/review-round`)
      .set(auth('chief'))
      .send({ reviewerIds: THREE, expectedRevision: revision })
    expect(started.status).toBe(201)
    expect(started.body.round.completion).toMatchObject({ finalized: 4, ready: true })
    expect(await completions(id)).toHaveLength(1)
  })

  it('marks only rounds already at 4/4 when the migration runs', async () => {
    const app = await makeApp()
    const complete = await roundCase(app)
    for (const user of FOUR) expect((await finalize(app, user, complete.id, complete.revision)).status).toBe(200)

    const statements: string[] = []
    await migrateCompletion({ sql: (sql: string) => { statements.push(sql) } } as unknown as MigrationBuilder)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const finalized = await client.query<{ last: Date }>(
        'SELECT max(finalized_at) AS last FROM dashboard.evaluations WHERE request_id = $1',
        [complete.id],
      )
      await client.query('ALTER TABLE dashboard.review_rounds DROP COLUMN completed_at')
      // A fourth slot taken back: the same round must not be marked.
      await client.query(
        `UPDATE dashboard.evaluations SET state = 'draft', finalized_at = NULL
         WHERE request_id = $1 AND user_id = 'employer-1'`,
        [complete.id],
      )
      for (const sql of statements) await client.query(sql)
      const open = await client.query('SELECT completed_at FROM dashboard.review_rounds WHERE request_id = $1', [complete.id])
      expect(open.rows).toEqual([{ completed_at: null }])

      await client.query('ALTER TABLE dashboard.review_rounds DROP COLUMN completed_at')
      await client.query(
        `UPDATE dashboard.evaluations SET state = 'final', finalized_at = $2
         WHERE request_id = $1 AND user_id = 'employer-1'`,
        [complete.id, finalized.rows[0]!.last],
      )
      for (const sql of statements) await client.query(sql)
      const done = await client.query('SELECT completed_at FROM dashboard.review_rounds WHERE request_id = $1', [complete.id])
      expect(done.rows).toEqual([{ completed_at: finalized.rows[0]!.last }])
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })

  it('shows each reviewer only their own evaluation, in every API', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    for (const user of FOUR) expect((await finalize(app, user, id, revision)).status).toBe(200)
    const others = (user: string) => FOUR.filter((person) => person !== user)

    for (const user of FOUR) {
      const own = await request(app).get(`/requests/${id}/evaluation`).set(auth(user))
      expect(own.status).toBe(200)
      expect(Object.keys(own.body).sort()).toEqual(['evaluation', 'revision'])
      expect(own.body.evaluation.userId).toBe(user)

      const list = await request(app).get(`/requests/${id}/evaluations`).set(auth(user))
      expect(list.status).toBe(403)

      const round = await readRound(app, user, id)
      expect(round.status).toBe(200)
      expect(round.body.round).not.toHaveProperty('completion')
      expect(round.body.round.slots).toHaveLength(1)
      expect(round.body.round.slots[0].userId).toBe(user)

      const caseFile = await request(app).get(`/review/cases/${id}`).set(auth(user))
      const queue = await request(app).get('/review/queue').set(auth(user))
      const detail = await request(app).get(`/requests/${id}`).set(auth(user))
      const history = await request(app).get(`/requests/${id}/history`).set(auth(user))
      const feed = await request(app).get('/activities').set(auth(user))
      for (const res of [caseFile, queue, detail, history, feed]) {
        expect(res.status).toBe(200)
        const body = JSON.stringify(res.body)
        for (const other of others(user)) expect(body).not.toContain(other)
        expect(body).not.toContain('review_round_complete')
        expect(body).not.toContain('completedAt')
      }
    }
  })

  it('keeps completion and evaluations from the company and investment, and shows them to oversight', async () => {
    const app = await makeApp()
    const { id, revision } = await roundCase(app)
    for (const user of FOUR) expect((await finalize(app, user, id, revision)).status).toBe(200)

    for (const user of ['company-user-1', 'investment']) {
      expect((await request(app).get(`/requests/${id}/evaluations`).set(auth(user))).status).toBe(403)
      expect((await request(app).get(`/requests/${id}/evaluation`).set(auth(user))).status).toBe(403)
      expect((await readRound(app, user, id)).status).toBe(403)
    }
    const company = await request(app).get(`/requests/${id}`).set(auth('company-user-1'))
    const companyHistory = await request(app).get(`/requests/${id}/history`).set(auth('company-user-1'))
    const companyFeed = await request(app).get('/activities').set(auth('company-user-1'))
    for (const res of [company, companyHistory, companyFeed]) {
      expect(res.status).toBe(200)
      expect(JSON.stringify(res.body)).not.toContain('review_round_complete')
    }
    // Another chief has no window on the case at all.
    expect((await request(app).get(`/requests/${id}/evaluations`).set(auth('chief-2'))).status).toBe(404)
    expect((await readRound(app, 'chief-2', id)).status).toBe(404)

    for (const user of ['owner', 'secretariat', 'chief']) {
      const list = await request(app).get(`/requests/${id}/evaluations`).set(auth(user))
      expect(list.status).toBe(200)
      expect(list.body.items).toHaveLength(4)
      expect(list.body.readyForChiefDecision).toBe(true)
      const history = await request(app).get(`/requests/${id}/history`).set(auth(user))
      expect(history.body.items.map((item: { action: string | null }) => item.action)).toContain('review_round_complete')
    }
  })
})
