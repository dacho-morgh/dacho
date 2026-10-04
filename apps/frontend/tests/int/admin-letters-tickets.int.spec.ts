// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import LettersPage from '@/app/(frontend)/dashboard/letters/page'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('payload', () => ({ getPayload: async () => ({
  auth: async () => ({ user: { id: 'admin' } }),
  find: async () => ({ docs: [] }),
}) }))
vi.mock('@/utilities/dashboard-server', () => ({
  isSeniorManagerUser: async () => true,
  serverDashboardFetch: mocks.fetch,
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('shows fetched support tickets in the admin letters table with a detail link', async () => {
  mocks.fetch.mockImplementation(async (path: string) => ({ items: path === '/support?limit=100' ? [{
    id: 'ticket-1', requesterId: 'applicant-1', subject: 'پیگیری درخواست پشتیبانی',
    message: 'لطفاً بررسی کنید', status: 'open', response: null,
    createdAt: '2026-09-17T09:00:00Z', updatedAt: '2026-09-17T09:00:00Z',
  }] : [] }))
  render(await LettersPage({}))
  expect(screen.queryAllByRole('link', { name: 'پیگیری درخواست پشتیبانی' })).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'تیکت‌های پشتیبانی' }))
  expect(screen.getAllByRole('link', { name: 'پیگیری درخواست پشتیبانی' }).map((link) => link.getAttribute('href')))
    .toEqual(['/dashboard/letters/support%3Aticket-1', '/dashboard/letters/support%3Aticket-1'])
  expect(mocks.fetch).toHaveBeenCalledWith('/support?limit=100')
  expect(screen.getAllByText('تیکت پشتیبانی')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'نامه‌های ارسالی' }))
  expect(screen.queryAllByRole('link', { name: 'پیگیری درخواست پشتیبانی' })).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'تیکت‌های پشتیبانی' }))
  fireEvent.keyDown(screen.getByRole('button', { name: 'منوی عملیات' }), { key: 'Enter' })
  expect((await screen.findByRole('menuitem', { name: 'پاسخ به تیکت' })).getAttribute('href'))
    .toBe('/dashboard/letters/support%3Aticket-1')
  expect(screen.queryByRole('menuitem', { name: 'پاک کردن' })).toBeNull()
})
