import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { randomInt } from 'node:crypto'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { JALALI_MONTHS } from '../../src/utilities/jalali'
import { utcInputToTehran } from '../../src/utilities/jalali-datetime'

/**
 * S5 (#243): the System Owner creates an event and an exhibition from the dashboard's
 * one events and exhibitions list, public page included, without the CMS admin. Another
 * role is refused both the pages and the API.
 */

test.describe.configure({ mode: 'serial' })

const persianDigits = (value: number | string) => String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!)

/** Enters a UTC instant the way a person does: a Jalali date from the calendar, then the Tehran hour and minute. */
async function setInstant(page: Page, label: string, utc: string) {
  const { date, hour, minute } = utcInputToTehran(`${utc}:00.000`)!
  const month = JALALI_MONTHS[date.month - 1]!
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('button', { name: 'انتخاب سال' }).click()
  await page.getByRole('group', { name: 'سال‌ها' }).getByRole('button', { name: persianDigits(date.year) }).click()
  await page.getByRole('button', { name: 'انتخاب ماه' }).click()
  await page.getByRole('group', { name: 'ماه‌ها' }).getByRole('button', { name: month, exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`(^|[\\s،])${persianDigits(date.day)}-ام ${month} ${persianDigits(date.year)}`) }).click()
  // Hour and minute are searchable dropdowns that show two Persian digits.
  for (const [part, value] of [['ساعت', hour], ['دقیقه', minute]] as const) {
    const text = persianDigits(String(value).padStart(2, '0'))
    await page.getByLabel(`${part} ${label}`).fill(text)
    await page.getByRole('option', { name: text, exact: true }).click()
  }
}

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const password = 'owner-admin-test-only'
const suffix = `${Date.now()}${randomInt(100, 999)}`.slice(-8)
const ROLES = {
  owner: 'system-owner',
  secretariat: 'central-secretariat',
  chief: 'chief-reviewer',
  investment: 'investment-reviewer',
} as const
type Role = keyof typeof ROLES

let payload: Awaited<ReturnType<typeof getPayload>>
const ids = {} as Record<Role, string>
const contexts = {} as Record<Role, BrowserContext>
const eventTitle = `رویداد مدیریت ${suffix}`
const exhibitionTitle = `نمایشگاه مدیریت ${suffix}`

const dashboardDb = () =>
  (payload.db as unknown as { pool: { query(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }> } }).pool

const phoneOf = (index: number) => `09${(Number(suffix) + 500 + index).toString().padStart(9, '0').slice(-9)}`

async function signedIn(browser: Browser, role: Role): Promise<BrowserContext> {
  const context = await browser.newContext({ locale: 'fa-IR', viewport: { width: 1440, height: 1024 } })
  const response = await context.request.post(`${BASE}/api/users/login`, {
    data: { username: phoneOf(Object.keys(ROLES).indexOf(role)), password },
  })
  expect(response.ok(), `${role} signs in`).toBe(true)
  return context
}

test.beforeAll(async ({ browser }) => {
  payload = await getPayload({ config })
  for (const [index, [role, operationalRole]] of Object.entries(ROLES).entries()) {
    const phone = phoneOf(index)
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `owner-admin-${role}-${suffix}@example.invalid`,
        username: phone,
        phone,
        password,
        name: `آزمون ${role} ${suffix}`,
        operationalRole,
        isActive: true,
      } as never,
      context: { allowPersonnelProvisioning: true },
      overrideAccess: true,
    })
    ids[role as Role] = String(user.id)
  }
  for (const role of Object.keys(ROLES) as Role[]) contexts[role] = await signedIn(browser, role)
})

test.afterAll(async () => {
  for (const context of Object.values(contexts)) await context?.close()
})

test('the owner creates an event and its public page from the dashboard', async () => {
  test.setTimeout(3 * 60_000)
  const page = await contexts.owner.newPage()
  await page.goto(`${BASE}/dashboard/events`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect(page.getByRole('heading', { name: 'رویدادها و نمایشگاه‌ها', level: 1 })).toBeVisible({ timeout: 60_000 })

  await page.getByRole('button', { name: 'رویداد یا نمایشگاه جدید' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: 'رویداد' }).click()
  await dialog.getByRole('button', { name: 'ادامه' }).click()
  await page.waitForURL(/\/dashboard\/events\/new\?type=event/)

  await page.getByLabel('عنوان رویداد').fill(eventTitle)
  await page.getByLabel('محل برگزاری').fill('بوشهر، سالن همایش')
  await setInstant(page, 'شروع برگزاری', '2030-03-01T08:00')
  await setInstant(page, 'پایان برگزاری', '2030-03-02T16:00')
  await page.getByLabel('شرح عمومی').fill('شرح عمومی رویداد آزمون')
  await setInstant(page, 'شروع ثبت‌نام', '2030-01-01T00:00')
  await setInstant(page, 'پایان ثبت‌نام', '2030-02-01T00:00')
  // The people dropdowns are the registration combobox: type to narrow, then pick by name.
  for (const [label, role] of [['سردبیر مسئول', 'chief'], ['مسئول سرمایه‌گذاری', 'investment']] as const) {
    await page.getByLabel(label).fill(`آزمون ${role} ${suffix}`)
    await page.getByRole('option', { name: new RegExp(`^آزمون ${role} ${suffix}`) }).click()
  }
  await page.getByRole('button', { name: 'ثبت رویداد' }).click()

  await page.waitForURL(/\/dashboard\/events\?saved=event-created/)
  await expect(page.getByRole('link', { name: eventTitle })).toBeVisible({ timeout: 30_000 })

  // Both records exist and point at each other.
  const pages = await payload.find({ collection: 'events', where: { title: { equals: eventTitle } }, overrideAccess: true })
  expect(pages.docs).toHaveLength(1)
  expect(pages.docs[0]!.location).toBe('بوشهر، سالن همایش')
  const { rows } = await dashboardDb().query('SELECT public_event_id FROM dashboard.events WHERE title = $1', [eventTitle])
  expect(rows).toEqual([{ public_event_id: String(pages.docs[0]!.id) }])
  await page.close()
})

test('the owner creates an exhibition with its booth limit from the same list', async () => {
  test.setTimeout(3 * 60_000)
  const page = await contexts.owner.newPage()
  // The old exhibitions entry lands on the same list, filtered to exhibitions.
  await page.goto(`${BASE}/dashboard/exhibitions`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForURL(/\/dashboard\/events\?type=exhibition/)

  await page.getByRole('button', { name: 'رویداد یا نمایشگاه جدید' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: 'نمایشگاه' }).click()
  await dialog.getByRole('button', { name: 'ادامه' }).click()
  await page.waitForURL(/\/dashboard\/events\/new\?type=exhibition/)

  await page.getByLabel('عنوان نمایشگاه').fill(exhibitionTitle)
  await page.getByLabel('محل برگزاری').fill('عسلویه')
  await setInstant(page, 'شروع برگزاری', '2030-05-01T06:00')
  await setInstant(page, 'پایان برگزاری', '2030-05-03T14:00')
  await page.getByLabel('سقف غرفه برای هر شرکت').fill('۲')
  await page.getByRole('button', { name: 'ثبت نمایشگاه' }).click()

  await page.waitForURL(/\/dashboard\/events\?type=exhibition&saved=exhibition-created/)
  const link = page.getByRole('link', { name: exhibitionTitle })
  await expect(link).toBeVisible({ timeout: 30_000 })

  const exhibitions = await payload.find({ collection: 'exhibitions', where: { title: { equals: exhibitionTitle } }, overrideAccess: true })
  expect(exhibitions.docs).toHaveLength(1)
  const exhibitionId = String(exhibitions.docs[0]!.id)
  const { rows } = await dashboardDb().query(
    'SELECT company_booth_limit FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id = $1',
    [exhibitionId],
  )
  expect(rows).toEqual([{ company_booth_limit: '2' }])

  // The booth catalogue is one step away, as before (UAT31).
  await page.goto(`${BASE}/dashboard/exhibitions/${exhibitionId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'تعریف غرفه جدید' })).toBeVisible({ timeout: 30_000 })
  await page.close()
})

test('another role is refused the admin pages and the API', async () => {
  const page = await contexts.secretariat.newPage()
  for (const path of ['/dashboard/events/new?type=event', '/dashboard/events/new?type=exhibition']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForURL(/\/dashboard\?access=denied/)
  }
  await page.close()

  const request = contexts.secretariat.request
  expect((await request.get(`${BASE}/api/dashboard/admin/exhibitions`)).status()).toBe(403)
  const exhibition = await request.post(`${BASE}/api/dashboard/admin/exhibitions`, {
    data: {
      title: `غیرمجاز ${suffix}`, description: '', location: 'x',
      startDate: '2030-05-01T06:00:00Z', endDate: '2030-05-02T06:00:00Z', status: 'upcoming', companyBoothLimit: 1,
    },
  })
  expect(exhibition.status()).toBe(403)
  const event = await request.post(`${BASE}/api/dashboard/admin/events`, { data: { title: `غیرمجاز ${suffix}` } })
  expect(event.status()).toBe(403)
  const leaked = await payload.find({ collection: 'exhibitions', where: { title: { equals: `غیرمجاز ${suffix}` } }, overrideAccess: true })
  expect(leaked.docs).toEqual([])
})
