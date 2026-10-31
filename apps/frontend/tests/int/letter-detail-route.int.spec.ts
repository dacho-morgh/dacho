// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import LetterDetailPage from '@/app/(frontend)/dashboard/letters/[id]/page'

const backend = vi.hoisted(() => ({
  fetch: vi.fn(), senior: vi.fn(),
  payload: { auth: vi.fn(), findByID: vi.fn() },
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => backend.payload }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/utilities/dashboard-server', () => ({
  isSeniorManagerUser: backend.senior,
  serverDashboardFetchResult: backend.fetch,
}))
vi.mock('@/components/dashboard/support-ticket-actions', () => ({
  SupportTicketActions: () => createElement('div', null, 'Support actions'),
}))

afterEach(() => { cleanup(); vi.resetAllMocks() })

const letter = {
  id: 'letter-1', title: 'عنوان نامه', type: 'official', body: 'متن نامه',
  senderName: 'فرستنده', senderRole: 'مدیر', sentAt: '2026-09-17T09:00:00Z',
}

it.each([true, false])('preserves role-specific fetching and enables real letter actions (admin=%s)', async (admin) => {
  backend.payload.auth.mockResolvedValue({ user: { id: 'user-1' } })
  backend.senior.mockResolvedValue(admin)
  backend.fetch.mockResolvedValue({ kind: 'ok', data: { letter } })
  render(await LetterDetailPage({ params: Promise.resolve({ id: 'letter:letter-1' }) }))
  expect(backend.fetch).toHaveBeenCalledWith(`${admin ? '/admin/letters' : '/letters'}/letter-1`)
  expect(screen.getByRole('button', { name: 'عملیات بیشتر' })).toBeTruthy()
  expect(screen.queryByText('← بازگشت به کارتابل')).toBeNull()
})

it('keeps missing letters as not-found instead of an endless skeleton', async () => {
  backend.payload.auth.mockResolvedValue({ user: { id: 'user-1' } })
  backend.fetch.mockResolvedValue({ kind: 'unavailable', status: 404 })
  await expect(LetterDetailPage({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow('NOT_FOUND')
})

it.each([
  [{ kind: 'unavailable', status: 500 }, 'unavailable'],
  [{ kind: 'unavailable' }, 'unavailable'],
  [{ kind: 'denied' }, 'denied'],
  [{ kind: 'unauthenticated' }, 'expired'],
])('does not present a failed read %j as a missing letter', async (result, state) => {
  backend.payload.auth.mockResolvedValue({ user: { id: 'user-1' } })
  backend.fetch.mockResolvedValue(result)
  render(await LetterDetailPage({ params: Promise.resolve({ id: 'letter:letter-1' }) }))
  expect(screen.getByRole('alert').getAttribute('data-state')).toBe(state)
  expect(screen.queryByRole('heading', { name: 'عنوان نامه' })).toBeNull()
})

it('keeps support actions separate from letter deletion', async () => {
  backend.payload.auth.mockResolvedValue({ user: { id: 'user-1' } })
  backend.senior.mockResolvedValue(true)
  backend.fetch.mockResolvedValue({ kind: 'ok', data: { ticket: { id: 'ticket-1', subject: 'پشتیبانی', message: 'پیام', requesterId: 'user-1', status: 'open' } } })
  render(await LetterDetailPage({ params: Promise.resolve({ id: 'support:ticket-1' }) }))
  expect(screen.getByText('Support actions')).toBeTruthy()
  expect(screen.getByText('پیام')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'ثبت بازخورد' })).toBeTruthy()
  expect(screen.queryByText('user-1')).toBeNull()
  expect(screen.queryByRole('button', { name: 'عملیات بیشتر' })).toBeNull()
})
