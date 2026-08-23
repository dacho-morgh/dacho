import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('can load homepage', async ({ page }) => {
    const response = await page.goto('http://localhost:3000')

    expect(response?.status()).toBe(200)

    // `/` is the custom landing page (not the CMS `home` page and not the stock
    // Payload template), so assert its hero renders rather than the template's
    // "Payload Website Template" copy.
    await expect(page.locator('h1').first()).toBeVisible()
  })
})
