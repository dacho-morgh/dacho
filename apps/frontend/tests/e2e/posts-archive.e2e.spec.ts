import { expect, test } from '@playwright/test'

test('posts archive uses the news layout and links to articles', async ({ page }) => {
  await page.goto('http://localhost:3000/posts')

  await expect(page.getByRole('heading', { name: 'مقالات', level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'مسیر صفحه' })).toContainText('مقالات')
  await expect(page.locator('a[href="/posts/mag-sample-post-1"]').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'مطالعه مقاله' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Posts' })).toHaveCount(0)
})

test('first numbered page returns to the canonical posts archive', async ({ page }) => {
  await page.goto('http://localhost:3000/posts/page/1')
  await expect(page).toHaveURL('http://localhost:3000/posts')
})
