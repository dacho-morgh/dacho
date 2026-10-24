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

async function expectDashboardPagesFit(page: Page, paths: string[]) {
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })

    for (const path of paths) {
      const response = await page.goto(`http://localhost:3000${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })
      expect(response?.status(), path).toBe(200)
      await expect
        .poll(
          () => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)),
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
      name: 'Mobile dashboard company test',
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
