import { expect, test } from '@playwright/test'

const origin = 'http://localhost:3000'

test('a long Persian lead wraps fully on mobile', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 })
  const { docs } = await (
    await request.get(`${origin}/api/news?limit=1&depth=0&where[excerpt][exists]=true`)
  ).json()
  const doc = docs[0]
  const url = `${origin}/news/${encodeURIComponent(doc.slug)}`
  const excerpt =
    Array.from({ length: 5 }, () =>
      'این خلاصه طولانی فارسی برای بررسی نمایش کامل متن و شکستن سطرها در صفحه موبایل است. '.repeat(4),
    ).join('\n\n') +
    '\n' +
    'نوآوری'.repeat(80)

  // Exercise the real SSR markup and styles with a long fixture without changing CMS data.
  await page.route(url, async (route) => {
    const response = await route.fetch()
    const body = (await response.text())
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replaceAll(doc.excerpt, excerpt)
    await route.fulfill({ response, body })
  })
  await page.goto(url)
  const lead = page.locator('article header [data-story-lead]')
  await expect(lead).toHaveText(excerpt)
  const dimensions = await lead.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height)
  await lead.screenshot({ path: testInfo.outputPath('long-mobile-lead.png') })
})

test('magazine latest lists match published CMS ordering', async ({ page, request }) => {
  const news = await (
    await request.get(
      `${origin}/api/news?limit=8&depth=0&sort=-pinned,-publishedAt,-createdAt&where[_status][equals]=published`,
    )
  ).json()
  const posts = await (
    await request.get(
      `${origin}/api/posts?limit=3&depth=0&sort=-publishedAt,-createdAt&where[_status][equals]=published`,
    )
  ).json()
  await page.goto(`${origin}/mag`)
  for (const [id, collection, docs] of [
    ['latest-news', 'news', news.docs],
    ['articles', 'posts', posts.docs],
  ] as const) {
    const section = page.locator(`#${id}`).locator('..').locator('article')
    await expect(section).toHaveCount(docs.length)
    const links = await section.evaluateAll(
      (cards, kind) =>
        cards.map((card) => {
          const href = card.querySelector(`a[href^="/${kind}/"]`)?.getAttribute('href')
          return href ? decodeURIComponent(href) : null
        }),
      collection,
    )
    expect(links).toEqual(docs.map((doc: { slug: string }) => `/${collection}/${doc.slug}`))
    expect(docs.every((doc: { _status: string }) => doc._status === 'published')).toBe(true)
  }
})

for (const width of [375, 768, 1280]) {
  test.describe(`content at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('news and article leads fit, and news navigation works', async ({
      page,
      request,
    }, testInfo) => {
      for (const collection of ['news', 'posts']) {
        const response = await request.get(
          `${origin}/api/${collection}?limit=1&depth=0&sort=-publishedAt&where[_status][equals]=published&where[excerpt][exists]=true`,
        )
        const { docs } = await response.json()
        expect(docs.length).toBeGreaterThan(0)
        const doc = docs[0]
        await page.goto(`${origin}/${collection}/${encodeURIComponent(doc.slug)}`)
        const lead = page.locator('article header [data-story-lead]')
        await expect(lead).toBeVisible()
        await expect(lead).toHaveText(doc.excerpt)
        const layout = await lead.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            scrollWidth: element.scrollWidth,
            background: style.backgroundColor,
            border: style.borderTopWidth,
          }
        })
        expect(layout.left).toBeGreaterThanOrEqual(0)
        expect(layout.right).toBeLessThanOrEqual(width)
        expect(layout.scrollWidth).toBeLessThanOrEqual(Math.ceil(layout.width))
        expect(layout.border).toBe('1px')
        expect(layout.background).toBe('rgb(245, 245, 245)')
        await page.screenshot({ path: testInfo.outputPath(`${collection}-${width}.png`) })
      }

      const footerLinks = await page
        .locator('footer a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
      expect(footerLinks[footerLinks.indexOf('/mag') + 1]).toBe('/news')
      expect(footerLinks.filter((href) => href === '/news')).toHaveLength(1)

      if (width < 768) {
        await page.getByRole('button', { name: 'باز کردن منو', exact: true }).click()
        const nav = page.locator('#mobile-navigation nav')
        const links = await nav
          .locator('a')
          .evaluateAll((items) => items.map((item) => item.getAttribute('href')))
        expect(links[links.indexOf('/mag') + 1]).toBe('/news')
        await nav.getByRole('link', { name: 'اخبار', exact: true }).click()
        await expect(page).toHaveURL(`${origin}/news`)
        await expect(page.getByRole('dialog', { name: 'فهرست ناوبری' })).toBeHidden()
      } else {
        const nav = page.locator('header.fixed nav').first()
        const links = await nav
          .locator('a')
          .evaluateAll((items) => items.map((item) => item.getAttribute('href')))
        expect(links[links.indexOf('/mag') + 1]).toBe('/news')
        await nav.getByRole('link', { name: 'اخبار', exact: true }).click()
        await expect(page).toHaveURL(`${origin}/news`)
        await expect(nav.getByRole('link', { name: 'اخبار', exact: true })).toHaveAttribute(
          'aria-current',
          'page',
        )
        await page.mouse.wheel(0, 600)
        await expect(nav.getByRole('link', { name: 'اخبار', exact: true })).toBeInViewport()
        await page.screenshot({ path: testInfo.outputPath(`header-scrolled-${width}.png`) })
      }
    })
  })
}
