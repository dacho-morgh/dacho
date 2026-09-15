import { test, expect, type Page } from '@playwright/test'

test.use({ channel: 'chrome' })

const registerUrl = 'http://localhost:3000/register?returnUrl=%2Fdashboard'

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
    await page.route('**/api/users', async (route) => {
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

  test('returns to representative details for an ambiguous duplicate identity', async ({ page }) => {
    await page.route('**/api/users', async (route) => {
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
    await page.getByRole('button', { name: 'ثبت شرکت' }).click()

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

    const emailLogin = await page.request.post('http://localhost:3000/api/users/login', {
      data: { username: email, password: 'password123' },
    })
    expect(emailLogin.status()).toBe(200)
  })
})
