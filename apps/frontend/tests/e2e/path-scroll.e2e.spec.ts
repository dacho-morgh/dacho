import { expect, test } from '@playwright/test'

test.use({ channel: 'chrome' })

const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [667, 375],
  [768, 1024],
  [1023, 768],
  [1280, 720],
  [1920, 1080],
] as const

for (const [width, height] of VIEWPORTS) {
  test(`about page shows the current path content at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('http://localhost:3000/about')

    const section = page
      .getByRole('heading', { name: 'اهدافی که ما دنبال میکنیم' })
      .locator('xpath=ancestor::section[1]')
    const items = section.locator('article')
    await expect(items).toHaveCount(5)
    await expect(items.first().getByRole('heading', { name: 'فضای استقرار تخصصی' })).toBeVisible()
    await expect(items.last().getByRole('heading', { name: 'خدمات دانش بنیان' })).toBeVisible()

    for (const item of await items.all()) {
      await expect(item.getByRole('heading')).toBeVisible()
      await expect(item.locator('p')).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
  })
}

test('reduced motion keeps every path description readable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://localhost:3000/about')

  const section = page
    .getByRole('heading', { name: 'اهدافی که ما دنبال میکنیم' })
    .locator('xpath=ancestor::section[1]')
  for (const description of await section.locator('article p').all()) {
    await expect(description).toBeVisible()
  }
})
