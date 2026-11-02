// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import LettersPage from '@/app/(frontend)/dashboard/letters/page'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), push: vi.fn(), role: vi.fn(() => 'chief-reviewer') }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
  usePathname: () => '/dashboard/letters',
}))
vi.mock('payload', () => ({ getPayload: async () => ({
  auth: async () => ({ user: { id: 'chief' } }),
  find: async () => ({ docs: [{ id: 'company-user-1', name: 'شرکت فناور' }] }),
}) }))
vi.mock('@/utilities/dashboard-server', () => ({
  dashboardOperationalRole: mocks.role,
  isSeniorManagerUser: async () => false,
  serverDashboardFetchResult: mocks.fetch,
}))

afterEach(() => { cleanup(); vi.clearAllMocks() })

const letter = (overrides: Record<string, unknown>) => ({
  id: 'l-1', type: 'notification', title: 'ارسال درخواست', body: '', senderId: null, senderName: 'سامانه',
  senderRole: 'system', recipientId: 'chief', requestId: 'req-1', read: false, sentAt: '2026-11-02T09:00:00Z',
  attachments: [], nextStep: null, actionRequired: false, createdAt: '2026-11-02T09:00:00Z', updatedAt: '2026-11-02T09:00:00Z',
  ...overrides,
})

const page = (items: unknown[], counts = { unread: 1, actionRequired: 1 }) =>
  ({ kind: 'ok', data: { items, total: items.length, page: 1, totalPages: 1, counts } })

const view = (params: Record<string, string> = {}) => ({ searchParams: Promise.resolve(params) })

describe('inbox (S1)', () => {
  it('reads the received box by default and links a pending step to its case', async () => {
    mocks.fetch.mockResolvedValue(page([letter({ nextStep: 'triage', actionRequired: true })]))
    render(await LettersPage(view()))

    expect(mocks.fetch).toHaveBeenCalledWith('/letters?box=received&page=1&limit=20')
    expect(screen.getByRole('tab', { name: /نامه‌های دریافتی/ }).getAttribute('aria-selected')).toBe('true')
    const row = screen.getAllByRole('row')[1]!
    expect(within(row).getByText('نیازمند اقدام')).toBeTruthy()
    expect(within(row).getByRole('link', { name: 'بررسی اولیه' }).getAttribute('href')).toBe('/dashboard/requests/req-1')
    expect(within(row).getByText('(خوانده نشده)')).toBeTruthy()
  })

  it('links a booth step to its exhibition page', async () => {
    mocks.fetch.mockResolvedValue(page([letter({
      requestId: null, boothReservationId: 'res-1', exhibitionId: 'expo-1', nextStep: 'booth_receipt', actionRequired: true,
    })]))
    render(await LettersPage(view()))
    // Desktop table and mobile card both carry it.
    expect(screen.getAllByRole('link', { name: 'ارسال فیش' }).map((link) => link.getAttribute('href')))
      .toEqual(['/dashboard/exhibitions/expo-1', '/dashboard/exhibitions/expo-1'])
  })

  it('passes box, search, status and page to the backend and names the recipient of a sent letter', async () => {
    mocks.fetch.mockResolvedValue(page([letter({ senderId: 'chief', recipientId: 'company-user-1', read: true })]))
    render(await LettersPage(view({ box: 'sent', q: 'جلسه', status: 'unread', page: '2' })))

    expect(mocks.fetch).toHaveBeenCalledWith(`/letters?box=sent&page=2&limit=20&q=${encodeURIComponent('جلسه')}&status=unread`)
    expect(screen.getByRole('columnheader', { name: 'گیرنده' })).toBeTruthy()
    expect(screen.getAllByText('شرکت فناور').length).toBeGreaterThan(0)
    // Read state and hiding belong to the recipient, so a sent letter has no row menu.
    expect(screen.queryByRole('button', { name: /منوی عملیات/ })).toBeNull()
  })

  it('switches box and filter through the URL', async () => {
    mocks.fetch.mockResolvedValue(page([], { unread: 0, actionRequired: 0 }))
    render(await LettersPage(view({ q: 'قدیمی' })))

    fireEvent.click(screen.getByRole('tab', { name: 'نامه‌های ارسالی' }))
    expect(mocks.push).toHaveBeenLastCalledWith('/dashboard/letters?box=sent&q=%D9%82%D8%AF%DB%8C%D9%85%DB%8C')
    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجوی نامه‌ها' }), { target: { value: ' گزارش ' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(mocks.push).toHaveBeenLastCalledWith(`/dashboard/letters?q=${encodeURIComponent('گزارش')}`)
  })

  it('tells a filtered empty result apart from an empty mailbox', async () => {
    mocks.fetch.mockResolvedValue(page([], { unread: 0, actionRequired: 0 }))
    render(await LettersPage(view({ status: 'action_required' })))
    expect(screen.getByText('نامه‌ای با این جستجو یا فیلتر پیدا نشد')).toBeTruthy()
    expect(screen.queryByText('صندوق نامه‌های شما خالیست')).toBeNull()
  })

  it('shows a failed read as a notice, never an empty mailbox', async () => {
    mocks.fetch.mockResolvedValue({ kind: 'unavailable', status: 500 })
    render(await LettersPage(view()))
    expect(screen.getByRole('alert').getAttribute('data-state')).toBe('unavailable')
    expect(screen.queryByText('صندوق نامه‌های شما خالیست')).toBeNull()
  })

  it('offers companies the support message instead of composing a letter', async () => {
    mocks.role.mockReturnValue('representative')
    mocks.fetch.mockResolvedValue(page([], { unread: 0, actionRequired: 0 }))
    render(await LettersPage(view()))
    expect(screen.getByRole('button', { name: /پیام به پشتیبانی/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /نامه جدید/ })).toBeNull()
  })
})
