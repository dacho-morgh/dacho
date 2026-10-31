import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

// T42: seven roles against their own case, another team's case and a case they hold
// nothing on, over the real routes. The expected audiences are written out from
// docs/system/permission-matrix.md, so they are not derived from the production policy.

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString, application_name: 't42-access-matrix' })

const ROLES = ['owner', 'secretariat', 'chief', 'reviewer', 'employer', 'investment', 'company'] as const
type Role = (typeof ROLES)[number]
type Relation = 'own' | 'other' | 'unassigned'

const OPERATIONAL: Record<Role, string> = {
  owner: 'system-owner',
  secretariat: 'central-secretariat',
  chief: 'chief-reviewer',
  reviewer: 'reviewer',
  employer: 'employer-reviewer',
  investment: 'investment-reviewer',
  company: 'representative',
}

const teamOf = (suffix: string) => ({
  chief: `chief-${suffix}`,
  reviewers: [`reviewer-${suffix}1`, `reviewer-${suffix}2`, `reviewer-${suffix}3`],
  employer: `employer-${suffix}`,
  investment: `investment-${suffix}`,
  company: `rep-${suffix}`,
})
type Team = ReturnType<typeof teamOf>

const TEAM_A = teamOf('a')
const TEAM_B = teamOf('b')
const IDLE = teamOf('idle')

const flatten = (team: Team): [string, string][] => [
  [team.chief, 'chief-reviewer'],
  ...team.reviewers.map((id): [string, string] => [id, 'reviewer']),
  [team.employer, 'employer-reviewer'],
  [team.investment, 'investment-reviewer'],
  [team.company, 'representative'],
]

const users = [
  ['owner', 'system-owner'] as [string, string],
  ['secretariat', 'central-secretariat'] as [string, string],
  ...flatten(TEAM_A),
  ...flatten(TEAM_B),
  ...flatten(IDLE),
].map(([id, operationalRole]) => ({ id, phone: id, name: `نام ${id}`, operationalRole, isActive: true }))

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore(
  [TEAM_A, TEAM_B, IDLE].map((team, index) => ({
    name: `شرکت ${index}`,
    nationalId: `T42-company-${index}`,
    representativeId: team.company,
    establishmentDate: '2010',
  })),
)

const member = (team: Team, role: Role) => {
  if (role === 'owner' || role === 'secretariat') return role
  return role === 'reviewer' ? team.reviewers[0]! : team[role]
}

const PROXY_SECRET = 'test-proxy-secret'
const auth = (id: string) => ({ 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': id })

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
    proxySecret: PROXY_SECRET,
  })

type App = Awaited<ReturnType<typeof makeApp>>

const consent = {
  nonCompeteAcceptance: { accepted: true, textVersionId: CURRENT_NON_COMPETE_VERSION },
  eventRulesAcceptance: { accepted: true, textVersionId: CURRENT_EVENT_RULES_VERSION },
}

const lastCompleted = new Date().getUTCFullYear() - 1
const YEARS = [lastCompleted - 2, lastCompleted - 1, lastCompleted]
const OTHER_CATEGORIES = FINANCIAL_CATEGORIES.filter((category) => category !== 'financialStatements')

// Each secret carries a marker, so a leak through any field of any response is findable.
const FINANCIAL_MARK = 'FINMARK'
const DOSSIER_MARK = 'DOSSIERMARK'
const CLOSED_MARK = 'CLOSEDMARK'
const MEMO_SENT = 'MEMOSENTMARK'
const MEMO_DRAFT = 'MEMODRAFTMARK'
const RATIONALE = 'RATIONALEMARK'

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

const ordinaryAnswers = (user: string) => ({
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
  topFive: { answer: 'yes', rationale: `${RATIONALE} ${user}` },
})

const employerAnswers = (user: string) => ({
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
  topFive: { answer: 'yes', rationale: `${RATIONALE} ${user}` },
})

let app: App

const get = (user: string, path: string) => request(app).get(path).set(auth(user))
const post = (user: string, path: string, body: unknown = {}) =>
  request(app).post(path).set(auth(user)).send(body as object)

const uploadAs = (user: string, parent: { requestId?: string; companyId?: string }, category: string, filename: string, statementYear?: number) => {
  const pending = request(app).post('/documents').set(auth(user)).field('category', category)
  if (parent.requestId) pending.field('requestId', parent.requestId)
  if (parent.companyId) pending.field('companyId', parent.companyId)
  if (statementYear !== undefined) pending.field('statementYear', String(statementYear))
  return pending.attach('file', Buffer.from(`%PDF-1.4 ${filename}`), { filename, contentType: 'application/pdf' })
}

const companyIdOf = async (team: Team) =>
  (await companyStore.list()).find((company) => company.representativeId === team.company)!.id

const expectOk = (res: { status: number; body: unknown }, expected: number, label: string) => {
  expect(res.status, `${label}: ${JSON.stringify(res.body)}`).toBe(expected)
}

/** A draft of the team's company with its proposal uploaded, on an event of that team. */
async function draftCase(team: Team) {
  const eventRes = await post('owner', '/admin/events', {
    title: `رویداد ${team.company}`,
    description: 'توضیحات رویداد',
    registrationOpenAt: '2020-01-01T00:00:00Z',
    registrationCloseAt: '2099-01-01T00:00:00Z',
    responsibleChiefId: team.chief,
    responsibleInvestmentId: team.investment,
  })
  expectOk(eventRes, 201, 'event')
  const eventId = eventRes.body.event.id as string
  const category = await post('owner', `/admin/events/${eventId}/categories`, { title: 'دسته' })
  const subtopic = await post('owner', `/admin/events/${eventId}/subtopics`, {
    title: 'زیرموضوع',
    categoryId: category.body.category.id,
    employerId: team.employer,
  })
  const subtopicId = subtopic.body.subtopic.id as string
  const rfp = await request(app)
    .post(`/admin/events/${eventId}/subtopics/${subtopicId}/rfp`)
    .set(auth('owner'))
    .field('expectedVersionId', '')
    .field('reason', 'نسخه اولیه')
    .attach('files', Buffer.from('%PDF-RFP'), { filename: 'rfp.pdf', contentType: 'application/pdf' })
  expectOk(rfp, 201, 'rfp')

  const created = await post(team.company, '/requests', {
    serviceId: 'event-service',
    title: `طرح ${team.company}`,
    answers: { applicationTeam: [{ name: 'سارا حسینی', role: 'مدیر پروژه' }], summary: 'خلاصه' },
    eventId,
    subtopicId,
    rfpVersionId: rfp.body.version.id,
  })
  expectOk(created, 201, 'request')
  const id = created.body.request.id as string
  const proposal = await uploadAs(team.company, { requestId: id }, 'proposal', 'proposal.pdf')
  expectOk(proposal, 201, 'proposal')
  return { id, eventId, proposalId: proposal.body.document.id as string }
}

const finalizeAll = async (team: Team, id: string, revision: number) => {
  for (const user of [team.employer, ...team.reviewers]) {
    const answers = user === team.employer ? employerAnswers(user) : ordinaryAnswers(user)
    expectOk(await post(user, `/requests/${id}/evaluation/finalize`, { revision, scores, answers }), 200, `finalize ${user}`)
  }
}

interface CaseFixture {
  id: string
  eventId: string
  companyId: string
  representativeId: string
  proposalId: string
  dossierId: string
  financialIds: string[]
  deliveredId: string
  closedId: string
}

/** One case carried all the way to a published result, holding a file of every audience. */
async function publishedCase(team: Team): Promise<CaseFixture> {
  const companyId = await companyIdOf(team)
  // `catalogues` belongs to the private dossier without restarting verification.
  const dossier = await uploadAs(team.company, { companyId }, 'catalogues', `${DOSSIER_MARK}-${team.company}.pdf`)
  expectOk(dossier, 201, 'dossier')

  const { id, eventId, proposalId } = await draftCase(team)
  const submitted = await post(team.company, `/requests/${id}/submit`, consent)
  expectOk(submitted, 200, 'submit')
  const accepted = await post(team.chief, `/requests/${id}/triage`, { action: 'accept', expectedRevision: submitted.body.request.revision })
  expectOk(accepted, 200, 'triage')
  const revision = accepted.body.request.revision as number
  expectOk(await post(team.chief, `/requests/${id}/review-round`, { reviewerIds: team.reviewers, expectedRevision: revision }), 201, 'round')
  await finalizeAll(team, id, revision)
  expectOk(await post(team.chief, `/requests/${id}/review-decision`, { action: 'advance', expectedRevision: revision }), 200, 'advance')

  const financialIds: string[] = []
  for (const category of OTHER_CATEGORIES) {
    const file = await uploadAs(team.company, { requestId: id }, category, `${FINANCIAL_MARK}-${category}.pdf`)
    expectOk(file, 201, category)
    financialIds.push(file.body.document.id)
  }
  for (const year of YEARS) {
    const file = await uploadAs(team.company, { requestId: id }, 'financialStatements', `${FINANCIAL_MARK}-${year}.pdf`, year)
    expectOk(file, 201, `statements ${year}`)
    financialIds.push(file.body.document.id)
  }
  expectOk(await post(team.company, `/requests/${id}/financial-package`), 201, 'package')

  const saved = await post(team.investment, `/investment/cases/${id}/memo`, { body: MEMO_SENT })
  expectOk(saved, 201, 'memo')
  expectOk(await post(team.investment, `/investment/cases/${id}/memo/send`, { version: saved.body.memo.version }), 200, 'memo send')
  expectOk(await post(team.investment, `/investment/cases/${id}/memo`, { body: MEMO_DRAFT }), 201, 'memo draft')

  expectOk(await post('secretariat', `/requests/${id}/supplementary-requests`, { body: 'مدرک تکمیلی' }), 201, 'supplementary')
  const delivered = await uploadAs(team.company, { requestId: id }, 'correspondenceAttachment', 'delivered.pdf')
  expectOk(delivered, 201, 'delivered')
  expectOk(await post('secretariat', `/requests/${id}/supplementary-files`, { documentId: delivered.body.document.id }), 201, 'delivery')
  const closed = await uploadAs(team.company, { requestId: id }, 'correspondenceAttachment', `${CLOSED_MARK}.pdf`)
  expectOk(closed, 201, 'closed')

  const draft = await post('secretariat', `/requests/${id}/result`, { body: 'متن نتیجه' })
  expectOk(draft, 201, 'result')
  expectOk(await post('secretariat', `/requests/${id}/result/publish`, { version: draft.body.result.version }), 200, 'publish')

  return {
    id,
    eventId,
    companyId,
    representativeId: team.company,
    proposalId,
    dossierId: dossier.body.document.id,
    financialIds,
    deliveredId: delivered.body.document.id,
    closedId: closed.body.document.id,
  }
}

async function cleanup() {
  const files = (await pool.query<{ storage_key: string }>(
    'SELECT storage_key FROM dashboard.rfp_files UNION ALL SELECT storage_key FROM dashboard.private_documents',
  )).rows
  await pool.query('DELETE FROM dashboard.letters')
  await pool.query('DELETE FROM dashboard.requests; DELETE FROM dashboard.events')
  await pool.query('DELETE FROM dashboard.private_documents')
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all(files.map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)))
  await clearVerifiedCompanies(pool)
  await pool.query('DELETE FROM dashboard.company_verifications WHERE company_id = ANY($1::text[])', [
    (await companyStore.list()).map((company) => company.id),
  ])
}

let caseA: CaseFixture
let caseB: CaseFixture

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const UNKNOWN_TARGET = { id: UNKNOWN_ID, eventId: UNKNOWN_ID, companyId: '999999', representativeId: 'nobody' }
type Target = typeof UNKNOWN_TARGET

const everyone: readonly Role[] = ROLES
const internal: readonly Role[] = ['owner', 'secretariat', 'chief', 'reviewer', 'employer', 'investment']
const FUND_WIDE: readonly Role[] = ['owner', 'secretariat']

const READS: { path: (t: Target) => string; audience: readonly Role[] }[] = [
  { path: (t) => `/requests/${t.id}`, audience: everyone },
  { path: (t) => `/admin/requests/${t.id}`, audience: internal },
  { path: (t) => `/requests/${t.id}/history`, audience: everyone },
  { path: (t) => `/requests/${t.id}/proposal`, audience: everyone },
  { path: (t) => `/requests/${t.id}/verification`, audience: everyone },
  { path: (t) => `/requests/${t.id}/result`, audience: everyone },
  { path: (t) => `/documents?requestId=${t.id}`, audience: everyone },
  { path: (t) => `/requests/${t.id}/financial-invitation`, audience: ['owner', 'secretariat', 'company'] },
  { path: (t) => `/requests/${t.id}/financial-package`, audience: ['owner', 'secretariat', 'company'] },
  { path: (t) => `/investment/cases/${t.id}`, audience: ['investment'] },
  { path: (t) => `/requests/${t.id}/investment-memos`, audience: ['owner', 'secretariat'] },
  { path: (t) => `/requests/${t.id}/follow-up`, audience: ['owner', 'secretariat'] },
  { path: (t) => `/requests/${t.id}/supplementary-requests`, audience: ['owner', 'secretariat', 'company'] },
  { path: (t) => `/requests/${t.id}/review-round`, audience: ['owner', 'secretariat', 'chief', 'reviewer', 'employer'] },
  { path: (t) => `/requests/${t.id}/review-rounds`, audience: ['owner', 'secretariat', 'chief'] },
  { path: (t) => `/requests/${t.id}/review-round/candidates`, audience: ['chief'] },
  { path: (t) => `/requests/${t.id}/evaluation`, audience: ['reviewer', 'employer'] },
  { path: (t) => `/requests/${t.id}/evaluations`, audience: ['owner', 'secretariat', 'chief'] },
  { path: (t) => `/review/cases/${t.id}`, audience: ['reviewer', 'employer'] },
  { path: (t) => `/admin/requests/${t.id}/assignments`, audience: ['owner', 'secretariat'] },
  { path: (t) => `/admin/companies/${t.representativeId}`, audience: ['owner', 'secretariat'] },
  { path: (t) => `/documents?companyId=${t.companyId}`, audience: ['owner', 'secretariat', 'company'] },
  { path: (t) => `/admin/events/${t.eventId}`, audience: ['owner', 'secretariat', 'chief', 'investment'] },
]

const FILES: { name: string; ids: (c: CaseFixture) => string[]; audience: readonly Role[] }[] = [
  { name: 'proposal', ids: (c) => [c.proposalId], audience: everyone },
  { name: 'financial', ids: (c) => c.financialIds, audience: ['owner', 'secretariat', 'investment', 'company'] },
  { name: 'company dossier', ids: (c) => [c.dossierId], audience: ['owner', 'secretariat', 'company'] },
  { name: 'delivered correspondence', ids: (c) => [c.deliveredId], audience: ['owner', 'secretariat', 'investment', 'company'] },
  { name: 'undelivered correspondence', ids: (c) => [c.closedId], audience: ['owner', 'secretariat', 'company'] },
]

const RELATIONS: Relation[] = ['own', 'other', 'unassigned']

/** Who asks about which case. The owner and Secretariat are Fund-wide, so all three stay open to them. */
const seat = (role: Role, relation: Relation) => ({
  actor: member(relation === 'unassigned' ? IDLE : TEAM_A, role),
  target: relation === 'other' ? caseB : caseA,
})

const open = (audience: readonly Role[], role: Role, relation: Relation) =>
  audience.includes(role) && (FUND_WIDE.includes(role) || relation === 'own')

/** Same answer as an id that does not exist, so a refusal never confirms a record. */
async function expectIndistinguishable(actor: string, res: request.Response, unknownPath: string) {
  const unknown = await get(actor, unknownPath)
  expect({ status: res.status, body: res.body }).toEqual({ status: unknown.status, body: unknown.body })
}

describe('T42: seven roles across own, other and unassigned records (int)', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
    await cleanup()
    await seedVerifiedCompanies(pool, companyStore)
    app = await makeApp()
    caseA = await publishedCase(TEAM_A)
    caseB = await publishedCase(TEAM_B)
  }, 120_000)

  afterAll(async () => {
    await cleanup()
    await pool.end()
  })

  describe('API reads', () => {
    for (const { path, audience } of READS) {
      const label = path({ id: ':id', eventId: ':event', companyId: ':company', representativeId: ':representative' })
      for (const role of ROLES) {
        for (const relation of RELATIONS) {
          const allowed = open(audience, role, relation)
          it(`${label}: ${role}, ${relation} -> ${allowed ? 'open' : 'closed'}`, async () => {
            const { actor, target } = seat(role, relation)
            const res = await get(actor, path(target))
            if (allowed) {
              expect(res.status).toBe(200)
              return
            }
            expect([403, 404]).toContain(res.status)
            await expectIndistinguishable(actor, res, path(UNKNOWN_TARGET))
          })
        }
      }
    }
  })

  describe('files', () => {
    for (const { name, ids, audience } of FILES) {
      for (const role of ROLES) {
        for (const relation of RELATIONS) {
          const allowed = open(audience, role, relation)
          it(`${name}: ${role}, ${relation} -> ${allowed ? 'open' : 'closed'}`, async () => {
            const { actor, target } = seat(role, relation)
            for (const id of ids(target)) {
              const metadata = await get(actor, `/documents/${id}`)
              const download = await get(actor, `/documents/${id}/download`)
              if (allowed) {
                expect(metadata.status).toBe(200)
                expect(download.status).toBe(200)
                expect(download.headers['cache-control']).toContain('no-store')
                expect(download.headers['x-content-type-options']).toBe('nosniff')
              } else {
                expect(metadata.status).toBe(404)
                expect(download.status).toBe(404)
                await expectIndistinguishable(actor, metadata, `/documents/${UNKNOWN_ID}`)
                await expectIndistinguishable(actor, download, `/documents/${UNKNOWN_ID}/download`)
              }
            }
          })
        }
      }
    }

    it.each(ROLES)('lists exactly the case files %s may read', async (role) => {
      const res = await get(member(TEAM_A, role), `/documents?requestId=${caseA.id}`)
      const expected = FILES
        .filter(({ name, audience }) => name !== 'company dossier' && audience.includes(role))
        .flatMap(({ ids }) => ids(caseA))
      expect(res.body.items.map((item: { id: string }) => item.id).sort()).toEqual([...expected].sort())
    })

    it('never answers with a storage key, on any read of any role', async () => {
      const keys = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
      expect(keys.length).toBeGreaterThan(0)
      for (const role of ROLES) {
        for (const { path } of READS) {
          const text = JSON.stringify((await get(member(TEAM_A, role), path(caseA))).body)
          for (const { storage_key } of keys) expect(text).not.toContain(storage_key)
        }
      }
    })
  })

  describe('counts, lists and activity use the same scope as the detail', () => {
    // Fund-wide people see both cases, a team its own, and an idle person nothing.
    const visibleCases = (role: Role, idle: boolean) => {
      if (FUND_WIDE.includes(role)) return () => [caseA.id, caseB.id]
      return () => (idle ? [] : [caseA.id])
    }
    const seats = ROLES.flatMap((role) => [
      { role, idle: false },
      ...(FUND_WIDE.includes(role) ? [] : [{ role, idle: true }]),
    ])

    for (const { role, idle } of seats) {
      const name = `${role}${idle ? ', unassigned' : ''}`

      it(`${name}: /requests and /stats agree`, async () => {
        const actor = member(idle ? IDLE : TEAM_A, role)
        const ids = visibleCases(role, idle)()
        const list = await get(actor, '/requests?limit=100')
        expect(list.status).toBe(200)
        expect(list.body.items.map((item: { id: string }) => item.id).sort()).toEqual([...ids].sort())
        expect(list.body.total).toBe(ids.length)
        expect((await get(actor, '/stats')).body.total).toBe(ids.length)
        expect((await get(actor, '/stats/overview')).body.counts.total).toBe(ids.length)
      })

      it(`${name}: /admin/requests stays inside the scope`, async () => {
        const actor = member(idle ? IDLE : TEAM_A, role)
        const res = await get(actor, '/admin/requests?limit=100')
        if (role === 'company') {
          expect(res.status).toBe(403)
          return
        }
        expect(res.body.total).toBe(visibleCases(role, idle)().length)
      })

      it(`${name}: overview names only events in scope`, async () => {
        const actor = member(idle ? IDLE : TEAM_A, role)
        const text = JSON.stringify((await get(actor, '/stats/overview')).body.events)
        if (FUND_WIDE.includes(role)) {
          expect(text).toContain(caseA.eventId)
          expect(text).toContain(caseB.eventId)
        } else {
          expect(text).not.toContain(caseB.eventId)
          if (idle) expect(text).not.toContain(caseA.eventId)
        }
      })

      it(`${name}: /activities holds only cases in scope`, async () => {
        const actor = member(idle ? IDLE : TEAM_A, role)
        const res = await get(actor, '/activities?limit=1000')
        expect(res.status).toBe(200)
        const ids = visibleCases(role, idle)()
        const items = res.body.items as { id: string }[]
        const rows = (await pool.query<{ request_id: string | null }>(
          'SELECT request_id FROM dashboard.activities WHERE id = ANY($1::uuid[])',
          [items.map((item) => item.id)],
        )).rows
        expect(rows).toHaveLength(items.length)
        // The company and reviewers read a filtered part of a case's history, never nothing and never another case's.
        if (idle) expect(res.body.total).toBe(0)
        else expect(rows.map((row) => row.request_id)).toEqual(expect.arrayContaining([caseA.id]))
        if (!FUND_WIDE.includes(role)) {
          for (const row of rows) expect(ids).toContain(row.request_id)
        }
      })
    }

    it('narrows the queues to the holder and refuses them to other roles', async () => {
      const inbox = async (user: string, path: string) => (await get(user, path)).body.items.map((item: { requestId: string }) => item.requestId)
      expect(await inbox(TEAM_A.reviewers[0]!, '/review/queue?view=all')).toEqual([caseA.id])
      expect(await inbox(IDLE.reviewers[0]!, '/review/queue?view=all')).toEqual([])
      expect(await inbox(TEAM_A.investment, '/investment/queue')).toEqual([caseA.id])
      expect(await inbox(IDLE.investment, '/investment/queue')).toEqual([])
      for (const role of ROLES.filter((role) => role !== 'reviewer' && role !== 'employer')) {
        expect((await get(member(TEAM_A, role), '/review/queue?view=all')).status, role).toBe(403)
      }
      for (const role of ROLES.filter((role) => role !== 'investment')) {
        expect((await get(member(TEAM_A, role), '/investment/queue')).status, role).toBe(403)
      }
    })

    it('does not widen the scope through query parameters', async () => {
      const forged = `ownerId=${TEAM_B.company}&companyId=${caseB.companyId}&userId=owner&scope=all&role=system-owner`
      for (const user of [TEAM_A.company, TEAM_A.chief, TEAM_A.reviewers[0]!, TEAM_A.investment]) {
        const list = await get(user, `/requests?${forged}`)
        expect(list.body.items.map((item: { id: string }) => item.id), user).toEqual([caseA.id])
        expect((await get(user, `/stats?${forged}`)).body.total, user).toBe(1)
      }
    })
  })

  describe('financial and internal confidentiality in every open response', () => {
    // Followed by another character, so the `financial` risk section of the employer's own form does not count.
    const FINANCIAL_WORD = /financial[^"]/i
    const SECRETS: Record<Role, readonly (string | RegExp)[]> = {
      owner: [],
      secretariat: [MEMO_DRAFT],
      chief: [FINANCIAL_WORD, FINANCIAL_MARK, DOSSIER_MARK, CLOSED_MARK, MEMO_SENT, MEMO_DRAFT],
      reviewer: [FINANCIAL_WORD, FINANCIAL_MARK, DOSSIER_MARK, CLOSED_MARK, MEMO_SENT, MEMO_DRAFT, TEAM_A.reviewers[1]!, TEAM_A.employer],
      employer: [FINANCIAL_WORD, FINANCIAL_MARK, DOSSIER_MARK, CLOSED_MARK, MEMO_SENT, MEMO_DRAFT, TEAM_A.reviewers[0]!],
      investment: [DOSSIER_MARK, CLOSED_MARK],
      company: [MEMO_SENT, MEMO_DRAFT, RATIONALE, TEAM_A.reviewers[0]!, TEAM_A.employer],
    }

    for (const role of ROLES) {
      it(`${role} receives nothing outside its audience`, async () => {
        const actor = member(TEAM_A, role)
        const paths = [
          ...READS.filter(({ audience }) => audience.includes(role)).map(({ path }) => path(caseA)),
          '/requests?limit=100',
          '/stats/overview',
          '/activities?limit=1000',
        ]
        for (const path of paths) {
          const text = JSON.stringify((await get(actor, path)).body)
          for (const secret of SECRETS[role]) {
            if (typeof secret === 'string') expect(text, `${path} ${secret}`).not.toContain(secret)
            else expect(text, `${path} ${secret}`).not.toMatch(secret)
          }
        }
      })
    }

    it('gives the investment person the financial package only on the held case', async () => {
      const res = await get(TEAM_A.investment, `/investment/cases/${caseA.id}`)
      expect(JSON.stringify(res.body)).toContain(FINANCIAL_MARK)
      expect(res.body.package.documents).toHaveLength(caseA.financialIds.length)
    })

    it('refuses a financial or dossier file sent through a letter', async () => {
      const letters = async () => (await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM dashboard.letters')).rows[0]!.count
      const before = await letters()
      const attempts: [string, string, string, string][] = [
        [TEAM_A.chief, 'secretariat', caseA.id, caseA.financialIds[0]!],
        [TEAM_A.reviewers[0]!, TEAM_A.chief, caseA.id, caseA.financialIds[0]!],
        // The sender may read it, but the recipient may not.
        ['secretariat', TEAM_A.chief, caseA.id, caseA.financialIds[0]!],
        ['owner', TEAM_A.reviewers[0]!, caseA.id, caseA.financialIds[0]!],
        [TEAM_B.company, 'secretariat', caseB.id, caseA.financialIds[0]!],
        [TEAM_B.chief, TEAM_B.reviewers[0]!, caseB.id, caseA.proposalId],
        ['secretariat', TEAM_A.chief, caseA.id, caseA.dossierId],
      ]
      for (const [from, to, requestId, attachmentId] of attempts) {
        const res = await post(from, '/letters', {
          title: 'نامه',
          body: 'متن',
          recipientId: to,
          requestId,
          attachmentIds: [attachmentId],
        })
        expect([403, 404], `${from} -> ${to}: ${res.status}`).toContain(res.status)
      }
      expect(await letters()).toBe(before)
    })
  })

  describe('direct calls that skip the screens', () => {
    const SEATS = [
      'owner',
      'secretariat',
      ...[TEAM_A, TEAM_B, IDLE].flatMap((team) => flatten(team).map(([id]) => id)),
    ]

    type Attempt = (user: string, caseId: string) => request.Test

    const snapshot = async (id: string) => ({
      request: (await pool.query(
        'SELECT status::text AS status, review_stage, revision, title, owner_id FROM dashboard.requests WHERE id = $1',
        [id],
      )).rows[0],
      activities: (await pool.query('SELECT COUNT(*)::int AS count FROM dashboard.activities WHERE request_id = $1', [id])).rows[0].count,
      documents: (await pool.query('SELECT COUNT(*)::int AS count FROM dashboard.private_documents WHERE request_id = $1', [id])).rows[0].count,
      assignments: (await pool.query(
        'SELECT COUNT(*)::int AS count FROM dashboard.case_assignments WHERE request_id = $1 AND revoked_at IS NULL',
        [id],
      )).rows[0].count,
    })

    /** Everyone but the people the command belongs to is refused, and the case does not move. */
    async function expectOnly(id: string, label: string, allowed: readonly string[], attempt: Attempt) {
      const before = await snapshot(id)
      for (const user of SEATS.filter((seatId) => !allowed.includes(seatId))) {
        const res = await attempt(user, id)
        expect([403, 404], `${label} by ${user}: ${res.status} ${JSON.stringify(res.body)}`).toContain(res.status)
        // Someone who cannot read the case must not learn from a refusal that it exists.
        if ((await get(user, `/requests/${id}`)).status === 404) {
          const unknown = await attempt(user, UNKNOWN_ID)
          expect.soft({ status: res.status, body: res.body }, `${label} by ${user}`).toEqual({ status: unknown.status, body: unknown.body })
        }
      }
      expect(await snapshot(id), label).toEqual(before)
    }

    const company = TEAM_A.company
    const chief = TEAM_A.chief
    const holder = TEAM_A.investment

    it('refuses every command to everyone else, at the stage where it would otherwise succeed', async () => {
      const { id, eventId, proposalId } = await draftCase(TEAM_A)
      const uploadTo = (category: string, statementYear?: number): Attempt =>
        (user, target) => uploadAs(user, { requestId: target }, category, 'bypass.pdf', statementYear)
      const real = (target: string, value: string) => (target === id ? value : UNKNOWN_ID)

      // Draft.
      await expectOnly(id, 'edit draft', [company], (user, target) => request(app).patch(`/requests/${target}`).set(auth(user)).send({ title: 'تلاش' }))
      await expectOnly(id, 'submit', [company], (user, target) => post(user, `/requests/${target}/submit`, consent))
      await expectOnly(id, 'upload proposal', [company, 'owner', 'secretariat'], uploadTo('proposal'))
      await expectOnly(id, 'delete proposal', [company, 'owner'], (user, target) => request(app).delete(`/documents/${real(target, proposalId)}`).set(auth(user)))
      const submitted = await post(company, `/requests/${id}/submit`, consent)
      expectOk(submitted, 200, 'submit')

      // Triage.
      await expectOnly(id, 'triage', [chief], (user, target) =>
        post(user, `/requests/${target}/triage`, { action: 'accept', expectedRevision: submitted.body.request.revision }))
      const accepted = await post(chief, `/requests/${id}/triage`, { action: 'accept', expectedRevision: submitted.body.request.revision })
      expectOk(accepted, 200, 'triage')
      const revision = accepted.body.request.revision as number

      // Round.
      await expectOnly(id, 'start round', [chief], (user, target) =>
        post(user, `/requests/${target}/review-round`, { reviewerIds: TEAM_A.reviewers, expectedRevision: revision }))
      expectOk(await post(chief, `/requests/${id}/review-round`, { reviewerIds: TEAM_A.reviewers, expectedRevision: revision }), 201, 'round')

      const slots = [TEAM_A.employer, ...TEAM_A.reviewers]
      await expectOnly(id, 'save evaluation', slots, (user, target) =>
        request(app).put(`/requests/${target}/evaluation`).set(auth(user)).send({ revision, scores, answers: ordinaryAnswers(user) }))
      await expectOnly(id, 'finalize evaluation', slots, (user, target) =>
        post(user, `/requests/${target}/evaluation/finalize`, { revision, scores, answers: ordinaryAnswers(user) }))
      await expectOnly(id, 'replace reviewer', [chief], (user, target) =>
        post(user, `/requests/${target}/review-round/reviewers/${TEAM_A.reviewers[0]}/replace`, { expectedRevision: revision, replacementId: IDLE.reviewers[0], reason: 'تلاش' }))
      await expectOnly(id, 'replace employer', ['owner'], (user, target) =>
        post(user, `/requests/${target}/review-round/employer/replace`, { expectedRevision: revision, employerId: IDLE.employer, reason: 'تلاش' }))
      await expectOnly(id, 'assign', ['owner'], (user, target) =>
        post(user, `/admin/requests/${target}/assignments`, { userId: IDLE.reviewers[0], role: 'reviewer' }))
      await expectOnly(id, 'revoke assignment', ['owner'], (user, target) =>
        request(app).delete(`/admin/requests/${target}/assignments/${TEAM_A.reviewers[0]}`).set(auth(user)).send({ reason: 'تلاش' }))

      await finalizeAll(TEAM_A, id, revision)

      // Chief decision.
      await expectOnly(id, 'chief decision', [chief], (user, target) =>
        post(user, `/requests/${target}/review-decision`, { action: 'advance', expectedRevision: revision }))
      expectOk(await post(chief, `/requests/${id}/review-decision`, { action: 'advance', expectedRevision: revision }), 200, 'advance')

      // Financial package. The people assigned to review get nowhere near it.
      await expectOnly(id, 'upload financial', [company, 'owner', 'secretariat'], uploadTo('financialStatements', YEARS[0]))
      for (const category of OTHER_CATEGORIES) expectOk(await uploadAs(company, { requestId: id }, category, `${category}.pdf`), 201, category)
      for (const year of YEARS) expectOk(await uploadAs(company, { requestId: id }, 'financialStatements', `s-${year}.pdf`, year), 201, `year ${year}`)
      await expectOnly(id, 'submit package', [company], (user, target) => post(user, `/requests/${target}/financial-package`))
      expectOk(await post(company, `/requests/${id}/financial-package`), 201, 'package')

      // Memo.
      await expectOnly(id, 'save memo', [holder], (user, target) => post(user, `/investment/cases/${target}/memo`, { body: 'تلاش' }))
      const memo = await post(holder, `/investment/cases/${id}/memo`, { body: 'یادداشت' })
      expectOk(memo, 201, 'memo')
      await expectOnly(id, 'send memo', [holder], (user, target) => post(user, `/investment/cases/${target}/memo/send`, { version: memo.body.memo.version }))
      expectOk(await post(holder, `/investment/cases/${id}/memo/send`, { version: memo.body.memo.version }), 200, 'send')

      // Follow-up and publication belong to the Secretariat alone.
      const reply = await uploadAs(company, { requestId: id }, 'correspondenceAttachment', 'reply.pdf')
      expectOk(reply, 201, 'reply')
      await expectOnly(id, 'supplementary request', ['secretariat'], (user, target) => post(user, `/requests/${target}/supplementary-requests`, { body: 'تلاش' }))
      await expectOnly(id, 'deliver file', ['secretariat'], (user, target) => post(user, `/requests/${target}/supplementary-files`, { documentId: reply.body.document.id }))
      await expectOnly(id, 'draft result', ['secretariat'], (user, target) => post(user, `/requests/${target}/result`, { body: 'تلاش' }))
      const result = await post('secretariat', `/requests/${id}/result`, { body: 'متن' })
      expectOk(result, 201, 'result')
      await expectOnly(id, 'publish', ['secretariat'], (user, target) => post(user, `/requests/${target}/result/publish`, { version: result.body.result.version }))
      expect((await get(company, `/requests/${id}/result`)).body.result).toBeNull()

      // Event definitions.
      await expectOnly(id, 'create event', ['owner'], (user, target) => post(user, '/admin/events', {
        title: 'تلاش',
        description: 'تلاش',
        registrationOpenAt: '2020-01-01T00:00:00Z',
        registrationCloseAt: '2099-01-01T00:00:00Z',
        responsibleChiefId: chief,
        responsibleInvestmentId: holder,
      }))
      await expectOnly(id, 'edit event', ['owner'], (user, target) =>
        request(app).patch(`/admin/events/${real(target, eventId)}`).set(auth(user)).send({ title: 'تلاش', revision: 1, reason: 'تلاش' }))
      await expectOnly(id, 'add category', ['owner'], (user, target) => post(user, `/admin/events/${real(target, eventId)}/categories`, { title: 'تلاش' }))
    }, 120_000)

    it('leaves reopening a rejected case to the owner', async () => {
      const { id } = await draftCase(TEAM_A)
      const submitted = await post(company, `/requests/${id}/submit`, consent)
      expectOk(await post(chief, `/requests/${id}/triage`, { action: 'reject', reason: 'رد', expectedRevision: submitted.body.request.revision }), 200, 'reject')
      await expectOnly(id, 'reopen', ['owner'], (user, target) => post(user, `/admin/requests/${target}/reopen`, { reason: 'تلاش' }))
    })

    it('leaves the company decision to the people who verify', async () => {
      const verification = (await pool.query<{ id: string }>(
        'SELECT id FROM dashboard.company_verifications WHERE company_id = $1 ORDER BY revision DESC LIMIT 1',
        [caseA.companyId],
      )).rows[0]!.id
      const real = (target: string, value: string) => (target === caseA.id ? value : UNKNOWN_ID)
      await expectOnly(caseA.id, 'verification decision', ['owner', 'secretariat'], (user, target) =>
        post(user, `/admin/verifications/${real(target, verification)}/decision`, { action: 'approve' }))
    })

    it('takes the owner from the session, whatever the body claims', async () => {
      const created = await post(TEAM_B.company, '/requests', {
        serviceId: 'event-service',
        title: 'مالک جعلی',
        ownerId: TEAM_A.company,
        owner_id: TEAM_A.company,
        companyId: caseA.companyId,
        status: 'in_review',
        reviewStage: 'advanced',
      })
      expectOk(created, 201, 'create')
      const row = (await pool.query(
        'SELECT owner_id, company_id, status::text AS status, review_stage FROM dashboard.requests WHERE id = $1',
        [created.body.request.id],
      )).rows[0]
      expect(row).toEqual({ owner_id: TEAM_B.company, company_id: caseB.companyId, status: 'draft', review_stage: null })
    })

    it('ignores forwarded roles and refuses a missing proxy proof', async () => {
      const forged = { ...auth(TEAM_B.company), 'x-user-roles': 'admin,system-owner', 'x-operational-role': 'system-owner' }
      expect((await request(app).get(`/requests/${caseA.id}`).set(forged)).status).toBe(404)
      expect((await request(app).get(`/admin/companies/${caseA.companyId}`).set(forged)).status).toBe(403)
      expect((await request(app).get(`/documents/${caseA.financialIds[0]}/download`).set(forged)).status).toBe(404)

      const path = `/documents/${caseA.financialIds[0]}/download`
      expect((await request(app).get(path)).status).toBe(403)
      expect((await request(app).get(path).set('x-user-id', 'owner')).status).toBe(403)
      expect((await request(app).get(path).set({ ...auth('owner'), 'x-internal-proxy-secret': 'wrong' })).status).toBe(403)
      expect((await request(app).get(path).set('x-internal-proxy-secret', PROXY_SECRET)).status).toBe(401)
      expect((await get('nobody', path)).status).toBe(403)
    })

    it('ends financial access at the next request after a revocation, role change or deactivation', async () => {
      const download = `/documents/${caseA.financialIds[0]}/download`
      const account = users.find((user) => user.id === holder)!
      expect((await get(holder, download)).status).toBe(200)

      account.isActive = false
      expect((await get(holder, download)).status).toBe(403)
      account.isActive = true
      expect((await get(holder, download)).status).toBe(200)

      account.operationalRole = 'reviewer'
      expect((await get(holder, download)).status).toBe(404)
      account.operationalRole = 'investment-reviewer'
      expect((await get(holder, download)).status).toBe(200)

      expectOk(await request(app).delete(`/admin/requests/${caseA.id}/assignments/${holder}`).set(auth('owner')).send({ reason: 'پایان' }), 200, 'revoke')
      expect((await get(holder, download)).status).toBe(404)
      expect((await get(holder, `/investment/cases/${caseA.id}`)).status).toBe(404)
      expect((await get(holder, `/requests/${caseA.id}`)).status).toBe(404)
      const held = (await get(holder, '/requests?limit=100')).body.items.map((item: { id: string }) => item.id)
      expect(held).not.toContain(caseA.id)
    })
  })
})
