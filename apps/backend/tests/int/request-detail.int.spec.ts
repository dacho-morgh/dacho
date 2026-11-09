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
import { InMemoryPublicRecordStore } from '../../src/exhibitions/exhibition-store.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { clearVerifiedCompanies, seedVerifiedCompanies } from './verified-company-fixtures.js'
import { PUBLIC_EVENT_FIELDS } from './public-event-fields.js'
import {
  CURRENT_EVENT_RULES_VERSION,
  CURRENT_NON_COMPETE_VERSION,
} from '../../src/dashboard/request-repo.js'

// #288: the request page's event, company card, history actors, reviewer list and
// stages, per role. Each role keeps exactly the access it had: reviewers and the
// employer still never learn who owns the case.

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString, application_name: 'design-qa-288-request-detail' })

const NAMES = {
  owner: 'صاحب سیستم',
  secretariat: 'دبیرخانه مرکزی',
  chief: 'امیر احمدی',
  'chief-2': 'سردبیر دیگر',
  investment: 'مسئول سرمایه‌گذاری',
  'investment-2': 'سرمایه‌گذاری دیگر',
  'reviewer-1': 'داور یکم',
  'reviewer-2': 'داور دوم',
  'reviewer-3': 'داور سوم',
  'employer-1': 'کارفرمای رویداد',
  'company-user-1': 'نماینده شرکت ۱۰',
  'company-user-2': 'نماینده شرکت دیگر',
} as const
type Person = keyof typeof NAMES

const ROLE_OF: Record<Person, string> = {
  owner: 'system-owner',
  secretariat: 'central-secretariat',
  chief: 'chief-reviewer',
  'chief-2': 'chief-reviewer',
  investment: 'investment-reviewer',
  'investment-2': 'investment-reviewer',
  'reviewer-1': 'reviewer',
  'reviewer-2': 'reviewer',
  'reviewer-3': 'reviewer',
  'employer-1': 'employer-reviewer',
  'company-user-1': 'representative',
  'company-user-2': 'representative',
}

const userStore = new InMemoryUserStore(
  (Object.keys(NAMES) as Person[]).map((id) => ({ id, phone: `phone-${id}`, name: NAMES[id], operationalRole: ROLE_OF[id], isActive: true })),
)
const COMPANY_NAME = 'شرکت فناوران خلیج فارس'
const companyStore = new InMemoryCompanyStore([
  {
    name: COMPANY_NAME,
    nationalId: 'Q288-company-1',
    representativeId: 'company-user-1',
    type: 'دانش‌بنیان',
    status: 'فعال',
    province: 'بوشهر',
    city: 'عسلویه',
    foundingYear: '1395',
    establishmentDate: '2010',
    activityDomain: 'فناوری نفت و گاز',
    productsServices: ['سامانه پایش خطوط لوله'],
    keyMembers: [{ name: 'مریم کاظمی', role: 'مدیرعامل' }],
    pastProjectsCustomers: [{ project: 'پایش خط لوله پارس جنوبی', customer: 'پتروشیمی' }],
    certificatesLicenses: [{ title: 'گواهی دانش‌بنیان' }],
  },
  { name: 'شرکت دیگر', nationalId: 'Q288-company-2', representativeId: 'company-user-2', establishmentDate: '2012' },
])
const publicRecords = new InMemoryPublicRecordStore({ firstId: 2880 })

const auth = (id: Person) => ({ 'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': id })

const makeApp = async () =>
  createApp({
    pool,
    userStore,
    companyStore,
    jwt: await JwtSigner.create('test'),
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    // The CMS keeps no workflow for services any more; event applications get the backend's stages.
    serviceCatalog: new InMemoryServiceCatalog([
      { id: 'q288-event-service', key: 'events', title: 'رویدادها و رقابت‌ها', workflow: [], formFields: null },
    ]),
    proxySecret: 'test-proxy-secret',
    publicRecords,
  })
type App = Awaited<ReturnType<typeof makeApp>>

const consent = {
  nonCompeteAcceptance: { accepted: true, textVersionId: CURRENT_NON_COMPETE_VERSION },
  eventRulesAcceptance: { accepted: true, textVersionId: CURRENT_EVENT_RULES_VERSION },
}
const THREE = ['reviewer-1', 'reviewer-2', 'reviewer-3'] as const
const FOUR = ['employer-1', ...THREE] as const
const lastCompleted = new Date().getUTCFullYear() - 1
const YEARS = [lastCompleted - 2, lastCompleted - 1, lastCompleted]
const OTHER_CATEGORIES = FINANCIAL_CATEGORIES.filter((category) => category !== 'financialStatements')

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
const evaluation = (user: string, revision: number) => ({
  revision,
  scores,
  answers: user.startsWith('employer') ? employerAnswers : ordinaryAnswers,
})

const upload = (app: App, id: string, category: string, filename: string, statementYear?: number) => {
  const call = request(app).post('/documents').set(auth('company-user-1')).field('category', category).field('requestId', id)
  if (statementYear !== undefined) call.field('statementYear', String(statementYear))
  return call.attach('file', Buffer.from(`%PDF-1.4 ${filename}`), { filename, contentType: 'application/pdf' })
}

async function cleanup() {
  const docFiles = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
  const rfpFiles = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.rfp_files')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='q288-event-service'; DELETE FROM dashboard.events")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all([...docFiles, ...rfpFiles].map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)))
  await clearVerifiedCompanies(pool)
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id IN ('company-user-1', 'company-user-2')")
}

let app: App
let eventId: string
let publicEventId: string
/** In the review round: employer untouched, reviewer-1 opened it, reviewer-2 has a draft, reviewer-3 is final. */
let roundCase: { id: string; revision: number }
/** Advanced, package submitted and handed to `investment`. */
let investmentCase: { id: string }

async function submitted(subtopicId: string, rfpVersionId: string, title: string) {
  const created = await request(app)
    .post('/requests')
    .set(auth('company-user-1'))
    .send({
      serviceId: 'q288-event-service',
      title,
      answers: { applicationTeam: [{ name: 'سارا حسینی', role: 'مدیر پروژه' }], summary: 'خلاصه' },
      eventId,
      subtopicId,
      rfpVersionId,
    })
  expect(created.status).toBe(201)
  const id = created.body.request.id as string
  expect((await upload(app, id, 'proposal', 'proposal.pdf')).status).toBe(201)
  const sent = await request(app).post(`/requests/${id}/submit`).set(auth('company-user-1')).send(consent)
  expect(sent.status).toBe(200)
  const accepted = await request(app)
    .post(`/requests/${id}/triage`)
    .set(auth('chief'))
    .send({ action: 'accept', expectedRevision: sent.body.request.revision })
  expect(accepted.status).toBe(200)
  const revision = accepted.body.request.revision as number
  const started = await request(app)
    .post(`/requests/${id}/review-round`)
    .set(auth('chief'))
    .send({ reviewerIds: THREE, expectedRevision: revision })
  expect(started.status).toBe(201)
  return { id, revision }
}

const get = (user: Person, path: string) => request(app).get(path).set(auth(user))
const detail = async (user: Person, id: string) => {
  const res = await get(user, `/requests/${id}`)
  expect(res.status, user).toBe(200)
  return res.body
}

describe('#288 request page data per role (int)', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
    await cleanup()
    await companyStore.setLogo('1', '77')
    await seedVerifiedCompanies(pool, companyStore)
    app = await makeApp()

    const eventRes = await request(app)
      .post('/admin/events')
      .set(auth('owner'))
      .send({
        title: 'رویداد فناوری‌های نفت و گاز',
        description: 'توضیحات',
        registrationOpenAt: '2020-01-01T00:00:00Z',
        registrationCloseAt: '2099-01-01T00:00:00Z',
        responsibleChiefId: 'chief',
        responsibleInvestmentId: 'investment',
        ...PUBLIC_EVENT_FIELDS,
      })
    expect(eventRes.status).toBe(201)
    eventId = eventRes.body.event.id
    publicEventId = eventRes.body.event.publicEventId
    publicRecords.setImage('events', publicEventId, { url: '/api/media/file/poster.jpg', alt: 'پوستر رویداد' })
    const category = await request(app).post(`/admin/events/${eventId}/categories`).set(auth('owner')).send({ title: 'انرژی' })
    const subtopics: { subtopicId: string; rfpVersionId: string }[] = []
    for (const title of ['پایش خطوط لوله', 'بازیافت گاز مشعل']) {
      const subtopic = await request(app)
        .post(`/admin/events/${eventId}/subtopics`)
        .set(auth('owner'))
        .send({ title, categoryId: category.body.category.id, employerId: 'employer-1' })
      expect(subtopic.status).toBe(201)
      const rfp = await request(app)
        .post(`/admin/events/${eventId}/subtopics/${subtopic.body.subtopic.id}/rfp`)
        .set(auth('owner'))
        .field('expectedVersionId', '')
        .field('reason', 'نسخه اولیه')
        .attach('files', Buffer.from('%PDF-rfp'), { filename: 'rfp.pdf', contentType: 'application/pdf' })
      expect(rfp.status).toBe(201)
      subtopics.push({ subtopicId: subtopic.body.subtopic.id, rfpVersionId: rfp.body.version.id })
    }

    roundCase = await submitted(subtopics[0]!.subtopicId, subtopics[0]!.rfpVersionId, 'طرح پایش هوشمند')
    expect((await get('reviewer-1', `/review/cases/${roundCase.id}`)).status).toBe(200)
    expect((await request(app).put(`/requests/${roundCase.id}/evaluation`).set(auth('reviewer-2')).send(evaluation('reviewer-2', roundCase.revision))).status).toBe(200)
    expect((await request(app).post(`/requests/${roundCase.id}/evaluation/finalize`).set(auth('reviewer-3')).send(evaluation('reviewer-3', roundCase.revision))).status).toBe(200)

    const second = await submitted(subtopics[1]!.subtopicId, subtopics[1]!.rfpVersionId, 'طرح بازیافت گاز')
    for (const user of FOUR) {
      expect((await request(app).post(`/requests/${second.id}/evaluation/finalize`).set(auth(user)).send(evaluation(user, second.revision))).status).toBe(200)
    }
    expect((await request(app).post(`/requests/${second.id}/review-decision`).set(auth('chief')).send({ action: 'advance', expectedRevision: second.revision })).status).toBe(200)
    for (const category of OTHER_CATEGORIES) expect((await upload(app, second.id, category, `${category}.pdf`)).status).toBe(201)
    for (const year of YEARS) expect((await upload(app, second.id, 'financialStatements', `statements-${year}.pdf`, year)).status).toBe(201)
    expect((await request(app).post(`/requests/${second.id}/financial-package`).set(auth('company-user-1'))).status).toBe(201)
    investmentCase = { id: second.id }
  }, 60_000)

  afterAll(async () => {
    await cleanup()
    await pool.end()
  })

  // First, so the reviewers' reads in later blocks have not yet marked the employer's slot as viewed.
  describe('reviewer list of the round', () => {
    type Slot = { userId: string; name: string | null; avatarUrl: null; status: string; slot: string }
    const slotsOf = async (user: Person) => {
      const res = await get(user, `/requests/${roundCase.id}/review-round`)
      expect(res.status, user).toBe(200)
      return res.body.round.slots as Slot[]
    }

    it('names each of the four slots with its progress for oversight', async () => {
      for (const user of ['owner', 'secretariat', 'chief'] as const) {
        const slots = (await slotsOf(user)).sort((a, b) => a.userId.localeCompare(b.userId))
        expect(slots.map(({ userId, name, avatarUrl, status, slot }) => ({ userId, name, avatarUrl, status, slot })), user).toEqual([
          { userId: 'employer-1', name: NAMES['employer-1'], avatarUrl: null, status: 'not_viewed', slot: 'employer' },
          { userId: 'reviewer-1', name: NAMES['reviewer-1'], avatarUrl: null, status: 'in_review', slot: 'ordinary' },
          { userId: 'reviewer-2', name: NAMES['reviewer-2'], avatarUrl: null, status: 'in_review', slot: 'ordinary' },
          { userId: 'reviewer-3', name: NAMES['reviewer-3'], avatarUrl: null, status: 'final', slot: 'ordinary' },
        ])
      }
      const rounds = await get('chief', `/requests/${roundCase.id}/review-rounds`)
      expect(rounds.body.items[0].slots.map((slot: Slot) => slot.name)).toContain(NAMES['reviewer-3'])
    })

    it('gives a reviewer only their own slot, name and progress', async () => {
      const slots = await slotsOf('reviewer-2')
      expect(slots).toHaveLength(1)
      expect(slots[0]).toMatchObject({ userId: 'reviewer-2', name: NAMES['reviewer-2'], status: 'in_review' })
      const text = JSON.stringify(slots)
      for (const other of ['reviewer-1', 'reviewer-3', 'employer-1', NAMES['reviewer-1'], NAMES['employer-1']]) {
        expect(text).not.toContain(other)
      }
    })

    it('turns «مشاهده نشده» into «درحال بررسی» once the employer opens the case', async () => {
      await detail('employer-1', roundCase.id)
      const employer = (await slotsOf('chief')).find((slot) => slot.slot === 'employer')!
      expect(employer.status).toBe('in_review')
      expect((await slotsOf('employer-1'))[0]).toMatchObject({ name: NAMES['employer-1'], status: 'in_review' })
    })

    it('keeps the round closed to the company and the investment person', async () => {
      expect((await get('company-user-1', `/requests/${roundCase.id}/review-round`)).status).toBe(403)
      expect((await get('investment', `/requests/${investmentCase.id}/review-round`)).status).toBe(403)
    })
  })

  describe('event block', () => {
    it('gives every reader of the case its event: title, subtopic, poster, dates and place', async () => {
      for (const user of ['owner', 'secretariat', 'chief', 'reviewer-1', 'employer-1', 'company-user-1'] as const) {
        const { event } = await detail(user, roundCase.id)
        expect(event, user).toEqual({
          id: eventId,
          title: 'رویداد فناوری‌های نفت و گاز',
          category: { id: expect.any(String), title: 'انرژی' },
          subtopic: { id: expect.any(String), title: 'پایش خطوط لوله' },
          image: { url: '/api/media/file/poster.jpg', alt: 'پوستر رویداد' },
          startDate: PUBLIC_EVENT_FIELDS.startDate,
          endDate: PUBLIC_EVENT_FIELDS.endDate,
          location: PUBLIC_EVENT_FIELDS.location,
          status: 'upcoming',
        })
      }
      expect((await detail('investment', investmentCase.id)).event.title).toBe('رویداد فناوری‌های نفت و گاز')
    })

    it('keeps the case page when the CMS does not answer, with the public fields empty', async () => {
      publicRecords.failNext.read = true
      const { event } = await detail('owner', roundCase.id)
      expect(event).toMatchObject({ title: 'رویداد فناوری‌های نفت و گاز', image: null, location: null, startDate: null })
    })
  })

  describe('company card', () => {
    it('shows the company, not its representative, to the supervisory roles, with logo, status, type and age', async () => {
      for (const [user, id] of [
        ['owner', roundCase.id], ['secretariat', roundCase.id], ['chief', roundCase.id], ['investment', investmentCase.id],
      ] as const) {
        const { company } = await detail(user, id)
        expect(company, user).toEqual({
          id: '1',
          name: COMPANY_NAME,
          type: 'دانش‌بنیان',
          province: 'بوشهر',
          city: 'عسلویه',
          status: 'فعال',
          active: true,
          foundingYear: '1395',
          ageYears: expect.any(Number),
          logo: { url: `/api/dashboard/requests/${id}/company/logo` },
          source: 'profile',
        })
        expect(company.name).not.toBe(NAMES['company-user-1'])
      }
    })

    it('gives reviewers and the employer only the pinned necessary profile, with no ids, logo, status or age', async () => {
      for (const user of ['reviewer-1', 'employer-1'] as const) {
        const { company } = await detail(user, roundCase.id)
        expect(company, user).toEqual({
          id: null,
          name: COMPANY_NAME,
          type: 'دانش‌بنیان',
          province: 'بوشهر',
          city: 'عسلویه',
          status: null,
          active: null,
          foundingYear: null,
          ageYears: null,
          logo: null,
          source: 'submission',
        })
      }
    })

    it('gives the company its own card without the logo, which only the Secretariat and Owner manage', async () => {
      const { company } = await detail('company-user-1', roundCase.id)
      expect(company).toMatchObject({ id: '1', name: COMPANY_NAME, status: 'فعال', logo: null })
    })

    it('serves the logo through the case only to supervisory roles that can read the case', async () => {
      for (const [user, id] of [
        ['owner', roundCase.id], ['secretariat', roundCase.id], ['chief', roundCase.id], ['investment', investmentCase.id],
      ] as const) {
        const res = await get(user, `/requests/${id}/company/logo`)
        expect(res.status, user).toBe(200)
        expect(res.headers['content-type']).toBe('image/png')
        expect(res.headers['cache-control']).toBe('private, no-store, max-age=0')
        expect(res.headers['x-content-type-options']).toBe('nosniff')
      }
      for (const user of ['reviewer-1', 'employer-1', 'company-user-1', 'company-user-2'] as const) {
        expect((await get(user, `/requests/${roundCase.id}/company/logo`)).status, user).toBe(403)
      }
      // A supervisory role outside the case learns nothing more than for an unknown id.
      for (const user of ['chief-2', 'investment', 'investment-2'] as const) {
        expect((await get(user, `/requests/${roundCase.id}/company/logo`)).status, user).toBe(404)
      }
      expect((await get('owner', '/requests/00000000-0000-4000-8000-000000000000/company/logo')).status).toBe(404)
    })

    it('gives the company its own profile and resume beside the case, and nobody else', async () => {
      const own = (await detail('company-user-1', roundCase.id)).companyProfile
      expect(own.company).toMatchObject({ name: COMPANY_NAME, type: 'دانش‌بنیان', status: 'فعال', nationalId: 'Q288-company-1' })
      expect(own.dossier).toMatchObject({
        foundingYear: '1395',
        activityDomain: 'فناوری نفت و گاز',
        productsServices: ['سامانه پایش خطوط لوله'],
        keyMembers: [{ name: 'مریم کاظمی', role: 'مدیرعامل' }],
        certificatesLicenses: [{ title: 'گواهی دانش‌بنیان' }],
      })
      for (const user of ['owner', 'secretariat', 'chief', 'reviewer-1', 'employer-1'] as const) {
        expect((await detail(user, roundCase.id)).companyProfile, user).toBeNull()
      }
      expect((await detail('investment', investmentCase.id)).companyProfile).toBeNull()
    })
  })

  describe('history actors', () => {
    const rowOf = <R extends { action: string | null }>(timeline: R[], action: string): R => timeline.find((row) => row.action === action)!

    it('names who did each step for the owner, Secretariat, chief and investment person', async () => {
      for (const user of ['owner', 'secretariat', 'chief'] as const) {
        const { timeline } = await detail(user, roundCase.id)
        expect(rowOf(timeline, 'chief_accept'), user).toMatchObject({ actorName: NAMES.chief, actorRole: 'chief-reviewer' })
        expect(rowOf(timeline, 'submit'), user).toMatchObject({ actorName: NAMES['company-user-1'], actorRole: 'representative' })
      }
      const { timeline } = await detail('investment', investmentCase.id)
      expect(rowOf(timeline, 'chief_review_advance')).toMatchObject({ actorName: NAMES.chief })
    })

    it('names only its own account to the company and gives Fund staff as a role', async () => {
      const body = await detail('company-user-1', roundCase.id)
      expect(rowOf(body.timeline, 'submit')).toMatchObject({ actorName: NAMES['company-user-1'], actorRole: 'representative' })
      expect(rowOf(body.timeline, 'chief_accept')).toMatchObject({ actorName: null, actorRole: 'chief-reviewer' })
      expect(JSON.stringify(body)).not.toContain(NAMES.chief)
    })

    it('gives the company no Fund staff account id in any history, only its own', async () => {
      const staff = ['chief', 'owner', 'secretariat', 'investment', 'reviewer-1', 'reviewer-2', 'reviewer-3', 'employer-1']
      type Row = { action: string | null; actorId?: string | null }
      const page = (await detail('company-user-1', roundCase.id)).timeline as Row[]
      const history = (await get('company-user-1', `/requests/${roundCase.id}/history`)).body.items as Row[]
      const feed = (await get('company-user-1', '/activities?limit=1000')).body.items as Row[]
      for (const [label, rows] of [['page', page], ['history', history], ['activities', feed]] as const) {
        expect(rows.length, label).toBeGreaterThan(0)
        for (const row of rows) expect(staff, `${label} ${row.action}`).not.toContain(row.actorId)
        expect(rowOf(rows, 'chief_accept'), label).not.toHaveProperty('actorId')
        expect(rowOf(rows, 'submit').actorId, label).toBe('company-user-1')
      }
      // Fund-wide readers keep the staff account id.
      expect(rowOf((await detail('owner', roundCase.id)).timeline, 'chief_accept')).toMatchObject({ actorId: 'chief' })
      expect(rowOf((await get('chief', `/requests/${roundCase.id}/history`)).body.items, 'chief_accept')).toMatchObject({ actorId: 'chief' })
    })

    it('still gives reviewers and the employer no actor at all', async () => {
      for (const user of ['reviewer-1', 'employer-1'] as const) {
        const { timeline } = await detail(user, roundCase.id)
        expect(timeline.length, user).toBeGreaterThan(0)
        for (const row of timeline) {
          expect(row, user).not.toHaveProperty('actorId')
          expect(row, user).not.toHaveProperty('actorName')
          expect(row, user).not.toHaveProperty('actorRole')
        }
      }
    })
  })

  describe('owner identity stays hidden from reviewers and the employer', () => {
    it('leaves out the owner, the representative and every account id', async () => {
      for (const user of ['reviewer-1', 'employer-1'] as const) {
        const body = await detail(user, roundCase.id)
        expect(body.owner, user).toBeNull()
        expect(body.request, user).not.toHaveProperty('ownerId')
        expect(body.request, user).not.toHaveProperty('companyId')
        const text = JSON.stringify(body)
        for (const secret of ['company-user-1', NAMES['company-user-1'], 'phone-company-user-1', NAMES.chief]) {
          expect(text, `${user} ${secret}`).not.toContain(secret)
        }
      }
    })

    it('keeps the owner for every other role that had it', async () => {
      for (const user of ['owner', 'secretariat', 'chief', 'company-user-1'] as const) {
        expect((await detail(user, roundCase.id)).owner, user).toEqual({ id: 'company-user-1', name: NAMES['company-user-1'] })
      }
    })

    it('still refuses the case to roles outside it', async () => {
      for (const user of ['chief-2', 'investment', 'investment-2', 'company-user-2'] as const) {
        expect((await get(user, `/requests/${roundCase.id}`)).status, user).toBe(404)
      }
    })
  })

  describe('stages of an event application', () => {
    it('walks the fixed stages with the current one marked', async () => {
      const states = (body: { workflow: { key: string; state: string }[] }) => body.workflow.map((step) => `${step.key}:${step.state}`)
      expect(states(await detail('owner', roundCase.id))).toEqual([
        'submission:done', 'chief_triage:done', 'review:current', 'investment:upcoming', 'result:upcoming',
      ])
      expect(states(await detail('investment', investmentCase.id))).toEqual([
        'submission:done', 'chief_triage:done', 'review:done', 'investment:current', 'result:upcoming',
      ])
      for (const user of ['chief', 'reviewer-1', 'employer-1', 'company-user-1'] as const) {
        expect(states(await detail(user, roundCase.id)), user).toContain('review:current')
      }
    })

    it('carries the same blocks on the admin read', async () => {
      const res = await get('owner', `/admin/requests/${roundCase.id}`)
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ event: { id: eventId }, company: { name: COMPANY_NAME }, companyProfile: null })
      expect(res.body.workflow).toHaveLength(5)
    })
  })

})
