// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RequestsPage from '@/app/(frontend)/dashboard/requests/page'
import { parseRequestFilters, requestFiltersQuery, requestQueueHref } from '@/components/dashboard/requests/types'
import { WorkQueueOverview } from '@/components/dashboard/work-queue-overview'

const backend = vi.hoisted(() => ({ fetch: vi.fn(), auth: vi.fn(), list: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ cookie: 'payload-token=session' }),
  cookies: async () => ({ toString: () => 'payload-token=session' }),
}))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: async () => ({ auth: backend.auth }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/utilities/dashboard-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utilities/dashboard-server')>()),
  serverDashboardFetchResult: backend.fetch,
}))
vi.mock('@/components/dashboard/admin-request-list', () => ({
  AdminRequestList: (props: unknown) => {
    backend.list(props)
    return createElement('div', null, 'Internal request queue')
  },
}))

const EVENT_ID = '11111111-1111-4111-8111-111111111111'
const stats = { total: 7, in_review: 3, approved: 1, action_needed: 2, rejected: 1 }

function mockReads() {
  backend.fetch.mockImplementation(async (path: string) => {
    if (path.startsWith('/stats/overview')) {
      return { kind: 'ok', data: { counts: stats, queues: [], events: [{ id: EVENT_ID, title: 'رویداد نمونه' }] } }
    }
    if (path.startsWith('/stats')) return { kind: 'ok', data: stats }
    return { kind: 'ok', data: { items: [], total: 60, page: 1, totalPages: 2 } }
  })
}

const request = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  trackingCode: `T-${id}`,
  title: `درخواست ${id}`,
  status: 'in_review',
  reviewStage: 'chief_triage',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...extra,
})

const asUser = (operationalRole: string) =>
  backend.auth.mockResolvedValue({ user: { id: 'person', operationalRole, isActive: true } })

beforeEach(mockReads)
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('WorkQueueOverview', () => {
  it('links request queues to their filtered list and shows only pending, known work', () => {
    render(
      createElement(WorkQueueOverview, {
        queues: [
          { key: 'chief_triage', count: 3 },
          { key: 'chief_decide', count: 0 },
          { key: 'not_a_queue', count: 9 },
        ],
      }),
    )
    const link = screen.getByRole('link', { name: /در انتظار بررسی اولیه/ })
    expect(link.getAttribute('href')).toBe('/dashboard/requests?queue=chief_triage')
    expect(link.textContent).toContain((3).toLocaleString('fa-IR'))
    expect(screen.queryByText('داوری کامل‌شده در انتظار تصمیم')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('shows a count without a link when no list matches it', () => {
    render(createElement(WorkQueueOverview, { queues: [{ key: 'verification_pending', count: 2 }] }))
    expect(screen.getByText('احراز هویت شرکت‌ها در انتظار بررسی')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('keeps an empty queue apart from a failed read', () => {
    render(createElement(WorkQueueOverview, { queues: [{ key: 'chief_triage', count: 0 }] }))
    expect(screen.getByText('در حال حاضر کاری در انتظار اقدام شما نیست.')).toBeTruthy()
    cleanup()

    render(createElement(WorkQueueOverview, { notice: 'unavailable' }))
    expect(screen.queryByText('در حال حاضر کاری در انتظار اقدام شما نیست.')).toBeNull()
    expect(screen.getByText('دریافت اطلاعات انجام نشد')).toBeTruthy()
  })
})

describe('request filters in the URL', () => {
  it('drops malformed values before they reach the API', () => {
    expect(
      parseRequestFilters({ search: '  طرح  ', eventId: 'not-a-uuid', stage: 'nope', queue: "x'; DROP" }),
    ).toEqual({ search: 'طرح' })
    expect(parseRequestFilters({ search: ['a', 'b'], eventId: EVENT_ID, stage: 'triaged', queue: 'chief_triage' })).toEqual({
      eventId: EVENT_ID,
      stage: 'triaged',
      queue: 'chief_triage',
    })
  })

  it('encodes the search into both the API query and the page link', () => {
    expect(requestFiltersQuery({ search: 'a&b' })).toBe('&search=a%26b')
    expect(requestFiltersQuery({})).toBe('')
    expect(requestQueueHref('/dashboard/requests', 'approved', 2, { queue: 'company_draft' })).toBe(
      '/dashboard/requests?status=approved&page=2&queue=company_draft',
    )
  })
})

describe('RequestsPage', () => {
  const searchParams = Promise.resolve({ search: 'طرح', eventId: EVENT_ID, stage: 'triaged', queue: 'company_draft' })
  const query = `search=${encodeURIComponent('طرح')}&eventId=${EVENT_ID}&stage=triaged&queue=company_draft`

  it('reads the company list with its search and event filters and counts its three stages', async () => {
    asUser('representative')
    backend.fetch.mockImplementation(async (path: string) =>
      path.startsWith('/stats/overview')
        ? { kind: 'ok', data: { counts: stats, queues: [], events: [{ id: EVENT_ID, title: 'رویداد نمونه' }] } }
        : {
            kind: 'ok',
            data: {
              items: [
                request('a', { status: 'draft', reviewStage: null }),
                request('b', { reviewStage: 'chief_triage' }),
                request('c', { reviewStage: 'triaged' }),
                request('d', { status: 'approved', reviewStage: 'advanced' }),
              ],
              total: 4,
              page: 1,
              totalPages: 1,
            },
          },
    )
    render(await RequestsPage({ searchParams: Promise.resolve({ search: 'طرح', eventId: EVENT_ID, phase: 'verification', queue: 'company_draft' }) }))

    // The stage is applied on the page; the API gets the other filters, and no stats call is made for a company.
    expect(backend.fetch).toHaveBeenCalledWith(`/requests?limit=500&page=1&search=${encodeURIComponent('طرح')}&eventId=${EVENT_ID}&queue=company_draft`)
    expect(backend.fetch.mock.calls.some(([path]) => String(path).startsWith('/stats?'))).toBe(false)
    expect(screen.getByText('صف: پیش‌نویس‌های ارسال‌نشده')).toBeTruthy()
    // Only the two requests in the verification stage are listed, each with the company stage label.
    expect(screen.getAllByText('احراز هویت')).toHaveLength(2)
    expect(screen.queryByText('در حال داوری')).toBeNull()

    // The company filters by its three stages, with each stage's size, and by event.
    fireEvent.click(screen.getByRole('button', { name: /فیلتر درخواست‌ها/ }))
    const stages = await screen.findByRole('combobox', { name: 'مرحله درخواست' })
    expect(within(stages).getAllByRole('option').map((option) => option.textContent)).toEqual([
      `همه (${(4).toLocaleString('fa-IR')})`,
      `احراز هویت (${(2).toLocaleString('fa-IR')})`,
      `در حال داوری (${(1).toLocaleString('fa-IR')})`,
      `تمام‌شده (نتیجهٔ نهایی) (${(1).toLocaleString('fa-IR')})`,
    ])
    expect(screen.queryByRole('combobox', { name: 'وضعیت درخواست' })).toBeNull()
    expect(within(screen.getByRole('combobox', { name: 'رویداد' })).getByRole('option', { name: 'رویداد نمونه' })).toBeTruthy()
  })

  it('hands the same filters to the internal list', async () => {
    asUser('chief-reviewer')
    render(await RequestsPage({ searchParams }))
    expect(screen.getByText('Internal request queue')).toBeTruthy()
    expect(backend.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        filters: { search: 'طرح', eventId: EVENT_ID, stage: 'triaged', queue: 'company_draft' },
      }),
    )
    expect(backend.fetch).toHaveBeenCalledWith(`/stats?${query}`)
  })

  it('offers no event when the overview cannot be read, and the list still renders', async () => {
    asUser('representative')
    backend.fetch.mockImplementation(async (path: string) =>
      path.startsWith('/stats/overview')
        ? { kind: 'denied' }
        : path.startsWith('/stats')
          ? { kind: 'ok', data: stats }
          : { kind: 'ok', data: { items: [], total: 0, page: 1, totalPages: 1 } },
    )
    render(await RequestsPage({ searchParams: Promise.resolve({}) }))
    fireEvent.click(screen.getByRole('button', { name: /فیلتر درخواست‌ها/ }))
    await screen.findByRole('combobox', { name: 'مرحله درخواست' })
    expect(screen.queryByRole('option', { name: 'رویداد نمونه' })).toBeNull()
  })
})
