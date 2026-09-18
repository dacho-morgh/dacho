import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { MailDetailView, type MailData } from '@/components/dashboard/mail-detail-view'
import LetterDetailLayout from '@/app/(frontend)/dashboard/letters/[id]/layout'
import LetterDetailLoading from '@/app/(frontend)/dashboard/letters/[id]/loading'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {} }) }))

// Opt-in geometry check: uses the running site's real stylesheet and font.
// No authenticated data, API mutations, or login bypass; body is an isolated fixture.
it.skipIf(!process.env.LETTER_LAYOUT_CHECK)('matches Figma desktop geometry and fits mobile', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } })
    // Use the site's real stylesheet/font but block its JS so the live page
    // cannot hydrate over the isolated fixture markup injected below.
    await page.route(/\.js(\?|$)/, (route) => route.abort())
    await page.goto('http://localhost:3000/login')
    const mail: MailData = {
      id: 'fixture', title: 'عنوان نامه', category: 'رسمی', senderName: 'نام و نام خانوادگی',
      senderRole: 'عنوان و سمت', dayOfWeek: 'دوشنبه', datePersian: '۱۴۰۵/۰۱/۰۱', timeStr: '۱۴:۵۰',
      body: 'متن آزمایشی نامه برای بررسی چیدمان؛ این داده از سامانه دریافت نشده است.',
    }
    for (const loading of [false, true]) {
      const content = loading ? createElement(LetterDetailLoading) : createElement(MailDetailView, { mail, showActions: true })
      const html = renderToStaticMarkup(createElement(LetterDetailLayout, null, content))
      await page.evaluate((markup) => {
        document.body.innerHTML = `<div id="fixture" style="width:calc(100% - 268px)">${markup}</div>`
      }, html)
      await page.evaluate(() => document.fonts.ready)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const card = await page.getByRole('article').boundingBox()
      expect(card).toMatchObject({ x: 284, y: 96, width: 1140, height: 912 })
      const separator = await page.getByRole('separator').boundingBox()
      expect(separator?.y).toBe(loading ? 264 : 276)
      const title = loading ? page.locator('[data-slot="skeleton"]').nth(4) : page.getByRole('heading', { level: 2 })
      expect((await title.boundingBox())?.y).toBe(loading ? 289 : 301)
      await page.screenshot({ path: join(tmpdir(), `letter-detail-${loading ? 'loading' : 'default'}.png`) })
      console.log(JSON.stringify({ state: loading ? 'loading' : 'default', card, separator, screenshot: join(tmpdir(), `letter-detail-${loading ? 'loading' : 'default'}.png`) }))
      await page.setViewportSize({ width: 390, height: 844 })
      await page.evaluate(() => { document.getElementById('fixture')!.style.width = '100%' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
      await page.setViewportSize({ width: 1440, height: 1024 })
    }
  } finally {
    await browser.close()
  }
}, 60000)
