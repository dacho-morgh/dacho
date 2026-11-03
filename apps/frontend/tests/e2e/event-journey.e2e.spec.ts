import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { randomInt } from 'node:crypto'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

/**
 * FE31 (S6): one event case from the company's submission to the company reading its
 * published result. Every step runs in the session of the role that owns it. Users, the
 * event and the company's verification are set up first, as the other dashboard specs do.
 * Steps whose screens belong to other slices (submission, triage, the round, the four
 * evaluations and the chief's decision) go through that role's same-origin dashboard API;
 * the financial package, the investment memo and the publication go through their screens.
 */

test.use({ channel: 'chrome' })
test.describe.configure({ mode: 'serial' })

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const password = 'event-journey-test-only'
const suffix = `${Date.now()}${randomInt(100, 999)}`.slice(-8)
const lastCompleted = new Date().getUTCFullYear() - 1
const STATEMENT_YEARS = [lastCompleted - 2, lastCompleted - 1, lastCompleted]
const MEMO = `یادداشت داخلی سرمایه‌گذاری ${suffix}`
const companyName = `شرکت آزمون مسیر ${suffix}`
const RESULT = `نتیجه رسمی: درخواست شما برای ادامه همکاری پذیرفته شد (${suffix}).`

const ROLES = {
  owner: 'system-owner',
  secretariat: 'central-secretariat',
  chief: 'chief-reviewer',
  employer: 'employer-reviewer',
  reviewer1: 'reviewer',
  reviewer2: 'reviewer',
  reviewer3: 'reviewer',
  investment: 'investment-reviewer',
  company: 'representative',
} as const
type Role = keyof typeof ROLES

let payload: Awaited<ReturnType<typeof getPayload>>
const ids = {} as Record<Role, string>
let companyId = ''
let companyUserId: number | string = ''
let serviceId = ''
let requestId = ''
const contexts = {} as Record<Role, BrowserContext>

const dashboardDb = () =>
  (payload.db as unknown as { pool: { query(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }> } }).pool

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${name}\n%%EOF\n`) })

const phoneOf = (index: number) => `09${(Number(suffix) + index).toString().padStart(9, '0').slice(-9)}`

/** A role's own signed-in browser context; its API calls go through the same-origin dashboard proxy. */
async function signedIn(browser: Browser, role: Role): Promise<BrowserContext> {
  const context = await browser.newContext({ locale: 'fa-IR' })
  const response = await context.request.post(`${BASE}/api/users/login`, {
    data: { username: phoneOf(Object.keys(ROLES).indexOf(role)), password },
  })
  expect(response.ok(), `${role} signs in`).toBe(true)
  return context
}

async function api<T = Record<string, unknown>>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await request.fetch(`${BASE}/api/dashboard${path}`, {
    method,
    ...(body === undefined ? {} : { data: body as Record<string, unknown> }),
  })
  const text = await response.text()
  expect(response.ok(), `${method} ${path} -> ${response.status()} ${text.slice(0, 300)}`).toBe(true)
  return (text ? JSON.parse(text) : {}) as T
}

const as = (role: Role) => contexts[role].request

async function open(role: Role, path: string): Promise<Page> {
  const page = await contexts[role].newPage()
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  expect(response?.status(), `${role} opens ${path}`).toBe(200)
  return page
}

const scores = {
  a: { technologyLevel: { tier: 'mid', score: 5 }, interdisciplinary: 6, innovation: { articles: true, domesticPatentCount: 2, international: true }, customization: 7, developmentMethod: { tier: 'improvement', score: 5 }, environment: { tier: 'appropriate', score: 7 } },
  b: { developmentStage: { tier: 'industrial', score: 8 }, addedValue: 6, marketReach: { tier: 'international', score: 12 }, futureOilGasDemand: 7, importSubstitution: 8 },
  c: { technicalReportQuality: { tier: 'appropriate', score: 8 }, scientificAuthorityEndorsement: 5, nationalStandard: 10, isoProductQuality: 10, salesContracts: 4 },
}
const ordinaryAnswers = {
  technicalApproachClear: 'yes', objectivesAchievableOnTime: 'yes', scientificPrinciplesSound: 'yes',
  operationsDetailedRealistic: 'yes', resourcesListed: 'no', scheduleExecutable: 'yes', budgetBreakdown: 'yes',
  costsJustified: 'yes', costBenefitAnalysis: 'yes', environmentalImpactsIdentified: 'yes',
  environmentalMitigation: 'yes', riskAssessmentDone: 'yes', risksMitigated: 'no', recommendation: 'recommend',
  topFive: { answer: 'yes', rationale: 'طرح قوی' },
}
const employerAnswers = {
  risk: {
    assessment: { done: 'yes' },
    financial: { budgetSufficiency: 'no', costDrivers: 'مواد اولیه', minMaxCosts: '۱۰ تا ۳۰' },
    technical: { newTechnology: 'yes', teamSkills: 'yes', materialsEquipmentTimely: 'yes', productionIssues: 'کم' },
    schedule: { schedule: 'سه ماه', supplyDelays: 'no', otherTimingFactors: 'آب‌وهوا' },
    legal: { permits: 'yes', localNationalCompliance: 'yes', futureIssues: 'no' },
    human: { teamSizeSkills: 'yes', tensionsConflicts: 'no', training: 'yes' },
    environment: { negativeImpacts: 'no', mitigation: 'yes' },
    stakeholders: { keyStakeholders: 'وزارت نفت', support: 'yes', conflicts: 'no' },
    external: { economicPoliticalSocial: 'no', unpredictable: 'ارز' },
  },
  recommendation: 'strongly_recommend',
  topFive: { answer: 'yes', rationale: 'تناسب صنعتی' },
}

test.beforeAll(async ({ browser }) => {
  payload = await getPayload({ config })
  for (const [index, [role, operationalRole]] of Object.entries(ROLES).entries()) {
    const phone = phoneOf(index)
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `journey-${role}-${suffix}@example.invalid`,
        username: phone,
        phone,
        password,
        name: `آزمون ${role}`,
        ...(operationalRole === 'representative' ? {} : { operationalRole, isActive: true }),
      } as never,
      context: { allowPersonnelProvisioning: true },
      overrideAccess: true,
    })
    ids[role as Role] = String(user.id)
    if (role === 'company') companyUserId = user.id
  }
  const company = await payload.create({
    collection: 'companies',
    data: {
      name: companyName,
      nationalId: `11${suffix}`,
      registrationNumber: suffix,
      type: 'سهامی خاص',
      province: 'بوشهر',
      city: 'بوشهر',
      establishmentDate: '2010',
      representative: companyUserId,
    } as never,
    overrideAccess: true,
  })
  companyId = String(company.id)
  // Company verification has its own UAT and screens; this case starts from a verified company.
  await dashboardDb().query(
    `INSERT INTO dashboard.company_verifications (company_id, representative_id, status, snapshot)
     VALUES ($1, $2, 'approved', $3)`,
    [companyId, ids.company, JSON.stringify({ company: { id: companyId, name: companyName } })],
  )
  serviceId = String((await payload.find({ collection: 'services', limit: 1, overrideAccess: true })).docs[0]!.id)

  for (const role of Object.keys(ROLES) as Role[]) contexts[role] = await signedIn(browser, role)
})

test.afterAll(async () => {
  for (const context of Object.values(contexts)) await context?.close()
  if (requestId) await dashboardDb().query('DELETE FROM dashboard.requests WHERE id = $1', [requestId])
  if (companyId) await dashboardDb().query('DELETE FROM dashboard.company_verifications WHERE company_id = $1', [companyId])
})

test('an event case travels from submission to the company reading its published result', async () => {
  test.setTimeout(10 * 60_000)
  let revision = 0

  await test.step('the owner opens an event with a subtopic and its RFP', async () => {
    const { event } = await api<{ event: { id: string } }>(as('owner'), 'POST', '/admin/events', {
      title: `رویداد آزمون مسیر ${suffix}`,
      description: 'رویداد آزمون انتها به انتها',
      registrationOpenAt: '2026-01-01T00:00:00Z',
      registrationCloseAt: `${lastCompleted + 3}-01-01T00:00:00Z`,
      responsibleChiefId: ids.chief,
      responsibleInvestmentId: ids.investment,
    })
    const { category } = await api<{ category: { id: string } }>(as('owner'), 'POST', `/admin/events/${event.id}/categories`, { title: 'انرژی' })
    const { subtopic } = await api<{ subtopic: { id: string } }>(as('owner'), 'POST', `/admin/events/${event.id}/subtopics`, {
      title: `زیرموضوع آزمون ${suffix}`, categoryId: category.id, employerId: ids.employer,
    })
    // Uploaded from the owner's browser as the event screen does: Playwright's multipart drops the
    // empty expectedVersionId that a first version must send.
    const ownerPage = await open('owner', '/dashboard')
    const uploaded = await ownerPage.evaluate(async (path) => {
      const form = new FormData()
      form.append('files', new Blob(['%PDF-1.4\n% rfp\n%%EOF\n'], { type: 'application/pdf' }), 'rfp.pdf')
      form.append('reason', 'نسخه اولیه')
      form.append('expectedVersionId', '')
      const response = await fetch(path, { method: 'POST', body: form })
      return { ok: response.ok, body: await response.text() }
    }, `/api/dashboard/admin/events/${event.id}/subtopics/${subtopic.id}/rfp`)
    await ownerPage.close()
    expect(uploaded.ok, uploaded.body).toBe(true)
    const version = (JSON.parse(uploaded.body) as { version: { id: string } }).version

    const { request } = await api<{ request: { id: string } }>(as('company'), 'POST', '/requests', {
      serviceId,
      title: `طرح آزمون مسیر ${suffix}`,
      answers: { applicationTeam: [{ name: 'سارا حسینی', role: 'مدیر پروژه' }], summary: 'خلاصه طرح' },
      eventId: event.id,
      subtopicId: subtopic.id,
      rfpVersionId: version.id,
    })
    requestId = request.id
  })

  await test.step('the company submits its proposal', async () => {
    const proposal = await as('company').post(`${BASE}/api/dashboard/documents`, {
      multipart: { category: 'proposal', requestId, file: pdf('proposal.pdf') },
    })
    expect(proposal.ok(), await proposal.text()).toBe(true)
    const { agreements } = await api<{ agreements: { type: string; version: string }[] }>(as('company'), 'GET', '/agreements')
    const versionOf = (type: string) => agreements.find((agreement) => agreement.type === type)!.version
    const { request } = await api<{ request: { revision: number } }>(as('company'), 'POST', `/requests/${requestId}/submit`, {
      nonCompeteAcceptance: { accepted: true, textVersionId: versionOf('non_compete') },
      eventRulesAcceptance: { accepted: true, textVersionId: versionOf('event_rules') },
    })
    revision = request.revision
  })

  await test.step('the chief accepts it at triage and starts the round', async () => {
    const triaged = await api<{ request: { revision: number } }>(as('chief'), 'POST', `/requests/${requestId}/triage`, {
      action: 'accept', expectedRevision: revision,
    })
    revision = triaged.request.revision
    await api(as('chief'), 'POST', `/requests/${requestId}/review-round`, {
      reviewerIds: [ids.reviewer1, ids.reviewer2, ids.reviewer3], expectedRevision: revision,
    })
  })

  await test.step('the employer and three reviewers finalize their evaluations', async () => {
    for (const role of ['employer', 'reviewer1', 'reviewer2', 'reviewer3'] as const) {
      await api(as(role), 'POST', `/requests/${requestId}/evaluation/finalize`, {
        revision, scores, answers: role === 'employer' ? employerAnswers : ordinaryAnswers,
      })
    }
  })

  await test.step('the chief advances the case to the financial stage', async () => {
    await api(as('chief'), 'POST', `/requests/${requestId}/review-decision`, { action: 'advance', expectedRevision: revision })
  })

  await test.step('the company uploads and submits its financial package on its case page', async () => {
    const page = await open('company', `/dashboard/requests/${requestId}`)
    const form = page.getByTestId('financial-package-form')
    await expect(form.getByText('درخواست تکمیل بسته مالی دریافت شد')).toBeVisible({ timeout: 60_000 })
    const slots = form.getByTestId('financial-package-slot')
    await expect(slots).toHaveCount(5 + STATEMENT_YEARS.length)
    for (let index = 0; index < 5 + STATEMENT_YEARS.length; index += 1) {
      const slot = slots.nth(index)
      await slot.locator('input[type="file"]').setInputFiles(pdf(`financial-${index}.pdf`))
      await expect(slot.getByText(`financial-${index}.pdf`)).toBeVisible({ timeout: 30_000 })
    }
    await page.getByRole('button', { name: 'ثبت و ارسال بسته مالی' }).click()
    const submitted = page.getByTestId('financial-package-submitted')
    await expect(submitted.getByText('بسته مالی با موفقیت ثبت شد')).toBeVisible({ timeout: 30_000 })
    await expect(submitted.getByTestId('financial-package-count')).toHaveText(
      `${(5 + STATEMENT_YEARS.length).toLocaleString('fa-IR')} فایل دریافت شده`,
    )
    // Before publication the company sees a pending result and nothing internal.
    await expect(page.getByTestId('result-pending').filter({ visible: true })).toBeVisible()
    await page.close()
  })

  await test.step('the investment person reads the dossier and sends a memo to the Secretariat', async () => {
    const page = await open('investment', `/dashboard/requests/${requestId}`)
    const dossier = page.getByTestId('investment-dossier')
    await expect(dossier.getByTestId('investment-evaluations').locator('li')).toHaveCount(4, { timeout: 60_000 })
    await expect(dossier.getByTestId('investment-package-files').locator('li')).toHaveCount(5 + STATEMENT_YEARS.length)
    // The investment person writes a memo; there is no decision control.
    for (const name of ['تایید', 'رد', 'بازگشت برای اصلاح']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
    await page.getByLabel('متن یادداشت').fill(MEMO)
    await page.getByRole('button', { name: 'ثبت نسخه' }).click()
    await page.getByRole('button', { name: 'ارجاع به دبیرخانه' }).click()
    const confirm = page.getByTestId('memo-send-confirm')
    await expect(confirm.getByText(MEMO)).toBeVisible({ timeout: 30_000 })
    await expect(confirm.getByText(companyName)).toBeVisible()
    await confirm.getByRole('button', { name: 'تایید و ارسال به دبیرخانه' }).click()
    await expect(page.getByText(/ارسال .*/).filter({ hasText: 'نسخه' }).first()).toBeVisible({ timeout: 30_000 })
    await page.close()
  })

  await test.step('the company still sees no memo and no result', async () => {
    const page = await open('company', `/dashboard/requests/${requestId}`)
    await expect(page.getByTestId('result-pending').filter({ visible: true })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(MEMO)).toHaveCount(0)
    await page.close()
  })

  await test.step('the Secretariat finds the case in its queue, previews and publishes a separate text', async () => {
    const queue = await open('secretariat', '/dashboard/follow-ups')
    await queue.getByRole('link', { name: new RegExp(`طرح آزمون مسیر ${suffix}`) }).click()
    await queue.waitForURL(`**/dashboard/requests/${requestId}`, { timeout: 60_000 })
    const panel = queue.getByTestId('secretariat-follow-up')
    await expect(panel.getByText('پرونده آماده انتشار نتیجه است')).toBeVisible({ timeout: 60_000 })
    await expect(panel.getByText(MEMO)).toBeVisible()
    // The memo never prefills the company's text.
    await expect(panel.getByLabel('متن جداگانه نتیجه')).toHaveValue('')
    await panel.getByLabel('متن جداگانه نتیجه').fill(RESULT)
    await panel.getByRole('button', { name: 'ثبت پیش‌نویس و پیش‌نمایش' }).click()
    const preview = panel.getByTestId('result-preview')
    await expect(preview.getByText(RESULT)).toBeVisible({ timeout: 30_000 })
    await expect(preview.getByText(companyName)).toBeVisible()
    await preview.getByRole('button', { name: 'انتشار و ارسال به شرکت' }).click()
    await expect(panel.getByText('نتیجه این پرونده منتشر شده است')).toBeVisible({ timeout: 30_000 })
    await queue.close()
  })

  await test.step('the company reads its published result, and only that text', async () => {
    const page = await open('company', `/dashboard/requests/${requestId}`)
    const result = page.getByTestId('published-result').filter({ visible: true })
    await expect(result.getByText('نتیجه نهایی درخواست شما منتشر شد')).toBeVisible({ timeout: 60_000 })
    await expect(result.getByTestId('published-result-body')).toHaveText(RESULT)
    await expect(page.getByText(MEMO)).toHaveCount(0)
    await page.close()
  })
})
