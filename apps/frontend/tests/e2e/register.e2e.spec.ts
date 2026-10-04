import { test, expect, type Page } from '@playwright/test'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

test.use({ channel: 'chrome' })

const registerUrl = 'http://localhost:3000/register?returnUrl=%2Fdashboard'
const securitySuffix = `${Date.now()}`.slice(-9)
const adminPhone = `09${securitySuffix}`
const adminEmail = `register-admin-${securitySuffix}@example.invalid`
const adminPassword = 'register-admin-test-only'
let payload: Awaited<ReturnType<typeof getPayload>>
let adminId: number | string
const registeredUserIds: Array<number | string> = []

test.beforeAll(async () => {
  payload = await getPayload({ config })
  const admin = await payload.create({
    collection: 'users',
    data: {
      email: adminEmail,
      username: adminPhone,
      phone: adminPhone,
      password: adminPassword,
      name: 'Registration security test admin',
      role: 'staff',
      cmsRole: 'admin',
    },
    context: { allowRoleAssignment: true },
  })
  adminId = admin.id
})

test.afterAll(async () => {
  for (const id of registeredUserIds) {
    await payload.delete({ collection: 'users', id })
  }
  if (adminId !== undefined) {
    await payload.delete({ collection: 'users', id: adminId })
  }
})

async function fillCompanyStep(page: Page) {
  await page.locator('#register-companyName').fill('شرکت نمونه تست')
  await page.locator('#register-companyNationalId').fill('12345678901')
  await page.locator('#register-companyRegistrationNumber').fill('12345')
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: 'سهامی خاص' }).click()
  await page.locator('#register-companyProvince').fill('بوشهر')
  await page.locator('#register-companyCity').fill('بوشهر')
  await page.getByRole('button', { name: 'ادامه' }).click()
}

async function fillRepresentativeStep(
  page: Page,
  phone = '09129999148',
  email = 'register-ux@example.invalid',
) {
  await page.locator('#register-name').fill('متقاضی نمونه')
  await page.locator('#register-position').fill('مدیرعامل')
  await page.locator('#register-phone').fill(phone)
  await page.locator('#register-email').fill(email)
  await page.getByRole('button', { name: 'ادامه' }).click()
}

async function fillSecurityStep(page: Page) {
  await page.locator('#register-password').fill('password123')
  await page.locator('#register-password-confirmation').fill('password123')
}

test.describe('Register', () => {
  test('distinguishes a server failure from duplicate registration and preserves the form', async ({
    page,
  }) => {
    await page.route('**/api/users/self-signup', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ errors: [{ message: 'Something went wrong.' }] }),
      })
    })

    await page.goto(registerUrl)
    await page.waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null)
    await fillCompanyStep(page)
    await fillRepresentativeStep(page)
    await fillSecurityStep(page)
    await page.getByRole('button', { name: 'ثبت شرکت' }).click()

    await expect(
      page.getByText(
        'ثبت‌نام به دلیل خطای سامانه انجام نشد. اطلاعات شما حفظ شده است؛ لطفاً دوباره تلاش کنید.',
      ),
    ).toBeVisible()
    await expect(
      page.getByText('ثبت‌نام انجام نشد. ممکن است این شماره موبایل یا ایمیل قبلاً ثبت شده باشد.'),
    ).toHaveCount(0)
    await expect(page.locator('#register-password')).toHaveValue('password123')

    await page.getByRole('button', { name: 'بازگشت' }).click()
    await expect(page.locator('#register-phone')).toHaveValue('09129999148')
    await expect(page.locator('#register-email')).toHaveValue('register-ux@example.invalid')
  })

  test('returns to representative details for an ambiguous duplicate identity', async ({
    page,
  }) => {
    await page.route('**/api/users/self-signup', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [{ message: 'The following field is invalid: username' }],
        }),
      })
    })

    await page.goto(registerUrl)
    await page.waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null)
    await fillCompanyStep(page)
    await fillRepresentativeStep(page)
    await fillSecurityStep(page)
    await page.getByRole('button', { name: 'ثبت شرکت' }).click()

    await expect(page.locator('#register-phone')).toBeVisible()
    await expect(page.locator('#register-phone')).toHaveValue('09129999148')
    await expect(page.locator('#register-email')).toHaveValue('register-ux@example.invalid')
    await expect(page.getByText('شماره موبایل یا ایمیل واردشده قبلاً ثبت شده است.')).toBeVisible()
  })

  test('validates national id and Iranian mobile format before advancing', async ({ page }) => {
    await page.goto(registerUrl)
    await page.waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null)
    await page.locator('#register-companyName').fill('شرکت نمونه تست')
    await page.locator('#register-companyNationalId').fill('123')
    await page.locator('#register-companyRegistrationNumber').fill('12345')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'سهامی خاص' }).click()
    await page.locator('#register-companyProvince').fill('بوشهر')
    await page.locator('#register-companyCity').fill('بوشهر')
    await page.getByRole('button', { name: 'ادامه' }).click()
    await expect(page.getByText('شناسه ملی باید دقیقاً ۱۱ رقم باشد.')).toBeVisible()

    await page.locator('#register-companyNationalId').fill('12345678901')
    await page.getByRole('button', { name: 'ادامه' }).click()
    await page.locator('#register-name').fill('متقاضی نمونه')
    await page.locator('#register-position').fill('مدیرعامل')
    await page.locator('#register-phone').fill('123')
    await page.locator('#register-email').fill('register-ux@example.invalid')
    await page.getByRole('button', { name: 'ادامه' }).click()
    await expect(page.getByText('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.')).toBeVisible()
  })

  test('signs up an applicant and can log in with the registered phone or email', async ({
    page,
  }) => {
    // Unique per run so CI retries don't collide on the unique phone/email.
    const suffix = Date.now().toString().slice(-9)
    const phone = `09${suffix}`
    const email = `e2e-applicant-${suffix}@example.com`

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(
      'http://localhost:3000/register?returnUrl=%2Fdashboard%2Frequests%3Fstatus%3Ddraft',
    )

    // Wait for client-side hydration before filling: the fields are React
    // controlled inputs, and a fill() that lands before hydration is wiped when
    // React takes over and re-renders the initial (empty) form state.
    await page.waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null)

    // Step 1 — company info
    await page.locator('#register-companyName').fill('شرکت نمونه تست')
    await page.locator('#register-companyNationalId').fill('12345678901')
    await page.locator('#register-companyRegistrationNumber').fill('12345')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'سهامی خاص' }).click()
    await page.locator('#register-companyProvince').fill('بوشهر')
    await page.locator('#register-companyCity').fill('بوشهر')
    await page.getByRole('button', { name: 'ادامه' }).click()

    // Step 2 — representative info
    await page.locator('#register-name').fill('متقاضی نمونه')
    await page.locator('#register-position').fill('مدیرعامل')
    await page.locator('#register-phone').fill(phone)
    await page.locator('#register-email').fill(email)
    await page.getByRole('button', { name: 'ادامه' }).click()

    // Step 3 — account security
    await page.locator('#register-password').fill('password123')
    await page.locator('#register-password-confirmation').fill('password123')
    const [registrationResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/api/users/self-signup')),
      page.getByRole('button', { name: 'ثبت شرکت' }).click(),
    ])
    expect(registrationResponse.status()).toBe(201)
    const registrationBody = await registrationResponse.json()
    registeredUserIds.push(registrationBody.doc.id)
    expect(registrationBody.doc.role).toBe('applicant')
    expect(registrationBody.doc.cmsRole).toBeNull()

    await page.waitForURL(
      '**/login?registered=1&returnUrl=%2Fdashboard%2Frequests%3Fstatus%3Ddraft',
    )
    await expect(page.getByText('ثبت‌نام با موفقیت')).toBeVisible()

    await page.locator('#login-identifier').fill(phone)
    await page.locator('#login-password').fill('password123')
    const [loginResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/api/users/login')),
      page.getByRole('button', { name: 'ورود', exact: true }).click(),
    ])

    expect(loginResponse.status()).toBe(200)
    await expect(page).toHaveURL('http://localhost:3000/dashboard/requests?status=draft')

    const me = await page.request.get('http://localhost:3000/api/users/me')
    expect(me.ok()).toBe(true)
    const meBody = await me.json()
    expect(meBody.user.role).toBe('applicant')
    expect(meBody.user.cmsRole).toBeNull()

    const emailLogin = await page.request.post('http://localhost:3000/api/users/login', {
      data: { username: email, password: 'password123' },
    })
    expect(emailLogin.status()).toBe(200)
  })

  test('creates an applicant when a CMS admin session is active and ignores submitted roles', async ({
    page,
  }) => {
    const login = await page.request.post('http://localhost:3000/api/users/login', {
      data: { username: adminPhone, password: adminPassword },
    })
    expect(login.ok()).toBe(true)

    const suffix = `${Date.now()}`.slice(-9)
    const phone = `09${suffix}`
    const registration = await page.request.post('http://localhost:3000/api/users/self-signup', {
      data: {
        email: `admin-session-signup-${suffix}@example.invalid`,
        username: phone,
        phone,
        password: 'password123',
        name: 'Applicant created during admin session',
        companyName: 'Test company',
        companyNationalId: `20${suffix}`,
        companyRegistrationNumber: suffix,
        companyType: 'سهامی خاص',
        companyProvince: 'بوشهر',
        companyCity: 'بوشهر',
        role: 'staff',
        cmsRole: 'admin',
        roles: [],
      },
    })
    expect(registration.status()).toBe(201)
    const body = await registration.json()
    expect(body.doc.role).toBe('applicant')
    expect(body.doc.cmsRole).toBeNull()
    expect(body.doc.roles).toEqual([])

    await page.request.post('http://localhost:3000/api/users/logout')
    const applicantLogin = await page.request.post('http://localhost:3000/api/users/login', {
      data: { username: phone, password: 'password123' },
    })
    expect(applicantLogin.ok()).toBe(true)
    const me = await page.request.get('http://localhost:3000/api/users/me')
    expect(me.ok()).toBe(true)
    const meBody = await me.json()
    expect(meBody.user.role).toBe('applicant')
    expect(meBody.user.cmsRole).toBeNull()

    registeredUserIds.push(body.doc.id)
  })
})
