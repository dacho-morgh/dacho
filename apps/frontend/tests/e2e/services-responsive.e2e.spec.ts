import { expect, test } from '@playwright/test'
import { serviceCardClassName } from '../../src/components/landing/home/services-layout'

test.use({ contextOptions: { reducedMotion: 'reduce' } })

test('fills service rows without overflow across breakpoints', async ({ page }) => {
  await page.goto('http://localhost:3000')
  const section = page.locator('#services')
  await expect(section.locator('article').first()).toBeAttached()

  for (const width of [320, 390, 640, 767, 768, 1024, 1279, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    const layout = await section.evaluate((element) => {
      const cards = Array.from(element.querySelectorAll('article'))
      return {
        overflow: element.scrollWidth > element.clientWidth,
        imageHeights: cards.map(
          (card) => card.querySelector('img')?.getBoundingClientRect().height ?? 0,
        ),
      }
    })
    expect(layout.overflow, `section at ${width}px`).toBe(false)
    expect(
      Math.max(...layout.imageHeights),
      `illustration height at ${width}px`,
    ).toBeLessThanOrEqual(224)
  }

  // CMS editors can enter long words and URLs; wrapping must not widen the grid.
  await section
    .locator('article')
    .first()
    .evaluate((card) => {
      card.querySelector('h3')!.textContent = 'عنوانبلندخدمات'.repeat(30)
      card.querySelector('p')!.textContent = `https://example.com/${'long-description'.repeat(40)}`
    })
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await section.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      false,
    )
    const card = section.locator('article').first()
    expect(await card.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false)
  }
})

test('stretches incomplete rows for changing CMS service counts', async ({ page }) => {
  await page.goto('http://localhost:3000')
  const grid = page.locator('#services .grid')
  await expect(grid.locator('article').first()).toBeAttached()
  const template = await grid.locator(':scope > div').first().innerHTML()

  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const columns = width < 1280 ? 2 : 3
    for (let count = 1; count <= 8; count++) {
      await grid.evaluate(
        (element, { template, classes }) => {
          element.replaceChildren(
            ...classes.map((className) => {
              const card = document.createElement('div')
              card.className = className
              card.innerHTML = template
              return card
            }),
          )
        },
        {
          template,
          classes: Array.from({ length: count }, (_, index) => serviceCardClassName(index, count)),
        },
      )
      const layout = await grid.evaluate((element) => {
        const gridBounds = element.getBoundingClientRect()
        return {
          left: gridBounds.left,
          right: gridBounds.right,
          cards: Array.from(element.children).map((card) => {
            const { x, y, width } = card.getBoundingClientRect()
            return { x, y, width }
          }),
        }
      })
      const finalRow = layout.cards.slice(-(count % columns || columns))
      const left = Math.min(...finalRow.map((card) => card.x))
      const right = Math.max(...finalRow.map((card) => card.x + card.width))
      expect(Math.abs(left - layout.left), `${count} cards at ${width}px: left`).toBeLessThan(1)
      expect(Math.abs(right - layout.right), `${count} cards at ${width}px: right`).toBeLessThan(1)
      expect(
        Math.max(...finalRow.map((card) => card.y)) - Math.min(...finalRow.map((card) => card.y)),
      ).toBeLessThan(1)
    }
  }
})
