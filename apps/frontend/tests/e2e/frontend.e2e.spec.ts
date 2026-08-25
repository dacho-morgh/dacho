import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('opens the dashboard mobile sidebar as a right-side drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('http://localhost:3000/dashboard')

    // `useIsMobile()` is false on first paint (its state starts `undefined` for
    // SSR safety) and flips to true once the matchMedia effect runs, which
    // unmounts the desktop sidebar. Wait for that before clicking — otherwise
    // `toggleSidebar()` toggles the hidden desktop sidebar and the mobile sheet
    // never opens.
    await expect(
      page.locator('[data-sidebar="sidebar"]:not([data-mobile])'),
    ).toHaveCount(0)

    const trigger = page.locator('[data-sidebar="trigger"]')
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveCSS('position', 'absolute')

    const triggerBox = await trigger.boundingBox()
    expect(triggerBox).not.toBeNull()
    expect(triggerBox!.x).toBeLessThanOrEqual(24)
    expect(triggerBox!.y).toBeLessThanOrEqual(24)
    expect(triggerBox!.width).toBeLessThanOrEqual(44)
    await expect(trigger.locator('svg')).toBeVisible()

    await trigger.click()

    const sidebar = page.locator('[data-sidebar="sidebar"][data-mobile="true"]')
    await expect(sidebar).toBeVisible()

    // The Sheet slides in from the right over 200ms. `toBeVisible` passes as
    // soon as the drawer mounts, so wait for the right edge to settle on the
    // viewport edge before measuring — otherwise we sample a mid-animation box.
    await expect
      .poll(async () => {
        const box = await sidebar.boundingBox()
        return box!.x + box!.width
      })
      .toBeCloseTo(390, 0)

    const box = await sidebar.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThan(0)
  })

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

  test('restores the full desktop header after client-side navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 })
    await page.goto('http://localhost:3000')
    await page.waitForTimeout(1_000)

    const header = page.locator('header').first()
    const initialWidth = await header.evaluate((element) => element.getBoundingClientRect().width)

    await page.evaluate(() => window.scrollTo(0, 700))
    await expect
      .poll(() => header.evaluate((element) => element.getBoundingClientRect().width))
      .toBeLessThan(initialWidth - 100)

    await header.locator(':scope > div:first-child nav a[href="/news"]').click()
    await page.waitForURL('**/news')

    await expect
      .poll(() => header.evaluate((element) => element.getBoundingClientRect().width))
      .toBeCloseTo(initialWidth, 0)
  })

  test('fits the viewport and closes mobile navigation after routing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 })
    await page.goto('http://localhost:3000')
    await page.waitForTimeout(1_000)

    await page
      .locator('header')
      .first()
      .locator(':scope > div:first-child nav a[href="/news"]')
      .click()
    await page.waitForURL('**/news')

    await page.setViewportSize({ width: 1024, height: 800 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(1024)

    await page.setViewportSize({ width: 390, height: 800 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390)

    const navigation = page.locator('#mobile-navigation')
    await page.getByRole('button', { name: 'باز کردن منو' }).click()
    await expect(navigation).toHaveAttribute('aria-hidden', 'false')

    await navigation.locator('nav a[href="/"]').click()
    await page.waitForURL((url) => url.pathname === '/')
    await expect(navigation).toHaveAttribute('aria-hidden', 'true')
    await expect(navigation).not.toBeInViewport()
  })

  test('does not create a nested scrollbar while sections are waiting to reveal', async ({
    page,
  }) => {
    await page.goto('http://localhost:3000')

    const lastReveal = page.locator('main > div').last()
    await expect(lastReveal).toHaveCSS('transform', /48/)

    const hasNestedVerticalScrollbar = await page.locator('main').evaluate((main) => {
      const { overflowY } = getComputedStyle(main)

      return ['auto', 'scroll'].includes(overflowY) && main.scrollHeight > main.clientHeight
    })

    expect(hasNestedVerticalScrollbar).toBe(false)
  })
})
