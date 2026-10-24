import { expect, test, type Page } from '@playwright/test'
import { randomInt } from 'node:crypto'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

test.use({ channel: 'chrome' })

const password = 'mobile-dashboard-test-only'
const suffix = `${Date.now()}${randomInt(100, 999)}`.slice(-9)
const applicant = {
  email: `mobile-applicant-${suffix}@example.invalid`,
  phone: `09${suffix}`,
  companyNationalId: `10${suffix}`,
  companyRegistrationNumber: suffix,
  companyName: 'Mobile dashboard company test',
}
const manager = {
  email: `mobile-manager-${suffix}@example.invalid`,
  phone: `09${(Number(suffix) + 1).toString().padStart(9, '0').slice(-9)}`,
}

let payload: Awaited<ReturnType<typeof getPayload>>
let applicantId: number | string
let managerId: number | string
let companyId: number | string

async function signIn(page: Page, username: string) {
  const response = await page.request.post('http://localhost:3000/api/users/login', {
    data: { username, password },
  })
  expect(response.ok()).toBe(true)
}

async function expectProfileField(page: Page, label: string, value: string) {
  // React streams a hidden <div id="S:n"> template that can still hold a copy of
  // the same form, so match only the rendered field.
  const field = page.getByLabel(label, { exact: true }).filter({ visible: true })
  await expect(field).toBeVisible()
  await expect(field).toHaveValue(value)
}

async function expectDashboardPagesFit(page: Page, paths: string[]) {
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })

    for (const path of paths) {
      const response = await page.goto(`http://localhost:3000${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })
      expect(response?.status(), path).toBe(200)
      // Streaming can return HTTP 200 for loading/error shells. Wait for real
      // fixture fields before measuring the profile, including on narrow phones.
      if (path === '/dashboard/profile/company') {
        await expectProfileField(page, 'نام شرکت', applicant.companyName)
        await expectProfileField(page, 'شناسه ملی', applicant.companyNationalId)
        await expectProfileField(page, 'شماره ثبت', applicant.companyRegistrationNumber)
      } else if (path === '/dashboard/profile/account') {
        await expectProfileField(page, 'شماره تلفن همراه', applicant.phone)
        await expectProfileField(page, 'آدرس ایمیل', applicant.email)
      } else if (path === '/dashboard/profile/resume') {
        await expect(
          page.getByRole('heading', { name: 'رزومه و سوابق شرکت', exact: true }),
        ).toBeVisible()
      }
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
            ),
          { message: `${path} should fit a ${width}px phone viewport` },
        )
        .toBeLessThanOrEqual(width)
    }
  }
}

test.beforeAll(async () => {
  payload = await getPayload({ config })
  const applicantUser = await payload.create({
    collection: 'users',
    data: {
      email: applicant.email,
      username: applicant.phone,
      phone: applicant.phone,
      password,
      name: 'Mobile dashboard applicant test',
    },
  })
  applicantId = applicantUser.id
  // The company is a separate record linked to the user as its representative.
  const company = await payload.create({
    collection: 'companies',
    data: {
      name: applicant.companyName,
      nationalId: applicant.companyNationalId,
      registrationNumber: applicant.companyRegistrationNumber,
      type: 'سهامی خاص',
      province: 'بوشهر',
      city: 'بوشهر',
      representative: applicantUser.id,
    },
  })
  companyId = company.id

  const managerUser = await payload.create({
    collection: 'users',
    data: {
      email: manager.email,
      username: manager.phone,
      phone: manager.phone,
      password,
      name: 'Mobile dashboard manager test',
      operationalRole: 'system-owner', isActive: true,
    },
    context: { allowPersonnelProvisioning: true },
  })
  managerId = managerUser.id
})

test.afterAll(async () => {
  // The company references its representative with ON DELETE restrict.
  if (companyId !== undefined) {
    await payload.delete({ collection: 'companies', id: companyId })
  }
  if (applicantId !== undefined) {
    await payload.delete({ collection: 'users', id: applicantId })
  }
  if (managerId !== undefined) {
    await payload.delete({ collection: 'users', id: managerId })
  }
})

test('applicant dashboard pages fit phone widths', async ({ page }) => {
  test.setTimeout(180_000)
  await signIn(page, applicant.phone)
  // Exercises session resolution -> Next proxy -> backend -> CMS service account.
  // No route interception: a missing backend or empty fallback must fail here.
  const profileResponse = await page.request.get('http://localhost:3000/api/dashboard/profile')
  expect(profileResponse.status()).toBe(200)
  expect(await profileResponse.json()).toMatchObject({
    company: {
      name: applicant.companyName,
      nationalId: applicant.companyNationalId,
      registrationNumber: applicant.companyRegistrationNumber,
      type: 'سهامی خاص',
    },
    contacts: { phone: applicant.phone, email: applicant.email },
    executives: [],
    addresses: [],
  })
  await expectDashboardPagesFit(page, [
    '/dashboard',
    '/dashboard/requests',
    '/dashboard/letters',
    '/dashboard/letters/new?mode=support',
    '/dashboard/events',
    '/dashboard/profile/company',
    '/dashboard/profile/account',
    '/dashboard/profile/resume',
  ])
})

test('manager dashboard pages fit phone widths', async ({ page }) => {
  test.setTimeout(180_000)
  await signIn(page, manager.phone)
  await expectDashboardPagesFit(page, [
    '/dashboard',
    '/dashboard/companies',
    '/dashboard/employees',
    '/dashboard/requests',
    `/dashboard/requests/mobile-request-${suffix}`,
    `/dashboard/requests/mobile-request-${suffix}/evaluation`,
    '/dashboard/letters',
    '/dashboard/letters/new',
    `/dashboard/companies/${managerId}`,
  ])
})

test('rechecks revoked role access on client navigation and direct entry', async ({ page }) => {
  test.setTimeout(90_000)
  await signIn(page, manager.phone)
  await page.goto('http://localhost:3000/dashboard')

  const companyLink = page.getByRole('link', { name: 'شرکت‌ها', exact: true })
  await expect(companyLink).toBeVisible()

  try {
    await payload.update({
      collection: 'users',
      id: managerId,
      data: { operationalRole: 'reviewer' },
      overrideAccess: true,
    })

    // The shared layout still has its former sidebar instance. Clicking its
    // stale management link must reach the request-time guard before the page.
    await companyLink.click()
    await expect(page).toHaveURL('http://localhost:3000/dashboard?access=denied')
    await expect(page.getByText('به نشانی درخواستی دسترسی ندارید', { exact: false })).toBeVisible()

    await page.goto('http://localhost:3000/dashboard/companies')
    await expect(page).toHaveURL('http://localhost:3000/dashboard?access=denied')
  } finally {
    await payload.update({
      collection: 'users',
      id: managerId,
      data: { operationalRole: 'system-owner' },
      overrideAccess: true,
    })
  }
})

test('separates management-list loading, empty, expired, denied, and unavailable states', async ({ page }) => {
  test.setTimeout(90_000)
  await signIn(page, manager.phone)

  let status = 503
  let delay = true
  await page.route('**/api/dashboard/admin/companies*', async (route) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, 250))
    await route.fulfill({ status, json: status === 200 ? { items: [] } : { error: 'test response' } })
  })

  await page.goto('http://localhost:3000/dashboard')
  await expect(page.getByRole('status').filter({ hasText: 'در حال دریافت اطلاعات' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'دریافت اطلاعات انجام نشد' })).toBeVisible()

  delay = false
  status = 200
  await page.getByRole('button', { name: 'تلاش دوباره' }).click()
  await expect(page.getByText('هنوز موردی برای نمایش وجود ندارد')).toBeVisible()

  status = 401
  await page.reload()
  await expect(page.getByRole('alert').filter({ hasText: 'نشست شما پایان یافته است' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'ورود دوباره' })).toHaveAttribute(
    'href',
    /\/login\?.*expired=1/,
  )

  status = 403
  await page.reload()
  await expect(page.getByRole('alert').filter({ hasText: 'دسترسی به این اطلاعات مجاز نیست' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'بازگشت به پیشخوان' })).toHaveAttribute('href', '/dashboard')
})
