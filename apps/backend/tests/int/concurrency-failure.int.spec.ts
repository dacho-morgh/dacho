import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

// Races are forced to overlap by holding the case row until every request waits on it.
// Failures come from real sources: a storage root that cannot be written and database
// triggers. Each test then checks what was persisted and that a repeat has one effect.

const connectionString = process.env.DATABASE_URL!
const APPLICATION_NAME = 't44-concurrency-failure'
const pool = new Pool({ connectionString, application_name: APPLICATION_NAME })

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
]

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'T44-company-1', representativeId: 'company-user-1', establishmentDate: '2010' },
])

const auth = (id: string) => ({
  'x-internal-proxy-secret': 'test-proxy-secret',
  'x-user-id': id,
  'x-user-roles': users.find((u) => u.id === id)?.operationalRole ?? 'representative',
})

let storageRoot: string
let storage: PrivateDocumentStorage

const makeApp = async (options: { documents?: PrivateDocumentStorage; pool?: Pool } = {}) =>
  createApp({
    pool: options.pool ?? pool,
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
    privateDocumentStorage: options.documents ?? storage,
  })

type App = Awaited<ReturnType<typeof makeApp>>

/** A real write failure: the storage root is a file, so its directory cannot be created. */
function unwritableStorage() {
  const root = join(storageRoot, '..', `${storageRoot.split(/[\\/]/).pop()}-not-a-directory`)
  writeFileSync(root, '')
  return new PrivateDocumentStorage(root)
}

/** Fails the save after `saves` successful ones, as a disk filling up mid-request does. */
class DiskFullAfter extends PrivateDocumentStorage {
  constructor(root: string, private saves: number) {
    super(root)
  }

  override async save(...args: Parameters<PrivateDocumentStorage['save']>) {
    if (this.saves-- <= 0) throw new Error('ENOSPC: no space left on device')
    return super.save(...args)
  }
}

const storedFiles = () => readdirSync(storageRoot)

const consent = {
  nonCompeteAcceptance: { accepted: true, textVersionId: CURRENT_NON_COMPETE_VERSION },
  eventRulesAcceptance: { accepted: true, textVersionId: CURRENT_EVENT_RULES_VERSION },
}

const THREE = ['reviewer-1', 'reviewer-2', 'reviewer-3']
const REASON = 'بودجه پروپوزال باید بازنگری شود'
const TEAM = [{ name: 'سارا حسینی', role: 'مدیر پروژه' }]

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

const upload = (app: App, id: string, filename = 'proposal.pdf') =>
  request(app)
    .post('/documents')
    .set(auth('company-user-1'))
    .field('category', 'proposal')
    .field('requestId', id)
    .attach('file', Buffer.from(`%PDF-1.4 ${filename}`), { filename, contentType: 'application/pdf' })

const submit = (app: App, id: string) => post(app, 'company-user-1', `/requests/${id}/submit`, consent)
const triage = (app: App, id: string, body: Record<string, unknown>) => post(app, 'chief', `/requests/${id}/triage`, body)
const decide = (app: App, id: string, body: Record<string, unknown>) => post(app, 'chief', `/requests/${id}/review-decision`, body)
const finalize = (app: App, user: string, id: string, revision: number) =>
  post(app, user, `/requests/${id}/evaluation/finalize`, {
    revision,
    scores,
    answers: user.startsWith('employer') ? employerAnswers : ordinaryAnswers,
  })
const replaceReviewer = (app: App, id: string, reviewerId: string, replacementId: string, expectedRevision: number) =>
  post(app, 'chief', `/requests/${id}/review-round/reviewers/${reviewerId}/replace`, { replacementId, expectedRevision })
const editAnswers = (app: App, id: string, summary: string) =>
  request(app).patch(`/requests/${id}`).set(auth('company-user-1')).send({ answers: { applicationTeam: TEAM, summary } })

/** Runs the requests only after all of them are waiting on the case row, then lets them through together. */
async function overlapping<T>(id: string, start: Array<() => PromiseLike<T>>): Promise<T[]> {
  const holder = await pool.connect()
  let pending: Promise<T>[] = []
  try {
    await holder.query('BEGIN')
    await holder.query('SELECT 1 FROM dashboard.requests WHERE id = $1 FOR UPDATE', [id])
    pending = start.map((send) => Promise.resolve(send()))
    await expect
      .poll(
        async () =>
          (
            await pool.query<{ waiting: number }>(
              `SELECT COUNT(*)::int AS waiting FROM pg_stat_activity
               WHERE application_name = $1 AND datname = current_database() AND wait_event_type = 'Lock'`,
              [APPLICATION_NAME],
            )
          ).rows[0]?.waiting,
        { timeout: 5000, interval: 10 },
      )
      .toBe(start.length)
    await holder.query('COMMIT')
    return await Promise.all(pending)
  } finally {
    await holder.query('ROLLBACK').catch(() => undefined)
    holder.release()
    await Promise.allSettled(pending)
  }
}

/** Makes matching inserts into a table fail, for the length of `run`. */
async function whileInsertFails<T>(table: string, when: string, run: () => PromiseLike<T>): Promise<T> {
  const dropTrigger = `DROP TRIGGER IF EXISTS t44_fail ON dashboard.${table}`
  await pool.query(dropTrigger)
  await pool.query(`CREATE OR REPLACE FUNCTION dashboard.t44_fail() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'forced ${table} failure'; END $$`)
  await pool.query(`CREATE TRIGGER t44_fail BEFORE INSERT ON dashboard.${table}
    FOR EACH ROW WHEN (${when}) EXECUTE FUNCTION dashboard.t44_fail()`)
  try {
    return await run()
  } finally {
    await pool.query(dropTrigger)
    await pool.query('DROP FUNCTION IF EXISTS dashboard.t44_fail()')
  }
}

const countOf = async (table: string, id: string) =>
  (await pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM dashboard.${table} WHERE request_id = $1`, [id])).rows[0]!.total

const caseState = async (id: string) =>
  (
    await pool.query<{ status: string; review_stage: string | null; revision: number }>(
      'SELECT status::text AS status, review_stage, revision FROM dashboard.requests WHERE id = $1',
      [id],
    )
  ).rows[0]!

/** Everything a transition writes. A refused or failed action must leave all of it as it was. */
const footprint = async (id: string) => ({
  ...(await caseState(id)),
  history: await countOf('activities', id),
  jobs: await countOf('notification_jobs', id),
  letters: await countOf('letters', id),
  proposals: await countOf('request_proposals', id),
  agreements: await countOf('request_agreements', id),
  verifications: await countOf('request_verifications', id),
})

const actionCount = async (id: string, action: string) =>
  (
    await pool.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM dashboard.activities WHERE request_id = $1 AND action = $2',
      [id, action],
    )
  ).rows[0]!.total

const jobs = async (id: string) =>
  (
    await pool.query<{ id: string; status: string; attempts: number; last_error: string | null; letter_id: string | null; action: string }>(
      'SELECT id, status, attempts, last_error, letter_id, action FROM dashboard.notification_jobs WHERE request_id = $1 ORDER BY created_at',
      [id],
    )
  ).rows

async function cleanup() {
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  await clearVerifiedCompanies(pool)
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id = 'company-user-1'")
}

async function subtopicFixture(app: App) {
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
  return { eventId, subtopicId: subtopicRes.body.subtopic.id as string }
}

const publishRfp = (app: App, eventId: string, subtopicId: string, filenames = ['rfp.pdf']) => {
  const pending = request(app)
    .post(`/admin/events/${eventId}/subtopics/${subtopicId}/rfp`)
    .set(auth('owner'))
    .field('expectedVersionId', '')
    .field('reason', 'نسخه اولیه')
  for (const filename of filenames) {
    pending.attach('files', Buffer.from(`%PDF-1.4 ${filename}`), { filename, contentType: 'application/pdf' })
  }
  return pending
}

/** A draft of company-user-1 on an event of chief and employer-1, without its proposal file. */
async function emptyDraft(app: App) {
  const { eventId, subtopicId } = await subtopicFixture(app)
  const rfpRes = await publishRfp(app, eventId, subtopicId)
  expect(rfpRes.status).toBe(201)
  const created = await post(app, 'company-user-1', '/requests', {
    serviceId: 'event-service',
    title: 'طرح سامانه بینایی ماشین',
    answers: { applicationTeam: TEAM, summary: 'خلاصه اولیه' },
    eventId,
    subtopicId,
    rfpVersionId: rfpRes.body.version.id,
  })
  expect(created.status).toBe(201)
  return created.body.request.id as string
}

async function draftCase(app: App) {
  const id = await emptyDraft(app)
  expect((await upload(app, id)).status).toBe(201)
  return id
}

async function submittedCase(app: App) {
  const id = await draftCase(app)
  const submitted = await submit(app, id)
  expect(submitted.status).toBe(200)
  return { id, revision: submitted.body.request.revision as number }
}

/** A submitted case accepted at triage with a started round of employer-1 and reviewers 1-3. */
async function roundCase(app: App) {
  const { id, revision: submitted } = await submittedCase(app)
  const accepted = await triage(app, id, { action: 'accept', expectedRevision: submitted })
  expect(accepted.status).toBe(200)
  const revision = accepted.body.request.revision as number
  const started = await post(app, 'chief', `/requests/${id}/review-round`, { reviewerIds: THREE, expectedRevision: revision })
  expect(started.status).toBe(201)
  return { id, revision }
}

async function finalizeAll(app: App, id: string, revision: number, people: string[]) {
  for (const user of people) expect((await finalize(app, user, id, revision)).status, user).toBe(200)
}

const completion = async (app: App, id: string) =>
  (await get(app, 'chief', `/requests/${id}/review-round`)).body.round.completion as { finalized: number; ready: boolean }

const pinnedProposal = async (id: string) =>
  (
    await pool.query<{ answers: { summary: string }; proposal_documents: Array<{ id: string }> }>(
      'SELECT answers, proposal_documents FROM dashboard.request_proposals WHERE request_id = $1',
      [id],
    )
  ).rows

describe('T44: Concurrency and failure (int)', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    storageRoot = mkdtempSync(join(tmpdir(), 'dacho-t44-documents-'))
    storage = new PrivateDocumentStorage(storageRoot)
    await storage.ensure()
    await cleanup()
    await seedVerifiedCompanies(pool, companyStore)
  })

  afterEach(async () => {
    await cleanup()
    rmSync(storageRoot, { recursive: true, force: true })
    rmSync(`${storageRoot}-not-a-directory`, { force: true })
  })

  afterAll(async () => {
    await cleanup()
    await pool.end()
  })

  describe('parallel submit', () => {
    it('lets one of many parallel submits take the draft and records it once', async () => {
      const app = await makeApp()
      const id = await draftCase(app)
      const before = await caseState(id)

      const results = await overlapping(id, Array.from({ length: 6 }, () => () => submit(app, id)))
      expect(results.map((res) => res.status).sort()).toEqual([200, 409, 409, 409, 409, 409])
      for (const res of results.filter((r) => r.status === 409)) expect(res.body.error).toBe('already_submitted')

      const after = await footprint(id)
      expect(after).toEqual({
        status: 'in_review',
        review_stage: 'chief_triage',
        revision: before.revision + 1,
        history: 1,
        jobs: 1,
        letters: 1,
        proposals: 1,
        agreements: 2,
        verifications: 1,
      })

      // A retry after the race gets the same answer and adds nothing.
      const retry = await submit(app, id)
      expect(retry.status).toBe(409)
      expect(retry.body.error).toBe('already_submitted')
      expect(await footprint(id)).toEqual(after)
    })

    it('finishes parallel submits on a small connection pool', async () => {
      const small = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000 })
      try {
        const app = await makeApp({ pool: small })
        const id = await draftCase(app)
        const results = await Promise.all(Array.from({ length: 6 }, () => submit(app, id)))
        expect(results.map((res) => res.status).sort()).toEqual([200, 409, 409, 409, 409, 409])
        expect((await jobs(id)).map((job) => job.status)).toEqual(['delivered'])
      } finally {
        await small.end()
      }
    })

    it('pins exactly what was saved when an edit races the submit', async () => {
      const app = await makeApp()
      const id = await draftCase(app)

      const [edit, submitted] = await overlapping<request.Response>(id, [
        () => editAnswers(app, id, 'خلاصه هم‌زمان'),
        () => submit(app, id),
      ])
      expect(submitted!.status).toBe(200)
      expect([200, 409]).toContain(edit!.status)
      if (edit!.status === 409) expect(edit!.body.error).toBe('request_not_draft')

      const stored = await pool.query<{ answers: { summary: string } }>('SELECT answers FROM dashboard.requests WHERE id = $1', [id])
      const [pinned] = await pinnedProposal(id)
      expect(pinned!.answers.summary).toBe(stored.rows[0]!.answers.summary)
      expect(pinned!.answers.summary).toBe(edit!.status === 200 ? 'خلاصه هم‌زمان' : 'خلاصه اولیه')
    })

    it('never leaves an uploaded proposal outside the pinned snapshot when an upload races the submit', async () => {
      const app = await makeApp()
      const id = await draftCase(app)

      const [late, submitted] = await overlapping<request.Response>(id, [
        () => upload(app, id, 'late.pdf'),
        () => submit(app, id),
      ])
      expect(submitted!.status).toBe(200)
      expect([201, 404]).toContain(late!.status)

      const docs = await pool.query<{ id: string; storage_key: string }>(
        'SELECT id, storage_key FROM dashboard.private_documents WHERE request_id = $1',
        [id],
      )
      expect(docs.rows).toHaveLength(late!.status === 201 ? 2 : 1)
      const [pinned] = await pinnedProposal(id)
      expect(pinned!.proposal_documents.map((doc) => doc.id).sort()).toEqual(docs.rows.map((doc) => doc.id).sort())
      // A refused upload takes its bytes back with it. The RFP file is the one other file.
      expect(storedFiles()).toHaveLength(docs.rows.length + 1)
    })

    it('rolls the whole submit back when its history cannot be written, then succeeds once', async () => {
      const app = await makeApp()
      const id = await draftCase(app)
      const before = await footprint(id)

      const failed = await whileInsertFails('activities', "NEW.action = 'submit'", () => submit(app, id))
      expect(failed.status).toBe(500)
      expect(await footprint(id)).toEqual(before)

      expect((await submit(app, id)).status).toBe(200)
      expect(await footprint(id)).toMatchObject({ status: 'in_review', history: 1, jobs: 1, letters: 1, proposals: 1, agreements: 2, verifications: 1 })
    })
  })

  describe('fourth evaluation', () => {
    it('reaches 4/4 once when all four finalize together and the case stays with the chief', async () => {
      const app = await makeApp()
      const { id, revision } = await roundCase(app)

      const results = await overlapping(id, [...THREE, 'employer-1'].map((user) => () => finalize(app, user, id, revision)))
      expect(results.map((res) => res.status)).toEqual([200, 200, 200, 200])

      expect(await actionCount(id, 'review_round_complete')).toBe(1)
      expect(await completion(app, id)).toMatchObject({ finalized: 4, ready: true })
      expect(await caseState(id)).toEqual({ status: 'in_review', review_stage: 'triaged', revision })
    })

    it('never lets a decision made at the moment of the fourth evaluation see an incomplete round', async () => {
      const app = await makeApp()
      const { id, revision } = await roundCase(app)
      await finalizeAll(app, id, revision, THREE)

      const [fourth, decision] = await overlapping<request.Response>(id, [
        () => finalize(app, 'employer-1', id, revision),
        () => decide(app, id, { action: 'advance', expectedRevision: revision }),
      ])
      expect(fourth!.status).toBe(200)
      expect(await actionCount(id, 'review_round_complete')).toBe(1)

      if (decision!.status === 200) {
        expect(await caseState(id)).toMatchObject({ review_stage: 'advanced', revision: revision + 1 })
      } else {
        expect(decision!.status).toBe(409)
        expect(decision!.body.error).toBe('round_not_ready')
        expect(await caseState(id)).toMatchObject({ review_stage: 'triaged', revision })
        expect((await decide(app, id, { action: 'advance', expectedRevision: revision })).status).toBe(200)
      }
      expect(await actionCount(id, 'chief_review_advance')).toBe(1)
    })

    it('settles the fourth slot on one person when the evaluation races a replacement', async () => {
      const app = await makeApp()
      const { id, revision } = await roundCase(app)
      await finalizeAll(app, id, revision, ['reviewer-1', 'reviewer-2', 'employer-1'])

      const [evaluation, replacement] = await overlapping<request.Response>(id, [
        () => finalize(app, 'reviewer-3', id, revision),
        () => replaceReviewer(app, id, 'reviewer-3', 'reviewer-4', revision),
      ])
      const round = await completion(app, id)
      const replacements = await countOf('review_replacements', id)
      if (evaluation!.status === 200) {
        expect(replacement!.status).toBe(409)
        expect(replacement!.body.error).toBe('evaluation_final')
        expect(replacements).toBe(0)
        expect(round).toMatchObject({ finalized: 4, ready: true })
        expect(await actionCount(id, 'review_round_complete')).toBe(1)
      } else {
        expect(replacement!.status).toBe(200)
        expect(replacements).toBe(1)
        expect(round).toMatchObject({ finalized: 3, ready: false })
        expect(await actionCount(id, 'review_round_complete')).toBe(0)
        await finalizeAll(app, id, revision, ['reviewer-4'])
        expect(await actionCount(id, 'review_round_complete')).toBe(1)
      }
    })

    it('does not lock the fourth evaluation when its completion cannot be recorded, and a retry completes once', async () => {
      const app = await makeApp()
      const { id, revision } = await roundCase(app)
      await finalizeAll(app, id, revision, THREE)

      const failed = await whileInsertFails('activities', "NEW.action = 'review_round_complete'", () =>
        finalize(app, 'employer-1', id, revision),
      )
      expect(failed.status).toBe(500)
      const stored = await pool.query(
        "SELECT 1 FROM dashboard.evaluations WHERE request_id = $1 AND user_id = 'employer-1' AND state = 'final'",
        [id],
      )
      expect(stored.rowCount).toBe(0)
      expect(await completion(app, id)).toMatchObject({ finalized: 3, ready: false })
      expect((await decide(app, id, { action: 'advance', expectedRevision: revision })).body.error).toBe('round_not_ready')

      await finalizeAll(app, id, revision, ['employer-1'])
      expect(await completion(app, id)).toMatchObject({ finalized: 4, ready: true })
      expect(await actionCount(id, 'review_round_complete')).toBe(1)
    })
  })

  describe('stale revision', () => {
    /** The refusal names the conflict, and the case keeps everything it had. */
    async function expectStale(id: string, send: () => PromiseLike<request.Response>, error: string) {
      const before = await footprint(id)
      const res = await send()
      expect(res.status).toBe(409)
      expect(res.body.error).toBe(error)
      expect(await footprint(id)).toEqual(before)
    }

    it('refuses every action sent from a screen older than the current revision', async () => {
      const app = await makeApp()
      const { id, revision: firstRound } = await roundCase(app)
      await finalizeAll(app, id, firstRound, [...THREE, 'employer-1'])
      await expectStale(id, () => decide(app, id, { action: 'advance', expectedRevision: firstRound - 1 }), 'stale_revision')
      const returned = await decide(app, id, { action: 'return', reason: REASON, expectedRevision: firstRound })
      expect(returned.status).toBe(200)
      // The decision has been taken, so a second one is refused for the state whatever revision it names.
      await expectStale(id, () => decide(app, id, { action: 'advance', expectedRevision: firstRound }), 'invalid_decision_state')

      expect((await editAnswers(app, id, 'خلاصه اصلاح‌شده')).status).toBe(200)
      const resubmitted = await post(app, 'company-user-1', `/requests/${id}/resubmit`, consent)
      expect(resubmitted.status).toBe(200)
      const current = resubmitted.body.request.revision as number
      expect(current).toBeGreaterThan(firstRound)

      await expectStale(id, () => triage(app, id, { action: 'accept', expectedRevision: firstRound }), 'stale_revision')
      const accepted = await triage(app, id, { action: 'accept', expectedRevision: current })
      expect(accepted.status).toBe(200)
      const next = accepted.body.request.revision as number

      await expectStale(
        id,
        () => post(app, 'chief', `/requests/${id}/review-round`, { reviewerIds: THREE, expectedRevision: current }),
        'stale_revision',
      )
      expect((await post(app, 'chief', `/requests/${id}/review-round`, { reviewerIds: THREE, expectedRevision: next })).status).toBe(201)

      await expectStale(id, () => replaceReviewer(app, id, 'reviewer-1', 'reviewer-4', current), 'stale_revision')
      await expectStale(
        id,
        () => post(app, 'owner', `/requests/${id}/review-round/employer/replace`, { employerId: 'employer-2', reason: REASON, expectedRevision: current }),
        'stale_revision',
      )

      // Reviewers still on the earlier round's screen write nothing into the new one.
      await expectStale(id, () => finalize(app, 'reviewer-1', id, firstRound), 'stale_evaluation')
      await expectStale(
        id,
        () => request(app).put(`/requests/${id}/evaluation`).set(auth('reviewer-2')).send({ revision: firstRound, scores }),
        'stale_evaluation',
      )
    })

    it('takes one of two triage decisions sent from the same screen', async () => {
      const app = await makeApp()
      const { id, revision } = await submittedCase(app)

      const results = await overlapping(id, [
        () => triage(app, id, { action: 'accept', expectedRevision: revision }),
        () => triage(app, id, { action: 'return', reason: REASON, expectedRevision: revision }),
      ])
      expect(results.map((res) => res.status).sort()).toEqual([200, 409])
      expect((await caseState(id)).revision).toBe(revision + 1)
      const decisions = (await actionCount(id, 'chief_accept')) + (await actionCount(id, 'chief_return'))
      expect(decisions).toBe(1)
    })

    it('refuses a reopen from a screen older than the rejection', async () => {
      const app = await makeApp()
      const { id, revision } = await submittedCase(app)
      expect((await triage(app, id, { action: 'reject', reason: REASON, expectedRevision: revision })).status).toBe(200)

      await expectStale(
        id,
        () => post(app, 'owner', `/admin/requests/${id}/reopen`, { reason: REASON, expectedRevision: revision }),
        'stale_revision',
      )
      const results = await overlapping(id, [
        () => post(app, 'owner', `/admin/requests/${id}/reopen`, { reason: REASON, expectedRevision: revision + 1 }),
        () => post(app, 'owner', `/admin/requests/${id}/reopen`, { reason: REASON, expectedRevision: revision + 1 }),
      ])
      expect(results.map((res) => res.status).sort()).toEqual([200, 409])
      expect((await caseState(id)).revision).toBe(revision + 2)
    })
  })

  describe('file failure', () => {
    it('records nothing when the file cannot be written, and the same upload works once storage is back', async () => {
      const app = await makeApp()
      const id = await emptyDraft(app)
      const before = await footprint(id)
      const filesBefore = storedFiles()

      const broken = await makeApp({ documents: unwritableStorage() })
      const failed = await upload(broken, id)
      expect(failed.status).toBe(500)
      expect(await countOf('private_documents', id)).toBe(0)
      expect(await footprint(id)).toEqual(before)
      expect(storedFiles()).toEqual(filesBefore)

      // Nothing half-saved lets the case through.
      const early = await submit(app, id)
      expect(early.status).toBe(400)
      expect(early.body.missingFields).toContain('proposalDocuments')
      expect(await footprint(id)).toEqual(before)

      expect((await upload(app, id)).status).toBe(201)
      expect((await submit(app, id)).status).toBe(200)
    })

    it('takes the bytes back when the document row cannot be saved', async () => {
      const app = await makeApp()
      const id = await emptyDraft(app)
      const filesBefore = storedFiles()

      const failed = await whileInsertFails('private_documents', 'true', () => upload(app, id))
      expect(failed.status).toBe(500)
      expect(await countOf('private_documents', id)).toBe(0)
      expect(storedFiles()).toEqual(filesBefore)

      const retried = await upload(app, id)
      expect(retried.status).toBe(201)
      expect((await get(app, 'company-user-1', `/documents/${retried.body.document.id}/download`)).status).toBe(200)
      expect(storedFiles()).toHaveLength(filesBefore.length + 1)
    })

    it('publishes no RFP version when one of its files fails, and leaves the earlier state in place', async () => {
      const app = await makeApp()
      const { eventId, subtopicId } = await subtopicFixture(app)
      const failing = await makeApp({ documents: new DiskFullAfter(storageRoot, 1) })

      const failed = await publishRfp(failing, eventId, subtopicId, ['first.pdf', 'second.pdf'])
      expect(failed.status).toBe(500)
      expect(storedFiles()).toEqual([])
      expect((await pool.query('SELECT 1 FROM dashboard.rfp_versions WHERE subtopic_id = $1', [subtopicId])).rowCount).toBe(0)
      const subtopic = await pool.query('SELECT current_rfp_version_id FROM dashboard.event_subtopics WHERE id = $1', [subtopicId])
      expect(subtopic.rows[0].current_rfp_version_id).toBeNull()

      const retried = await publishRfp(app, eventId, subtopicId, ['first.pdf', 'second.pdf'])
      expect(retried.status).toBe(201)
      expect(retried.body.version.files).toHaveLength(2)
      expect(storedFiles()).toHaveLength(2)
    })

    it('reports lost bytes as unavailable without disturbing the case', async () => {
      const app = await makeApp()
      const id = await emptyDraft(app)
      const uploaded = await upload(app, id)
      const documentId = uploaded.body.document.id as string
      const { storage_key: key } = (
        await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents WHERE id = $1', [documentId])
      ).rows[0]!
      await storage.remove(key)
      const before = await footprint(id)

      const download = await get(app, 'company-user-1', `/documents/${documentId}/download`)
      expect(download.status).toBe(410)
      expect(download.body.error).toBe('document_unavailable')
      expect(JSON.stringify(download.body)).not.toContain(key)
      expect((await get(app, 'company-user-1', `/documents/${documentId}`)).status).toBe(200)
      expect(await footprint(id)).toEqual(before)
    })

    it('keeps company approval when a registry document cannot be saved', async () => {
      const app = await makeApp()
      const [company] = await companyStore.list()
      const uploadRegistryDocument = () =>
        request(app)
          .post('/documents')
          .set(auth('company-user-1'))
          .field('category', 'articlesOfAssociation')
          .field('companyId', company!.id)
          .attach('file', Buffer.from('%PDF-1.4 articles'), { filename: 'articles.pdf', contentType: 'application/pdf' })
      const approval = async () =>
        (
          await pool.query<{ status: string }>(
            'SELECT status FROM dashboard.company_verifications WHERE company_id = $1 ORDER BY revision DESC LIMIT 1',
            [company!.id],
          )
        ).rows[0]?.status

      const failed = await whileInsertFails('private_documents', 'true', uploadRegistryDocument)
      expect(failed.status).toBe(500)
      expect(await approval()).toBe('approved')
      expect(storedFiles()).toEqual([])

      // Once the document really is saved, approval is withdrawn for re-verification.
      expect((await uploadRegistryDocument()).status).toBe(201)
      expect(await approval()).not.toBe('approved')
    })
  })

  describe('notification retry', () => {
    const failedDelivery = <T>(run: () => PromiseLike<T>) =>
      whileInsertFails('letters', "NEW.type = 'notification'", run)
    const retry = (app: App, jobId: string) => post(app, 'owner', `/admin/notifications/jobs/${jobId}/retry`)
    const companyLetters = async (app: App) =>
      (await get(app, 'company-user-1', '/letters')).body.items as Array<{ requestId: string }>

    it('keeps the transition when delivery fails, and recovers it through retries without repeating it', async () => {
      const app = await makeApp()
      const id = await draftCase(app)

      const submitted = await failedDelivery(() => submit(app, id))
      expect(submitted.status).toBe(200)
      const committed = await footprint(id)
      expect(committed).toMatchObject({ status: 'in_review', history: 1, jobs: 1, letters: 0 })
      const [failed] = await jobs(id)
      expect(failed).toMatchObject({ status: 'failed', attempts: 1, letter_id: null })
      expect(failed!.last_error).toContain('forced letters failure')

      // Still failing: the attempt is counted and nothing else moves.
      const stillFailing = await failedDelivery(() => retry(app, failed!.id))
      expect(stillFailing.status).toBe(200)
      expect(stillFailing.body.result.status).toBe('failed')
      expect((await jobs(id))[0]).toMatchObject({ status: 'failed', attempts: 2 })
      expect(await footprint(id)).toEqual(committed)

      const recovered = await retry(app, failed!.id)
      expect(recovered.body.result.status).toBe('delivered')
      expect((await jobs(id))[0]).toMatchObject({ status: 'delivered', attempts: 3, last_error: null })
      expect(await footprint(id)).toEqual({ ...committed, letters: 1 })
      expect((await companyLetters(app)).filter((letter) => letter.requestId === id)).toHaveLength(1)
    })

    it('delivers one letter when several operators retry the same job together', async () => {
      const app = await makeApp()
      const id = await draftCase(app)
      await failedDelivery(() => submit(app, id))
      const [job] = await jobs(id)

      const results = await Promise.all(Array.from({ length: 6 }, () => retry(app, job!.id)))
      expect(results.map((res) => res.status)).toEqual(Array(6).fill(200))
      expect(results.map((res) => res.body.result.status)).toEqual(Array(6).fill('delivered'))
      expect(results.filter((res) => !res.body.result.alreadyDelivered)).toHaveLength(1)
      expect(new Set(results.map((res) => res.body.result.letterId)).size).toBe(1)

      expect(await countOf('letters', id)).toBe(1)
      expect((await jobs(id))[0]).toMatchObject({ status: 'delivered', attempts: 2 })
      expect(await actionCount(id, 'submit')).toBe(1)
    })

    it('delivers each job once when bulk retries overlap', async () => {
      const app = await makeApp()
      const { id, revision } = await failedDelivery(async () => {
        const draft = await draftCase(app)
        const submitted = await submit(app, draft)
        expect(submitted.status).toBe(200)
        return { id: draft, revision: submitted.body.request.revision as number }
      })
      const accepted = await failedDelivery(() => triage(app, id, { action: 'accept', expectedRevision: revision }))
      expect(accepted.status).toBe(200)
      const committed = await footprint(id)
      const undelivered = await jobs(id)
      expect(undelivered.length).toBeGreaterThanOrEqual(2)
      expect(undelivered.map((job) => job.status)).toEqual(undelivered.map(() => 'failed'))

      const results = await Promise.all([1, 2, 3].map(() => post(app, 'owner', '/admin/notifications/retry-all')))
      expect(results.map((res) => res.status)).toEqual([200, 200, 200])

      const settled = await jobs(id)
      expect(settled.map((job) => job.status)).toEqual(settled.map(() => 'delivered'))
      expect(new Set(settled.map((job) => job.letter_id)).size).toBe(settled.length)
      expect(await footprint(id)).toEqual({ ...committed, letters: settled.length })

      const again = await post(app, 'owner', '/admin/notifications/retry-all')
      expect(again.body.results).toEqual([])
    })

    it('rolls a decision back when its notification job cannot be recorded', async () => {
      const app = await makeApp()
      const { id, revision } = await submittedCase(app)
      const before = await footprint(id)

      const failed = await whileInsertFails('notification_jobs', 'true', () =>
        triage(app, id, { action: 'accept', expectedRevision: revision }),
      )
      expect(failed.status).toBe(500)
      expect(await footprint(id)).toEqual(before)

      // The refused attempt spent nothing, so the same screen can send it again.
      expect((await triage(app, id, { action: 'accept', expectedRevision: revision })).status).toBe(200)
      expect((await footprint(id)).revision).toBe(revision + 1)
      expect(await actionCount(id, 'chief_accept')).toBe(1)
    })
  })
})
