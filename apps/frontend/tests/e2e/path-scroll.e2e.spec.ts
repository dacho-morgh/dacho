import { expect, test } from '@playwright/test'

test.use({ channel: 'chrome' })

const MOBILE_VIEWPORTS = [
  [320, 568],
  [390, 844],
  [667, 375],
  [768, 1024],
  [1023, 768],
] as const

for (const [width, height] of MOBILE_VIEWPORTS) {
  test(`mobile carousel exposes every path item at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('http://localhost:3000/about')

    const section = page.locator('[data-path-section]')
    const carousel = section.locator('[data-slot="carousel"]')
    const slides = carousel.locator('[data-slot="carousel-item"]')
    const next = carousel.locator('[data-slot="carousel-next"]')
    const previous = carousel.locator('[data-slot="carousel-previous"]')

    await expect(carousel).toBeVisible()
    await expect(slides).toHaveCount(6)
    await expect(previous).toBeDisabled()
    expect(await section.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    )
    expect(await section.locator('.pin-spacer').count()).toBe(0)

    for (let index = 0; index < 6; index += 1) {
      const slide = slides.nth(index)

      await expect
        .poll(() =>
          slide.evaluate((element) => {
            const slideBounds = element.getBoundingClientRect()
            const viewportBounds = element
              .closest('[data-slot="carousel-content"]')!
              .getBoundingClientRect()

            return Math.abs(slideBounds.left - viewportBounds.left) < 2
          }),
        )
        .toBe(true)
      await expect(slide.locator('h3')).toBeVisible()
      await expect(slide.locator('p')).toHaveCount(2)

      if (index < 5) await next.click()
    }

    await expect(next).toBeDisabled()

    // The section has no scroll-driven pin on touch layouts, so users can leave it normally.
    await section.evaluate((element) =>
      window.scrollTo(0, window.scrollY + element.getBoundingClientRect().bottom + 1),
    )
    await expect
      .poll(() => section.evaluate((element) => element.getBoundingClientRect().bottom))
      .toBeLessThanOrEqual(0)
  })
}

for (const [width, height] of [
  [1024, 768],
  [1280, 720],
  [1440, 900],
  [1920, 1080],
] as const) {
  test(`desktop keeps the original scroll sequence at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('http://localhost:3000/about')

    const section = page.locator('[data-path-section]')
    const pinnedContent = section.locator('[data-path-active-index]')

    await expect(section.locator('[data-slot="carousel"]')).toBeHidden()
    await expect(pinnedContent).toBeVisible()
    await expect(section.locator('.pin-spacer')).toHaveCount(1)
    expect(
      await pinnedContent.evaluate((element) => element.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(height)

    const sectionTop = await section.evaluate(
      (element) => window.scrollY + element.getBoundingClientRect().top,
    )

    for (let index = 0; index < 6; index += 1) {
      await page.evaluate(({ top, progress }) => window.scrollTo(0, top + progress * 5 * 640), {
        top: sectionTop,
        progress: index / 5,
      })
      await expect(pinnedContent).toHaveAttribute('data-path-active-index', String(index))
      await expect(section.locator('[data-path-item]').nth(index).locator('p')).toBeVisible()
    }

    await section.evaluate((element) =>
      window.scrollBy(0, element.getBoundingClientRect().bottom + 1),
    )
    await expect
      .poll(() => section.evaluate((element) => element.getBoundingClientRect().bottom))
      .toBeLessThanOrEqual(0)
  })
}

test('reduced motion keeps all desktop descriptions readable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://localhost:3000/about')

  const section = page.locator('[data-path-section]')

  await expect(section.locator('.pin-spacer')).toHaveCount(0)
  for (const description of await section.locator('[data-path-description] p').all()) {
    await expect(description).toBeVisible()
  }
})
