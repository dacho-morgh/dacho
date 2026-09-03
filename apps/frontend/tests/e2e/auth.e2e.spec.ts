import { expect, test } from '@playwright/test'

test.use({ channel: 'chrome' })

test.describe('Application authentication', () => {
  test('redirects an anonymous dashboard visit to login with a return URL', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/requests?status=draft')

    await expect(page).toHaveURL(
      'http://localhost:3000/login?returnUrl=%2Fdashboard%2Frequests%3Fstatus%3Ddraft',
    )
    await expect(page.getByRole('form', { name: 'فرم ورود' })).toBeVisible()
  })

  test('rejects an invalid session cookie without losing the return URL', async ({
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
      'http://localhost:3000/login?returnUrl=%2Fdashboard%2Fevents%3Fview%3Dupcoming',
    )
  })
})
