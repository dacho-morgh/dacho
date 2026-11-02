// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OwnerOverview } from '@/components/dashboard/owner-overview'
import {
  activeEmployees,
  companyVerification,
  openEvents,
} from '@/components/dashboard/owner-overview/derive'
import { activityTone } from '@/components/dashboard/owner-overview/tone'
import { monthlyTrend, percentChange } from '@/utilities/dashboard-trend'

const backend = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'payload-token=session' }),
}))
vi.mock('@/utilities/dashboard-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utilities/dashboard-server')>()),
  serverDashboardFetchResult: backend.fetch,
}))

const fa = (value: number) => value.toLocaleString('fa-IR')
// 1405/08/11 (Aban) in Tehran.
const NOW = new Date('2026-11-02T08:00:00Z')

describe('monthlyTrend', () => {
  it('buckets Tehran days into the last six Jalali months, oldest first, keeping empty months', () => {
    const points = monthlyTrend(
      [
        { day: '2026-11-01', submitted: 4, approved: 1 }, // آبان ۱۰
        { day: '2026-10-22', submitted: 3, approved: 3 }, // مهر ۳۰, the last day before Aban
        { day: '2026-10-23', submitted: 2, approved: 0 }, // آبان ۱
        { day: '2026-08-20', submitted: 5, approved: 2 }, // مرداد
        { day: '2025-01-01', submitted: 9, approved: 9 }, // outside the window
      ],
      NOW,
    )
    expect(points.map((point) => point.label)).toEqual([
      'خرداد',
      'تیر',
      'مرداد',
      'شهریور',
      'مهر',
      'آبان',
    ])
    expect(points.map((point) => point.submitted)).toEqual([0, 0, 5, 0, 3, 6])
    expect(points.map((point) => point.approved)).toEqual([0, 0, 2, 0, 3, 1])
  })

  it('crosses a Jalali year boundary', () => {
    const points = monthlyTrend([], new Date('2026-03-25T12:00:00Z')) // 1405/01/05
    expect(points.map((point) => point.label)).toEqual([
      'آبان',
      'آذر',
      'دی',
      'بهمن',
      'اسفند',
      'فروردین',
    ])
  })

  it('reports no change without a previous month to compare', () => {
    expect(percentChange(5, 0)).toBeUndefined()
    expect(percentChange(15, 10)).toBe(50)
    expect(percentChange(5, 10)).toBe(-50)
  })
})

describe('owner overview derivations', () => {
  it('counts verified companies, pending reviews, active staff by role and open events', () => {
    expect(
      companyVerification([
        { verificationStatus: 'approved' },
        { verificationStatus: 'pending' },
        { verificationStatus: 'unsubmitted' },
      ]),
    ).toEqual({ total: 3, approved: 1, pending: 1 })
    expect(
      activeEmployees([
        { operationalRole: 'reviewer', isActive: true },
        { operationalRole: 'reviewer', isActive: false },
        { operationalRole: 'chief-reviewer', isActive: true },
        { operationalRole: 'investment-reviewer', isActive: true },
      ]),
    ).toEqual({ total: 3, reviewers: 1, chiefs: 1, employersAndExperts: 1 })
    expect(
      openEvents(
        [
          {
            registrationOpenAt: '2026-10-01T00:00:00Z',
            registrationCloseAt: '2026-12-01T00:00:00Z',
          },
          {
            registrationOpenAt: '2026-10-01T00:00:00Z',
            registrationCloseAt: '2026-11-02T08:00:00Z',
          },
          {
            registrationOpenAt: '2026-12-01T00:00:00Z',
            registrationCloseAt: '2027-01-01T00:00:00Z',
          },
        ],
        NOW,
      ),
    ).toBe(1)
  })

  it('reads an activity tone from its server action key', () => {
    expect(activityTone('reject')).toBe('error')
    expect(activityTone('return_for_correction')).toBe('warning')
    expect(activityTone('approve')).toBe('success')
    expect(activityTone('submit')).toBe('brand')
    expect(activityTone(null)).toBe('brand')
  })
})

describe('OwnerOverview', () => {
  const counts = { total: 20, in_review: 8, approved: 6, action_needed: 2, rejected: 1 }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    backend.fetch.mockImplementation(async (path: string) => {
      if (path === '/stats/overview') {
        return {
          kind: 'ok',
          data: { counts, queues: [{ key: 'reopen_rejected', count: 2 }], events: [] },
        }
      }
      if (path === '/stats/trend') {
        return {
          kind: 'ok',
          data: {
            days: [
              { day: '2026-11-01', submitted: 6, approved: 2 },
              { day: '2026-10-10', submitted: 3, approved: 1 },
            ],
          },
        }
      }
      if (path.startsWith('/admin/requests')) {
        return {
          kind: 'ok',
          data: {
            items: [
              {
                id: 'r1',
                title: 'پایش هوشمند خطوط لوله',
                trackingCode: '1405002',
                status: 'in_review',
                reviewStage: 'triaged',
                createdAt: '2026-10-30T10:00:00Z',
                submissionDate: '2026-10-30T10:00:00Z',
                owner: { companyName: 'پارس‌پایش' },
              },
            ],
            total: 1,
            page: 1,
            totalPages: 1,
          },
        }
      }
      if (path.startsWith('/activities')) {
        return {
          kind: 'ok',
          data: {
            items: [
              {
                id: 'a1',
                ownerId: 'o',
                requestId: 'r1',
                letterId: null,
                type: 'transition',
                title: 'پرونده رد شد',
                description: 'در مرحله سردبیر',
                at: '2026-11-02T07:00:00Z',
                action: 'reject',
              },
            ],
            total: 1,
            page: 1,
            totalPages: 1,
          },
        }
      }
      if (path === '/admin/companies') {
        return {
          kind: 'ok',
          data: {
            items: [
              { verificationStatus: 'approved' },
              { verificationStatus: 'approved' },
              { verificationStatus: 'pending' },
            ],
          },
        }
      }
      if (path === '/admin/employees') {
        return {
          kind: 'ok',
          data: {
            items: [
              { operationalRole: 'reviewer', isActive: true },
              { operationalRole: 'chief-reviewer', isActive: true },
            ],
          },
        }
      }
      if (path === '/admin/events') {
        return {
          kind: 'ok',
          data: {
            items: [
              {
                registrationOpenAt: '2026-10-01T00:00:00Z',
                registrationCloseAt: '2026-12-01T00:00:00Z',
              },
            ],
          },
        }
      }
      return { kind: 'unavailable' }
    })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('renders every section from the dashboard API', async () => {
    render(await OwnerOverview({ userName: 'رضا کاظمی' }))

    expect(screen.getByText(/سلام رضا کاظمی/)).toBeTruthy()
    const kpis = within(screen.getByRole('region', { name: 'شاخص‌های کلیدی' }))
    expect(kpis.getByText(fa(20))).toBeTruthy()
    expect(kpis.getByText(`از ${fa(3)}`)).toBeTruthy()
    expect(kpis.getByText(`${fa(1)} شرکت در انتظار احراز هویت`)).toBeTruthy()
    expect(
      kpis.getByText(`${fa(1)} داور، ${fa(1)} سردبیر، ${fa(0)} کارفرما و کارشناس`),
    ).toBeTruthy()

    expect(screen.getByRole('img', { name: /نمودار ستونی درخواست‌ها/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'بررسی صف' }).getAttribute('href')).toBe(
      '/dashboard/requests?queue=reopen_rejected',
    )
    expect(screen.getByRole('link', { name: /پرونده رد شد/ }).getAttribute('href')).toBe(
      '/dashboard/requests/r1',
    )
    const table = within(screen.getByRole('table'))
    expect(table.getByText('پارس‌پایش')).toBeTruthy()
    expect(table.getByText('داوری')).toBeTruthy()
    expect(table.getByText('درحال بررسی')).toBeTruthy()
  })

  it('shows a dash and a notice, never a zero, for a read that failed', async () => {
    const ok = backend.fetch.getMockImplementation()!
    backend.fetch.mockImplementation(async (path: string) =>
      path === '/admin/companies' || path === '/activities?limit=4'
        ? { kind: 'unavailable' }
        : ok(path),
    )
    render(await OwnerOverview({ userName: null }))

    const kpis = within(screen.getByRole('region', { name: 'شاخص‌های کلیدی' }))
    expect(kpis.getByText('شرکت‌های تأییدشده').closest('[data-slot="card"]')?.textContent).toContain(
      '—',
    )
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(kpis.getByText(fa(20))).toBeTruthy()
  })
})
