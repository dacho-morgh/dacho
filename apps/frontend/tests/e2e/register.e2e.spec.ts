import { test, expect, type Page } from '@playwright/test'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { validNationalId } from '../helpers/nationalId'

test.use({ channel: 'chrome' })

const registerUrl = 'http://localhost:3000/register?returnUrl=%2Fdashboard'
// Playwright API requests omit browser fetch metadata. Payload requires an
// allowed Origin to authenticate their session cookies with CSRF enabled.
const cookieRequestHeaders = { Origin: new URL(registerUrl).origin }
const securitySuffix = `${Date.now()}`.slice(-9)
const adminPhone = `09${securitySuffix}`
const adminEmail = `register-admin-${securitySuffix}@example.invalid`
const adminPassword = 'register-admin-test-only'
let payload: Awaited<ReturnType<typeof getPayload>>
let adminId: number | string
const registeredUserIds: Array<number | string> = []
const registeredCompanyIds: Array<number | string> = []

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
      operationalRole: 'system-owner', isActive: true,
    },
    context: { allowPersonnelProvisioning: true },
  })
  adminId = admin.id
})

test.afterAll(async () => {
  // Companies reference their representative (ON DELETE restrict), so they must
  // be removed before the users they point at.
  for (const id of registeredCompanyIds) {
    await payload.delete({ collection: 'companies', id })
  }
  for (const id of registeredUserIds) {
    await payload.delete({ collection: 'users', id })
  }
  if (adminId !== undefined) {
    await payload.delete({ collection: 'users', id: adminId })
  }
})

async function fillCompanyStep(page: Page) {
  await page.locator('#register-companyName').fill('شرکت نمونه تست')
  // Mocked-response flows never reach the server, but the form checks the digit.
  await page.locator('#register-companyNationalId').fill(validNationalId('5000001'))
  await page.locator('#register-activityDomain').fill('انرژی')
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
        // The server's own rolled-back-transaction code: a definite failure.
        body: JSON.stringify({
          errors: [{ code: 'signup_failed', message: 'Registration failed. Please try again.' }],
        }),
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

  test('recovers from a duplicate national id against the real API without a second company', async ({
    page,
  }) => {
    const suffix = `${Date.now()}`.slice(-9)
    const nationalId = validNationalId(`3${suffix}`)
    const first = await page.request.post('http://localhost:3000/api/users/self-signup', {
      headers: cookieRequestHeaders,
      data: {
        email: `dup-owner-${suffix}@example.invalid`,
        phone: `09${suffix}`,
        password: 'password123',
        name: 'Original representative',
        position: 'CEO',
        companyName: 'Original duplicate test company',
        companyNationalId: nationalId,
        activityDomain: 'Energy',
      },
    })
    expect(first.status()).toBe(201)
    const firstBody = await first.json()
    registeredUserIds.push(firstBody.user.id)
    registeredCompanyIds.push(firstBody.company.id)

    const secondPhone = `09${(Number(suffix) + 1).toString().padStart(9, '0').slice(-9)}`
    const secondEmail = `dup-second-${suffix}@example.invalid`
    await page.goto(registerUrl)
    await page.waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null)
    await page.locator('#register-companyName').fill('شرکت تکراری')
    // Persian digits normalize to the same stored national ID.
    await page
      .locator('#register-companyNationalId')
      .fill(nationalId.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]))
    await page.locator('#register-activityDomain').fill('انرژی')
    await page.getByRole('button', { name: 'ادامه' }).click()
    await fillRepresentativeStep(page, secondPhone, secondEmail)
    await fillSecurityStep(page)
    const [response] = await Promise.all([
      page.waitForResponse((candidate) => candidate.url().endsWith('/api/users/self-signup')),
      page.getByRole('button', { name: 'ثبت شرکت' }).click(),
    ])
    expect(response.status()).toBe(409)

    await expect(page.locator('#register-notice')).toHaveText(
      'این شرکت قبلاً در سامانه ثبت شده است و شرکت دیگری با این شناسه ملی ایجاد نشد.',
    )
    await expect(page.locator('#register-companyNationalId')).toBeFocused()
    await expect(page.getByText(/هر شرکت تنها یک نماینده دارد/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'ورود به حساب' })).toHaveAttribute(
      'href',
      '/login?returnUrl=%2Fdashboard',
    )

    // Server state, not the page, proves atomicity: one company and no stray person.
    const companies = await payload.count({
      collection: 'companies',
      where: { nationalId: { equals: nationalId } },
      overrideAccess: true,
    })
    expect(companies.totalDocs).toBe(1)
    const strayUsers = await payload.count({
      collection: 'users',
      where: { email: { equals: secondEmail } },
      overrideAccess: true,
    })
    expect(strayUsers.totalDocs).toBe(0)

    await page.getByRole('link', { name: 'ورود به حساب' }).click()
    await page.waitForURL('**/login?returnUrl=%2Fdashboard')
  })

  test('reports a dropped connection as an unknown outcome and keeps login reachable on mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.route('**/api/users/self-signup', (route) =>
      route.request().method() === 'POST' ? route.abort('connectionreset') : route.continue(),
    )
    await page.goto(registerUrl)
    await page.waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null)
    await fillCompanyStep(page)
    await fillRepresentativeStep(page)
    await fillSecurityStep(page)
    await page.getByRole('button', { name: 'ثبت شرکت' }).click()

    await expect(page.locator('#register-notice')).toHaveText(
      'ارتباط با سامانه قطع شد و نتیجه ثبت‌نام مشخص نیست. اطلاعات شما حفظ شده است.',
    )
    await expect(page.locator('#register-recovery')).toContainText('پیش از ارسال دوباره')
    await expect(page.getByRole('button', { name: 'ثبت شرکت' })).toBeEnabled()
    await expect(page.locator('#register-password')).toHaveValue('password123')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    await page.getByRole('link', { name: 'وارد شوید' }).click()
    await page.waitForURL('**/login?returnUrl=%2Fdashboard')
  })

  test('the real API requires the activity domain before any write', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-9)
    const email = `no-domain-${suffix}@example.invalid`
    const response = await page.request.post('http://localhost:3000/api/users/self-signup', {
      headers: cookieRequestHeaders,
      data: {
        email,
        phone: `09${suffix}`,
        password: 'password123',
        name: 'No domain',
        position: 'CEO',
        companyName: 'No domain company',
        companyNationalId: validNationalId(`4${suffix}`),
        activityDomain: '   ',
      },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).errors).toEqual([
      expect.objectContaining({ code: 'missing_field', field: 'activityDomain' }),
    ])
    const users = await payload.count({
      collection: 'users',
      where: { email: { equals: email } },
      overrideAccess: true,
    })
    expect(users.totalDocs).toBe(0)
  })

  test('validates national id and Iranian mobile format before advancing', async ({ page }) => {
    await page.goto(registerUrl)
    await page.waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null)
    await page.locator('#register-companyName').fill('شرکت نمونه تست')
    await page.locator('#register-companyNationalId').fill('۱۲x')
    await page.locator('#register-activityDomain').fill('انرژی')
    await page.getByRole('button', { name: 'ادامه' }).click()
    await expect(page.getByText('شناسه ملی باید فقط شامل رقم باشد.')).toBeVisible()
    await expect(page.locator('#register-companyNationalId')).toBeFocused()

    // Right length, wrong check digit, then too short.
    const nationalId = validNationalId('5000002')
    const wrongCheckDigit = `${nationalId.slice(0, 10)}${(Number(nationalId[10]) + 1) % 10}`
    await page.locator('#register-companyNationalId').fill(wrongCheckDigit)
    await page.getByRole('button', { name: 'ادامه' }).click()
    await expect(page.getByText('شناسه ملی معتبر نیست؛ ارقام را دوباره بررسی کنید.')).toBeVisible()
    await page.locator('#register-companyNationalId').fill('۰۰١۲')
    await page.getByRole('button', { name: 'ادامه' }).click()
    await expect(page.getByText('شناسه ملی باید ۱۱ رقم باشد.')).toBeVisible()
    await expect(page.locator('#register-name')).toHaveCount(0)

    await page.locator('#register-companyNationalId').fill(nationalId)
    await page.getByRole('button', { name: 'ادامه' }).click()
    await page.locator('#register-name').fill('متقاضی نمونه')
    await page.locator('#register-position').fill('مدیرعامل')
    await page.locator('#register-phone').fill('123')
    await page.locator('#register-email').fill('not-an-email')
    await page.getByRole('button', { name: 'ادامه' }).click()
    await expect(page.getByText('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.')).toBeVisible()
    await expect(page.getByText(/ایمیل معتبر نیست/)).toBeVisible()
    await expect(page.locator('#register-password')).toHaveCount(0)
  })

  test('shows no error when the security step opens, only after touch or a submit attempt', async ({
    page,
  }) => {
    await page.goto(registerUrl)
    await page.waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null)
    await fillCompanyStep(page)
    await fillRepresentativeStep(page)
    await expect(page.locator('#register-password')).toBeVisible()
    await expect(page.locator('#register-password')).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#register-password-confirmation')).not.toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(page.getByText(/را وارد کنید\./)).toHaveCount(0)

    await page.locator('#register-password').focus()
    await page.locator('#register-password-confirmation').focus()
    await expect(page.getByText('رمز عبور را وارد کنید.')).toBeVisible()
    await expect(page.getByText('تکرار رمز عبور را وارد کنید.')).toHaveCount(0)

    await page.getByRole('button', { name: 'ثبت شرکت' }).click()
    await expect(page.getByText('تکرار رمز عبور را وارد کنید.')).toBeVisible()
  })

  test('filters the cities by province and picks a Jalali founding date', async ({ page }) => {
    await page.goto(registerUrl)
    await page.waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null)
    const city = page.locator('#register-companyCity')
    await expect(city).toBeDisabled()
    await page.locator('#register-companyProvince').selectOption('بوشهر')
    await expect(city.locator('option', { hasText: 'برازجان' })).toHaveCount(1)
    await expect(city.locator('option', { hasText: 'تبریز' })).toHaveCount(0)
    await city.selectOption('برازجان')
    await page.locator('#register-companyProvince').selectOption('تهران')
    await expect(city).toHaveValue('')

    const date = page.locator('#register-companyEstablishmentDate')
    await date.click()
    await page.getByLabel('سال', { exact: true }).selectOption('1380')
    await page.getByLabel('ماه', { exact: true }).selectOption('5')
    await page.getByRole('button', { name: /۱۵ مرداد ۱۳۸۰$/ }).click()
    await expect(date).toHaveText('۱۳۸۰/۰۵/۱۵')
  })

  test('signs up an applicant, lands in the panel already signed in, and can still log in by email', async ({
    page,
  }) => {
    // Unique per run so CI retries don't collide on the unique phone/email.
    const suffix = Date.now().toString().slice(-9)
    const phone = `09${suffix}`
    const email = `e2e-applicant-${suffix}@example.com`
    // A leading zero must survive normalization; the ID carries a valid check digit.
    const nationalId = validNationalId(`0${suffix}`)

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
    await page.locator('#register-companyNationalId').fill(nationalId.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]))
    await page.locator('#register-activityDomain').fill('انرژی')
    await page.locator('#register-companyProvince').selectOption('بوشهر')
    await page.locator('#register-companyCity').selectOption('برازجان')
    await page.locator('#register-companyEstablishmentDate').click()
    await page.getByLabel('سال', { exact: true }).selectOption('1380')
    await page.getByLabel('ماه', { exact: true }).selectOption('5')
    await page.getByRole('button', { name: /۱۵ مرداد ۱۳۸۰$/ }).click()
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
    registeredUserIds.push(registrationBody.user.id)
    registeredCompanyIds.push(registrationBody.company.id)
    expect(registrationBody.company.nationalId).toBe(nationalId)
    expect(registrationBody.company.activityDomain).toBe('انرژی')
    // Company relationships expose IDs without hydrating authentication records.
    expect(registrationBody.user.roles).toEqual(['representative'])
    expect(registrationBody.company.representative).toBe(registrationBody.user.id)

    // #278: the signup signs the representative in, so the form goes straight
    // to the requested panel page: no login page in between.
    expect(registrationBody.session).toMatchObject({ established: true })
    await page.waitForURL('http://localhost:3000/dashboard/requests?status=draft')
    const company = await payload.findByID({
      collection: 'companies',
      id: registrationBody.company.id,
      overrideAccess: true,
    })
    expect(company).toMatchObject({
      province: 'بوشهر',
      city: 'برازجان',
      establishmentDate: '1380/05/15',
    })

    const me = await page.request.get('http://localhost:3000/api/users/me', {
      headers: cookieRequestHeaders,
    })
    expect(me.ok()).toBe(true)
    const meBody = await me.json()
    expect(meBody.user).toMatchObject({
      id: registrationBody.user.id,
      operationalRole: 'representative', isActive: true,
    })

    // Dashboard access is granted, but the new company is not verified: the
    // server reports no submitted verification, so participation stays gated.
    const verification = await page.request.get(
      'http://localhost:3000/api/dashboard/profile/verification',
    )
    expect(verification.status()).toBe(200)
    expect(await verification.json()).toMatchObject({ status: 'unsubmitted', revision: 0 })

    const emailLogin = await page.request.post('http://localhost:3000/api/users/login', {
      headers: cookieRequestHeaders,
      data: { username: email, password: 'password123' },
    })
    expect(emailLogin.status()).toBe(200)
  })

  test('creates an applicant when a CMS admin session is active and ignores submitted roles', async ({
    page,
  }) => {
    const login = await page.request.post('http://localhost:3000/api/users/login', {
      headers: cookieRequestHeaders,
      data: { username: adminPhone, password: adminPassword },
    })
    expect(login.ok()).toBe(true)
    const adminMe = await page.request.get('http://localhost:3000/api/users/me', {
      headers: cookieRequestHeaders,
    })
    expect(adminMe.ok()).toBe(true)
    expect((await adminMe.json()).user).toMatchObject({ id: adminId, operationalRole: 'system-owner', isActive: true })

    const suffix = `${Date.now()}`.slice(-9)
    const phone = `09${suffix}`
    const registration = await page.request.post('http://localhost:3000/api/users/self-signup', {
      headers: cookieRequestHeaders,
      data: {
        email: `admin-session-signup-${suffix}@example.invalid`,
        phone,
        password: 'password123',
        name: 'Applicant created during admin session',
        position: 'Company representative',
        companyName: 'Test company',
        activityDomain: 'Energy',
        companyNationalId: validNationalId(`2${suffix}`),
        companyRegistrationNumber: suffix,
        companyType: 'سهامی خاص',
        companyProvince: 'بوشهر',
        companyCity: 'بوشهر',
        // An escalation attempt during signup must be ignored.
        operationalRole: 'system-owner', isActive: true,
      },
    })
    expect(registration.status()).toBe(201)
    const body = await registration.json()
    registeredUserIds.push(body.user.id)
    registeredCompanyIds.push(body.company.id)
    // A self-signup is forced to exactly the representative role, even while an
    // admin session is active.
    expect(body.user.roles).toEqual(['representative'])
    expect(body.company.representative).toBe(body.user.id)
    // #278: the signup response itself signs the new representative in,
    // replacing the admin's session cookie, exactly as a login would.
    expect(body.session).toMatchObject({ established: true })
    expect(registration.headers()['set-cookie']).toMatch(/payload-token=/)
    const signedIn = await page.request.get('http://localhost:3000/api/users/me', {
      headers: cookieRequestHeaders,
    })
    expect((await signedIn.json()).user).toMatchObject({ id: body.user.id, operationalRole: 'representative' })

    const logout = await page.request.post('http://localhost:3000/api/users/logout', {
      headers: cookieRequestHeaders,
    })
    expect(logout.ok()).toBe(true)
    const applicantLogin = await page.request.post('http://localhost:3000/api/users/login', {
      headers: cookieRequestHeaders,
      data: { username: phone, password: 'password123' },
    })
    expect(applicantLogin.ok()).toBe(true)
    const me = await page.request.get('http://localhost:3000/api/users/me', {
      headers: cookieRequestHeaders,
    })
    expect(me.ok()).toBe(true)
    const meBody = await me.json()
    expect(meBody.user).toMatchObject({ id: body.user.id, operationalRole: 'representative', isActive: true })
  })
})
