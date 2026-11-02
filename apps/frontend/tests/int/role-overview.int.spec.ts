// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoleOverview } from '@/components/dashboard/role-overview'

const backend = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'payload-token=session' }),
}))
vi.mock('@/utilities/dashboard-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utilities/dashboard-server')>()),
  serverDashboardFetchResult: backend.fetch,
}))

const fa = (value: number) => value.toLocaleString('fa-IR')
const NOW = new Date('2026-11-02T08:00:00Z')
const ok = (data: unknown) => ({ kind: 'ok', data })
const counts = { total: 20, in_review: 8, approved: 6, action_needed: 2, rejected: 1 }
const activity = {
  id: 'a1',
  ownerId: 'o',
  requestId: 'r1',
  letterId: null,
  type: 'transition',
  title: 'پرونده تأیید شد',
  description: null,
  at: '2026-11-02T07:00:00Z',
  action: 'approve',
}
const feed = ok({ items: [activity], total: 1, page: 1, totalPages: 1 })

type Routes = Record<string, unknown>
function serve(routes: Routes) {
  backend.fetch.mockImplementation(async (path: string) => routes[path] ?? { kind: 'unavailable' })
}

/** The overviews are async server components, so resolve the one the role picks before rendering it. */
async function renderRole(props: Parameters<typeof RoleOverview>[0]) {
  const picked = (await RoleOverview(props)) as ReactElement<unknown>
  const resolved = await (picked.type as (p: unknown) => Promise<ReactElement>)(picked.props)
  return render(resolved)
}

const kpi = () => within(screen.getByRole('region', { name: 'شاخص‌های کلیدی' }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('RoleOverview', () => {
  it('shows the Secretariat its queues and pending company verifications', async () => {
    serve({
      '/stats/overview': ok({
        counts,
        events: [],
        queues: [
          { key: 'follow_up_unpublished', count: 5 },
          { key: 'supplementary_undelivered', count: 3 },
          { key: 'verification_pending', count: 12 },
          { key: 'support_open', count: 7 },
        ],
      }),
      '/activities?limit=4': feed,
      '/admin/companies?verificationStatus=pending': ok({
        items: [
          {
            id: 'c1',
            name: 'سمیرا',
            phone: '0912',
            companyName: 'آریانا فناوران',
            companyType: 'سهامی خاص',
            companyCity: 'بوشهر',
            verificationStatus: 'pending',
            verificationRevision: 2,
          },
        ],
      }),
    })
    await renderRole({ role: 'central-secretariat', userName: 'مریم احمدی' })

    expect(screen.getByText(/سلام مریم احمدی/)).toBeTruthy()
    expect(kpi().getByText(fa(12))).toBeTruthy()
    expect(kpi().getByText(fa(7))).toBeTruthy()
    expect(kpi().getByText(`${fa(3)} مدرک تکمیلی تحویل‌نشده`)).toBeTruthy()
    const table = within(screen.getByRole('table'))
    expect(table.getByText('آریانا فناوران')).toBeTruthy()
    expect(table.getByText(`نسخه ${fa(2)}`)).toBeTruthy()
    expect(table.getByRole('link', { name: 'بررسی' }).getAttribute('href')).toBe(
      '/dashboard/companies/c1',
    )
  })

  it('shows the chief the triage queues, a cumulative funnel and the next command per case', async () => {
    serve({
      '/stats/overview': ok({
        counts,
        events: [],
        queues: [
          { key: 'chief_triage', count: 6 },
          { key: 'chief_start_review', count: 4 },
          { key: 'chief_decide', count: 3 },
        ],
      }),
      '/stats/trend': ok({ days: [{ day: '2026-11-01', submitted: 8, approved: 1 }] }),
      '/stats?stage=triaged': ok({ ...counts, total: 12 }),
      '/stats?stage=advanced': ok({ ...counts, total: 5 }),
      '/activities?limit=4': feed,
      '/admin/requests?limit=5&page=1': ok({
        items: [
          {
            id: 'r1',
            title: 'پایش لوله',
            trackingCode: '1405001',
            status: 'in_review',
            reviewStage: 'triaged',
            allowedActions: ['decideReview'],
            createdAt: '2026-10-30T10:00:00Z',
            owner: { companyName: 'پارس‌پایش' },
          },
          {
            id: 'r2',
            title: 'توربین بادی',
            trackingCode: '1405002',
            status: 'in_review',
            reviewStage: 'chief_triage',
            allowedActions: ['triage'],
            createdAt: '2026-10-31T10:00:00Z',
          },
        ],
        total: 2,
        page: 1,
        totalPages: 1,
      }),
    })
    await renderRole({ role: 'chief-reviewer', userName: null })

    expect(kpi().getByText(fa(6))).toBeTruthy()
    expect(kpi().getByText(fa(20))).toBeTruthy()
    // 17 submitted (20 total minus 3 not sent); the funnel is sized against it.
    expect(
      screen.getByRole('progressbar', { name: `پذیرفته در بررسی اولیه: ${fa(12)} از ${fa(17)}` }),
    ).toBeTruthy()
    expect(
      screen.getByRole('progressbar', { name: `تصمیم به پیشروی: ${fa(5)} از ${fa(17)}` }),
    ).toBeTruthy()
    const table = within(screen.getByRole('table'))
    expect(table.getByRole('link', { name: 'تصمیم' }).getAttribute('href')).toBe(
      '/dashboard/requests/r1',
    )
    expect(table.getByRole('link', { name: 'بررسی اولیه' })).toBeTruthy()
  })

  it('shows a reviewer their own evaluation states without scores', async () => {
    const item = (
      id: string,
      actionable: boolean,
      evaluation: { state: 'draft' | 'final' } | null,
    ) => ({
      requestId: id,
      trackingCode: `code-${id}`,
      title: `پرونده ${id}`,
      revision: 1,
      status: 'in_review',
      reviewStage: 'triaged',
      submissionDate: null,
      event: null,
      subtopic: { id: 's', title: 'بازیافت حرارت' },
      companyName: 'شرکت نمونه',
      assignment: { role: 'reviewer', slot: 'ordinary', assignedAt: '2026-10-30T10:00:00Z' },
      round: { id: 'rr', requestRevision: 1, proposalRevision: 1, current: actionable },
      proposalRevision: 1,
      actionable,
      evaluation: evaluation && {
        ...evaluation,
        revision: 1,
        updatedAt: '2026-10-31T00:00:00Z',
        finalizedAt: null,
      },
    })
    serve({
      '/review/queue?view=all&page=1&limit=100': ok({
        items: [
          item('a', true, { state: 'draft' }),
          item('b', true, null),
          item('c', false, { state: 'final' }),
        ],
        total: 3,
        page: 1,
        totalPages: 1,
        counts: { open: 2, closed: 1, all: 3 },
      }),
      '/activities?limit=4': feed,
    })
    await renderRole({ role: 'reviewer', userName: 'علی رضایی' })

    expect(screen.getByText(new RegExp(`${fa(2)} ارزیابی منتظر ثبت نهایی`))).toBeTruthy()
    expect(kpi().getByText(`${fa(1)} پیش‌نویس، ${fa(1)} شروع‌نشده`)).toBeTruthy()
    const table = within(screen.getByRole('table'))
    expect(table.getByRole('link', { name: 'ادامه' })).toBeTruthy()
    expect(table.getByRole('link', { name: 'شروع ارزیابی' })).toBeTruthy()
    // Closed work sorts after open work.
    const rows = table.getAllByRole('row').slice(1)
    expect(rows.at(-1)?.textContent).toContain('پرونده c')
  })

  it('shows the investment expert the handed-off cases and the memos still owed', async () => {
    serve({
      '/investment/queue?page=1&limit=100': ok({
        total: 3,
        items: [
          {
            requestId: 'r1',
            trackingCode: '1405198',
            title: 'بازیافت حرارت',
            companyName: 'دانش‌بنیان خلیج',
            assignedAt: '2026-10-30T10:00:00Z',
            package: { packageVersion: 1, submittedAt: '2026-10-31T10:00:00Z' },
          },
          {
            requestId: 'r2',
            trackingCode: '1405187',
            title: 'باتری سدیمی',
            companyName: 'نوین‌انرژی',
            assignedAt: '2026-09-01T10:00:00Z',
            package: { packageVersion: 2, submittedAt: '2026-09-01T10:00:00Z' },
          },
        ],
      }),
      '/stats/overview': ok({ counts, events: [], queues: [{ key: 'memo_pending', count: 2 }] }),
      '/activities?limit=4': feed,
    })
    await renderRole({ role: 'investment-reviewer', userName: 'کامران' })

    expect(screen.getByText(new RegExp(`${fa(3)} پرونده در اختیار شماست`))).toBeTruthy()
    expect(kpi().getByText('رسیده در هفت روز اخیر')).toBeTruthy()
    const cards = kpi().getAllByText(fa(1))
    expect(cards.length).toBeGreaterThanOrEqual(2) // one fresh package, one memo written
    expect(
      within(screen.getByRole('table')).getAllByRole('link', { name: 'مشاهده پرونده' }),
    ).toHaveLength(2)
  })

  it('shows a company its own requests, actions owed and where its verification stands', async () => {
    serve({
      '/stats/overview': ok({
        counts,
        events: [],
        queues: [
          { key: 'company_draft', count: 1 },
          { key: 'company_correction', count: 1 },
          { key: 'company_financial_package', count: 1 },
          { key: 'company_supplementary', count: 0 },
        ],
      }),
      '/requests?limit=5&page=1': ok({
        items: [
          {
            id: 'r1',
            trackingCode: '1405203',
            title: 'توربین بادی',
            serviceName: 'ارائه طرح',
            serviceKey: 'k',
            status: 'action_needed',
            currentStep: 'بازگشت از سردبیر',
            submissionDate: '2026-10-26T00:00:00Z',
            createdAt: '2026-10-26T00:00:00Z',
          },
          {
            id: 'r2',
            trackingCode: '1405214',
            title: 'ذخیره‌ساز حرارتی',
            serviceName: 'ارائه طرح',
            serviceKey: 'k',
            status: 'in_review',
            currentStep: 'بررسی اولیه',
            submissionDate: null,
            createdAt: '2026-10-27T00:00:00Z',
          },
        ],
        total: 2,
        page: 1,
        totalPages: 1,
      }),
      '/activities?limit=4': feed,
      '/letters?read=false&limit=1': ok({ total: 7, items: [] }),
      '/profile/verification': ok({ status: 'pending' }),
    })
    await renderRole({ role: 'representative', userName: 'سمیرا کریمی' })

    expect(
      kpi().getByText(`${fa(1)} اصلاح، ${fa(1)} مدارک مالی، ${fa(0)} مدارک تکمیلی`),
    ).toBeTruthy()
    expect(kpi().getByText(fa(7))).toBeTruthy()
    expect(screen.getByRole('link', { name: 'ثبت درخواست جدید' }).getAttribute('href')).toBe(
      '/dashboard/new-request',
    )
    // Pending verification: the third step is the current one.
    expect(screen.getByText('احراز هویت').closest('li')?.getAttribute('aria-current')).toBe('step')
    const table = within(screen.getByRole('table'))
    expect(table.getByRole('link', { name: 'اصلاح' })).toBeTruthy()
    expect(table.getByRole('link', { name: 'مشاهده' })).toBeTruthy()
  })

  it('shows a dash and a notice for a failed read, never a zero', async () => {
    serve({ '/activities?limit=4': feed })
    await renderRole({ role: 'central-secretariat', userName: null })

    for (const label of ['احراز هویت در انتظار', 'تیکت‌های باز']) {
      expect(kpi().getByText(label).closest('[data-slot="card"]')?.textContent).toContain('—')
    }
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(screen.queryByRole('table')).toBeNull()
  })
})
