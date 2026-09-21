import { expect, test } from '@playwright/test'

test('Mag renders seeded CMS stories, ordered sections, and real detail links', async ({
  page,
}) => {
  await page.goto('http://localhost:3000/mag')
  await expect(
    page
      .getByRole('heading', { name: 'نسل جدید مدل‌های زبانی و تأثیر آن بر کسب‌وکارهای ایرانی' })
      .first(),
  ).toBeVisible()
  await expect(page.locator('a[href="/news/mag-sample-news-1"]').first()).toBeVisible()
  await expect(page.locator('a[href="/posts/mag-sample-post-1"]').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'انتخاب سردبیر' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'فناوری', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'هوش مصنوعی', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'اخبار رویدادها' })).toBeVisible()
  const eventNews = page.locator('#event-news').locator('..')
  await expect(eventNews.locator('article')).toHaveCount(2)
  await expect(eventNews.locator('a[href="/news/mag-sample-news-5"]').first()).toBeVisible()
})

test('hashtag links and search return news and articles from CMS', async ({ page }) => {
  await page.goto('http://localhost:3000/mag')
  await page.getByRole('link', { name: '#هوش مصنوعی' }).click()
  await expect(page).toHaveURL(/hashrag=/)
  await expect(page.getByRole('heading', { name: 'نتایج #هوش مصنوعی' })).toBeVisible()
  const results = page.locator('#hashtag-results').locator('..')
  await expect(results.locator('a[href^="/news/"]').first()).toBeVisible()
  await expect(results.locator('a[href^="/posts/"]').first()).toBeVisible()
  await page.getByRole('link', { name: '#بلاک‌چین' }).click()
  await expect(page.getByRole('heading', { name: 'نتایج #بلاک‌چین' })).toBeVisible()
})

test('newsletter stores a subscriber and accepts a repeated subscription', async ({ request }) => {
  const email = `mag-test-${Date.now()}@example.com`
  const first = await request.post('http://localhost:3000/api/mag/newsletter', { data: { email } })
  expect(first.status()).toBe(200)
  const repeated = await request.post('http://localhost:3000/api/mag/newsletter', {
    data: { email },
  })
  expect(repeated.status()).toBe(200)
  const invalid = await request.post('http://localhost:3000/api/mag/newsletter', {
    data: { email: 'bad' },
  })
  expect(invalid.status()).toBe(400)
})

test('admin-selected related posts appear on a seeded article', async ({ page }) => {
  await page.goto('http://localhost:3000/posts/mag-sample-post-1')
  await expect(page.locator('a[href="/posts/mag-sample-post-2"]').first()).toBeVisible()
  await expect(page.locator('a[href="/posts/mag-sample-post-3"]').first()).toBeVisible()
})

test('admin-selected related news appears on a seeded news story', async ({ page }) => {
  await page.goto('http://localhost:3000/news/mag-sample-news-1')
  await expect(page.getByRole('heading', { name: 'اخبار مرتبط' })).toBeVisible()
  await expect(page.locator('a[href="/news/mag-sample-news-7"]').first()).toBeVisible()
})
