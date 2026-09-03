import { test, expect } from '@playwright/test'

test.use({ channel: 'chrome' })

test.describe('Register', () => {
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
