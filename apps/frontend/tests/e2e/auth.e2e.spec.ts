import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

test.use({ channel: 'chrome' })

const password = 'fe02-login-test-only'
const suffix = `${Date.now()}${randomUUID().slice(0, 8)}`.replace(/\D/g, '').slice(-8)
const phoneUser = {
  email: `fe02-phone-${suffix}@example.invalid`,
  phone: `091${suffix}`,
  name: 'FE02 phone login test',
}
const emailUser = {
  email: `fe02-email-${suffix}@example.invalid`,
  phone: `092${String(Number(suffix) + 1).padStart(8, '0').slice(-8)}`,
  name: 'FE02 email login test',
}
let payload: Awaited<ReturnType<typeof getPayload>>
const userIds: (string | number)[] = []
let companyId: string | number | undefined

test.beforeAll(async () => {
  payload = await getPayload({ config })
  for (const [index, user] of [phoneUser, emailUser].entries()) {
    const created = await payload.create({
      collection: 'users',
      data: {
        email: user.email,
        username: user.phone,
        phone: user.phone,
        password,
        name: user.name,
        operationalRole: 'representative',
        isActive: true,
      },
      context: { allowPersonnelProvisioning: true },
    })
    userIds.push(created.id)
    if (index === 0) {
      const company = await payload.create({
        collection: 'companies',
        data: {
          name: `FE02 phone company ${suffix}`,
          nationalId: `fe02-${suffix}`,
          registrationNumber: suffix,
          representative: created.id,
        },
      })
      companyId = company.id
    }
  }
})

test.afterAll(async () => {
  if (companyId !== undefined) await payload.delete({ collection: 'companies', id: companyId })
  for (const id of userIds) await payload.delete({ collection: 'users', id })
})

test.describe('Application authentication', () => {
  test('redirects an anonymous dashboard visit to login with a return URL', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/requests?status=draft')

    await expect(page).toHaveURL(
      'http://localhost:3000/login?returnUrl=%2Fdashboard%2Frequests%3Fstatus%3Ddraft',
    )
    await expect(page.getByRole('form', { name: 'فرم ورود' })).toBeVisible()
  })

  test('rejects an invalid session cookie and preserves the return URL', async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: 'payload-token',
        value: 'invalid-session',
        domain: 'localhost',
        path: '/',
      },
    ])

    await page.goto('http://localhost:3000/dashboard/events?view=upcoming')

    await expect(page).toHaveURL(
      'http://localhost:3000/login?expired=1&returnUrl=%2Fdashboard%2Fevents%3Fview%3Dupcoming',
    )
  })

  test('logs in with a phone number and preserves a safe query and fragment', async ({ page }) => {
    const returnUrl = '/dashboard/requests?status=draft#request-12'
    await page.goto(`http://localhost:3000/login?returnUrl=${encodeURIComponent(returnUrl)}`)
    await page.getByLabel('شماره تلفن همراه / آدرس ایمیل').fill(phoneUser.phone)
    await page.getByLabel('رمز عبور', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'ورود', exact: true }).click()

    await expect(page).toHaveURL(`http://localhost:3000${returnUrl}`)

    await page.goto('http://localhost:3000/dashboard/profile/account')
    await page.getByRole('button', { name: 'خروج از حساب کاربری' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'خروج از حساب' }).click()
    await expect(page).toHaveURL('http://localhost:3000/login?loggedOut=1')
    expect((await page.request.get('http://localhost:3000/api/dashboard/capabilities')).status()).toBe(401)

    await page.goto('http://localhost:3000/dashboard/requests?status=draft')
    await expect(page).toHaveURL(
      'http://localhost:3000/login?returnUrl=%2Fdashboard%2Frequests%3Fstatus%3Ddraft',
    )
  })

  test('logs in with an email address', async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    await page.getByLabel('شماره تلفن همراه / آدرس ایمیل').fill(emailUser.email)
    await page.getByLabel('رمز عبور', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'ورود', exact: true }).click()
    await expect(page).toHaveURL('http://localhost:3000/dashboard')
    expect((await page.request.get('http://localhost:3000/api/dashboard/capabilities')).status()).toBe(200)
  })

  test('keeps the identifier and distinguishes invalid credentials from service failure', async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    const identifier = page.getByLabel('شماره تلفن همراه / آدرس ایمیل')
    await identifier.fill(phoneUser.phone)
    await page.getByLabel('رمز عبور', { exact: true }).fill('wrong-password')

    let status = 401
    await page.route('**/api/users/login', (route) => route.fulfill({ status, json: {} }))
    await page.getByRole('button', { name: 'ورود', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('شماره تلفن، ایمیل یا رمز عبور صحیح نیست.')
    await expect(identifier).toHaveValue(phoneUser.phone)

    status = 503
    await page.getByRole('button', { name: 'ورود', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('ورود در دسترس نیست. کمی بعد دوباره تلاش کنید.')
    await expect(identifier).toHaveValue(phoneUser.phone)
  })
})
