// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MailDetailView, type MailData } from '@/components/dashboard/mail-detail-view'

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

it('shows the loading frame without actions while letter data is pending', () => {
  const { container } = render(createElement(MailDetailView, { mail: null, showActions: true }))
  expect(screen.getByRole('article').getAttribute('aria-busy')).toBe('true')
  expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(8)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('عنوان نامه')
})


const mail: MailData = {
  id: 'letter-1', title: 'نامه آزمایشی', category: 'رسمی',
  senderName: 'فرستنده نمونه', senderRole: 'مدیر',
  datePersian: '۱۴۰۵/۰۱/۰۱', dayOfWeek: 'دوشنبه', timeStr: '۱۴:۵۰',
  body: 'متن واقعی نامه',
}

it('does not claim feedback was saved when there is no backend endpoint', () => {
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  render(createElement(MailDetailView, { mail, showActions: true }))
  fireEvent.click(screen.getByRole('button', { name: 'ثبت بازخورد' }))
  expect(screen.getByRole('status').textContent).toContain('هنوز در دسترس نیست')
  expect(request).not.toHaveBeenCalled()
})

it('hides letter actions when viewing another source', () => {
  render(createElement(MailDetailView, { mail, showActions: false }))
  expect(screen.queryByRole('button')).toBeNull()
})

it('retains the letter on failed deletion and returns to the inbox after retry', async () => {
  const request = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }))
  vi.stubGlobal('fetch', request)
  render(createElement(MailDetailView, { mail, showActions: true }))
  fireEvent.keyDown(screen.getByRole('button', { name: 'عملیات بیشتر' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: 'پاک کردن' }))
  expect((await screen.findByRole('status')).textContent).toContain('حذف نامه انجام نشد')
  expect(navigation.push).not.toHaveBeenCalled()
  request.mockResolvedValueOnce(new Response(JSON.stringify({ success: true })))
  fireEvent.keyDown(screen.getByRole('button', { name: 'عملیات بیشتر' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: 'پاک کردن' }))
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard/letters'))
  expect(request).toHaveBeenLastCalledWith('/api/dashboard/letters/letter-1', expect.objectContaining({ method: 'DELETE' }))
})

it('renders the Figma breadcrumb, sender, metadata and body without demo controls', () => {
  render(createElement(MailDetailView, { mail, showActions: true }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(mail.title)
  expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(mail.title)
  expect(screen.getByRole('link', { name: 'کارتابل نامه' }).getAttribute('href')).toBe('/dashboard/letters')
  expect(screen.getByText(mail.senderName)).toBeTruthy()
  expect(screen.getByText(mail.dayOfWeek)).toBeTruthy()
  expect(screen.getByText(mail.body)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'ثبت بازخورد' })).toBeTruthy()
  expect(screen.queryByText('نمایش اصلی')).toBeNull()
  expect(screen.queryByText('پاسخ سریع به این نامه')).toBeNull()
})
