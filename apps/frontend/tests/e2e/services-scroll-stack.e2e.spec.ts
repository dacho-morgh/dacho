import { expect, test } from '@playwright/test'

test('service cards stack during mobile scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3000/about')

  const section = page.locator('#services')
  const cards = section.locator('[data-service-card]')
  await expect(cards).toHaveCount(4)
  await expect(section.locator('.pin-spacer')).toHaveCount(5)

  const first = cards.first()
  const second = cards.nth(1)
  await section.evaluate((element) =>
    window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + 450),
  )
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.scrollBy(0, 150))

  await expect
    .poll(() => first.evaluate((card) => card.getBoundingClientRect().top))
    .toBeGreaterThanOrEqual(-1)
  const firstTop = await first.evaluate((card) => card.getBoundingClientRect().top)
  const secondTop = await second.evaluate((card) => card.getBoundingClientRect().top)
  expect(firstTop).toBeLessThan(secondTop)
  await expect(first).toBeVisible()

  await second.evaluate((card) =>
    window.scrollTo(0, window.scrollY + card.getBoundingClientRect().top - 180 + 30),
  )
  await page.waitForTimeout(500)
  const bounds = await section.evaluate((element) => {
    const cards = element.querySelectorAll<HTMLElement>('[data-service-card]')
    const heading = element.querySelector('h2')!
    const header = document.querySelector('header')!
    return {
      first: cards[0].getBoundingClientRect().toJSON(),
      second: cards[1].getBoundingClientRect().toJSON(),
      headingTop: heading.getBoundingClientRect().top,
      headerBottom: header.getBoundingClientRect().bottom,
    }
  })
  expect(bounds.headingTop).toBeGreaterThanOrEqual(bounds.headerBottom + 4)
  expect(Math.abs(bounds.first.top - bounds.second.top)).toBeLessThan(2)
  expect(Math.abs(bounds.first.height - bounds.second.height)).toBeLessThan(2)
  expect(Math.abs(bounds.first.width - bounds.second.width)).toBeLessThan(2)
})

test('service heading stays with desktop card stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/about')

  const section = page.locator('#services')
  const cards = section.locator('[data-service-card]')
  await expect(cards).toHaveCount(4)
  await expect(section.locator('.pin-spacer')).toHaveCount(5)

  await section.evaluate((element) =>
    window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + 450),
  )
  await page.waitForTimeout(1500)
  const positions = await section.evaluate((element) => {
    const heading = element.querySelector<HTMLElement>('h2')
    const card = element.querySelectorAll<HTMLElement>('[data-service-card]')[1]
    return {
      headingBottom: heading!.getBoundingClientRect().bottom,
      cardTop: card.getBoundingClientRect().top,
    }
  })
  expect(positions.headingBottom).toBeGreaterThan(0)
  expect(positions.headingBottom).toBeLessThan(positions.cardTop)
})

test('tall mobile cards scroll fully before joining the stack', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('http://localhost:3000/about')

  const section = page.locator('#services')
  const first = section.locator('[data-service-card]').first()
  await expect(first).toBeVisible()
  await expect(first.locator('h3')).toBeVisible()
  await expect(first.locator('p')).toBeVisible()

  const height = await first.evaluate((card) => card.getBoundingClientRect().height)
  expect(height).toBeGreaterThan(568)
  await expect(section.locator('.pin-spacer')).toHaveCount(5)

  await first.evaluate((card) =>
    window.scrollTo(
      0,
      window.scrollY + card.getBoundingClientRect().bottom - window.innerHeight + 20,
    ),
  )
  await expect
    .poll(() => first.evaluate((card) => card.getBoundingClientRect().bottom))
    .toBeLessThanOrEqual(568)

  const firstBottom = await first.evaluate((card) => card.getBoundingClientRect().bottom)
  const second = section.locator('[data-service-card]').nth(1)
  const secondTop = await second.evaluate((card) => card.getBoundingClientRect().top)
  await page.evaluate(() => window.scrollBy(0, 150))
  await expect
    .poll(() => second.evaluate((card) => card.getBoundingClientRect().top))
    .toBeLessThan(secondTop - 100)
  expect(await first.evaluate((card) => card.getBoundingClientRect().bottom)).toBeCloseTo(
    firstBottom,
    0,
  )

  await second.evaluate((card) =>
    window.scrollTo(
      0,
      window.scrollY + card.getBoundingClientRect().bottom - window.innerHeight + 20,
    ),
  )
  await page.waitForTimeout(700)
  const bounds = await section.evaluate((element) => {
    const header = document.querySelector('header')!
    const heading = element.querySelector('h2')!
    const cards = element.querySelectorAll<HTMLElement>('[data-service-card]')
    return {
      headerBottom: header.getBoundingClientRect().bottom,
      headingTop: heading.getBoundingClientRect().top,
      first: cards[0].getBoundingClientRect().toJSON(),
      second: cards[1].getBoundingClientRect().toJSON(),
    }
  })
  expect(bounds.headingTop).toBeGreaterThanOrEqual(bounds.headerBottom + 4)
  expect(Math.abs(bounds.first.top - bounds.second.top)).toBeLessThan(2)
  expect(Math.abs(bounds.first.height - bounds.second.height)).toBeLessThan(2)
})
