import { expect, test } from '@playwright/test'

test.use({ channel: 'chrome' })

test('retargets image hover feedback and removes it when reduced motion is enabled', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('http://localhost:3000')
  const media = page.locator('[data-home-media]').first()
  const image = media.locator('img')
  // Scroll smoothing can move the card away from the pointer before it settles.
  await expect(async () => {
    await media.hover()
    await expect(image).toHaveCSS('transform', /1\.03/, { timeout: 500 })
  }).toPass({ timeout: 5_000 })
  await page.mouse.move(0, 0)
  await expect(image).toHaveCSS('transform', 'none')
  await media.hover()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(image).toHaveCSS('transform', 'none')
})

test('reveals each group once and leaves it stable after scrolling back', async ({ page }) => {
  await page.goto('http://localhost:3000')
  const group = page.locator('#services [data-home-reveal]').last()
  await expect(group).toHaveCSS('opacity', '0')
  await group.scrollIntoViewIfNeeded()
  await expect(group).toHaveCSS('opacity', '1')
  await expect(group).toHaveCSS('transform', 'none')
  await page.evaluate(() => window.scrollTo(0, 0))
  await group.scrollIntoViewIfNeeded()
  await expect(group).toHaveCSS('opacity', '1')
  await expect(group).toHaveCSS('transform', 'none')
})

test('reveals focused content immediately without requiring a scroll animation', async ({
  page,
}) => {
  await page.goto('http://localhost:3000')
  const group = page
    .locator('[data-home-reveal]')
    .filter({ has: page.locator('[data-slot="accordion-trigger"]') })
  await expect(group).toHaveCSS('opacity', '0')
  await group
    .locator('button')
    .first()
    .evaluate((button) => button.focus({ preventScroll: true }))
  await expect(group).toHaveCSS('opacity', '1')
  await expect(group).toHaveCSS('transform', 'none')
})

test('uses stationary fades and disables image hover movement for reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://localhost:3000')
  const group = page.locator('#services [data-home-reveal]').last()
  await expect(group).toHaveCSS('transform', 'none')
  await group.scrollIntoViewIfNeeded()
  await expect(group).toHaveCSS('opacity', '1')
  const media = page.locator('[data-home-media]').first()
  await media.hover()
  await expect(media.locator('img')).toHaveCSS('transform', 'none')
})

test('settles on the correct event after rapid forward and reverse navigation', async ({
  page,
}) => {
  await page.goto('http://localhost:3000')
  const carousel = page
    .locator('[aria-live="polite"]')
    .filter({ has: page.locator('[data-active]') })
  const active = carousel.locator('[data-active="true"]')
  await active.scrollIntoViewIfNeeded()
  const firstTitle = await active.locator('h3').textContent()
  // Dispatch real pointer clicks quickly enough to interrupt the 200ms fade.
  await active.getByRole('button', { name: 'مورد بعدی' }).dispatchEvent('click', { detail: 1 })
  await active.getByRole('button', { name: 'مورد قبلی' }).dispatchEvent('click', { detail: 1 })
  await expect(active.locator('h3')).toHaveText(firstTitle!)
  await expect(active).toHaveCSS('opacity', '1')
  await expect(carousel.locator('[data-active="false"]')).toHaveCount(0)
})

test('keeps keyboard navigation immediate and preserves focus on the next control', async ({
  page,
}) => {
  await page.goto('http://localhost:3000')
  const carousel = page
    .locator('[aria-live="polite"]')
    .filter({ has: page.locator('[data-active]') })
  const active = carousel.locator('[data-active="true"]')
  const next = active.getByRole('button', { name: 'مورد بعدی' })
  await next.focus()
  const firstTitle = await active.locator('h3').textContent()
  await next.press('Enter')
  await expect(active.locator('h3')).not.toHaveText(firstTitle!)
  await expect(active).toHaveCSS('opacity', '1')
  await expect(next).toBeFocused()
  await expect(carousel.locator('[data-active="false"]')).toHaveCount(0)
})
