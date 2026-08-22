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

  test('keeps the mobile navigation closed when resizing from desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 })
    await page.goto('http://localhost:3000')

    const navigation = page.locator('#mobile-navigation')
    await expect(navigation).toHaveAttribute('aria-hidden', 'true')

    await page.setViewportSize({ width: 390, height: 800 })
    await expect(navigation).toHaveAttribute('aria-hidden', 'true')
    await expect(navigation).not.toBeInViewport()

    await page.getByRole('button', { name: 'باز کردن منو' }).click()
    await expect(navigation).toHaveAttribute('aria-hidden', 'false')

    await page.setViewportSize({ width: 1024, height: 800 })
    await page.setViewportSize({ width: 390, height: 800 })
    await expect(navigation).toHaveAttribute('aria-hidden', 'true')
    await expect(navigation).not.toBeInViewport()
  })
})
