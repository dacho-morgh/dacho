// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AdminRequestList } from '@/components/dashboard/admin-request-list'
import { RequestActionsPanel } from '@/components/dashboard/request-actions-panel'
import { RequestDossier } from '@/components/dashboard/request-dossier'
import type { RequestAction, RequestDetail } from '@/utilities/dashboard-api'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/requests',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/documents/private-document-field', () => ({
  PrivateDocumentField: ({ category }: { category: string }) => createElement('div', null, category),
}))

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const panel = (actions: RequestAction[], revision = 4) =>
  render(createElement(RequestActionsPanel, { id: 'req-1', actions, revision }))

const dialog = () => screen.getByRole('dialog')
const open = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }))
const type = (value: string) => fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value } })
const confirm = (label: string) => fireEvent.click(within(dialog()).getByRole('button', { name: label }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('chief triage actions', () => {
  it('offers nothing when the server lists no triage, decision or reopen command', () => {
    const { container } = panel(['read', 'uploadDocument'])
    expect(container.firstChild).toBeNull()
  })

  it('accepts without a reason through the triage command, then rereads case and queue', async () => {
    const fetchMock = vi.fn(async () => json(200, { request: {} }))
    vi.stubGlobal('fetch', fetchMock)
    panel(['read', 'triage'])

    open('پذیرش و ارجاع به داوری')
    expect(within(dialog()).queryByRole('textbox')).toBeNull()
    confirm('پذیرش')

    expect((await screen.findByText(/برای داوری پذیرفته شد/)).closest('[role="status"]')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(refresh).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'بازگشت به صف درخواست‌ها' }).getAttribute('href')).toBe('/dashboard/requests')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/triage',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'accept', expectedRevision: 4 }) }),
    )
  })

  it('returns for correction only with a reason, sent trimmed', async () => {
    const fetchMock = vi.fn(async () => json(200, { request: {} }))
    vi.stubGlobal('fetch', fetchMock)
    panel(['read', 'triage'])

    open('درخواست اصلاحیه')
    expect(dialog().textContent).toMatch(/همان کد پیگیری برای اصلاح به شرکت برمی‌گردد/)
    confirm('ارسال')
    expect(within(dialog()).getByText('نوشتن دلیل الزامی است.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    type('  مدرک ثبت ناقص است  ')
    confirm('ارسال')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/triage',
      expect.objectContaining({ body: JSON.stringify({ action: 'return', reason: 'مدرک ثبت ناقص است', expectedRevision: 4 }) }),
    )
    expect(await screen.findByText(/درخواست اصلاحیه برای شرکت ثبت شد/)).toBeTruthy()
  })

  it('rejects with a distinct, final consequence and a required reason', async () => {
    const fetchMock = vi.fn(async () => json(200, { request: {} }))
    vi.stubGlobal('fetch', fetchMock)
    panel(['read', 'triage'])

    open('رد درخواست')
    expect(dialog().textContent).toMatch(/دیگر قادر به ثبت درخواست در عنوان انتخابی نخواهد بود/)
    expect(dialog().textContent).toMatch(/فقط صاحب سیستم می‌تواند آن را بازگشایی کند/)
    confirm('رد درخواست')
    expect(fetchMock).not.toHaveBeenCalled()

    type('خارج از موضوع رویداد')
    confirm('رد درخواست')
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/triage',
      expect.objectContaining({ body: JSON.stringify({ action: 'reject', reason: 'خارج از موضوع رویداد', expectedRevision: 4 }) }),
    )
  })

  it('shows the pending send and blocks a second one', async () => {
    let answer: (response: Response) => void = () => {}
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { answer = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    panel(['read', 'triage'])

    open('پذیرش و ارجاع به داوری')
    confirm('پذیرش')
    const pending = await within(dialog()).findByRole('button', { name: 'در حال ثبت…' })
    expect((pending as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(pending)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    answer(json(200, { request: {} }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps the typed reason and explains a stale submission', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(409, { error: 'stale_revision' })))
    panel(['read', 'triage'])

    open('درخواست اصلاحیه')
    type('دلیل من')
    confirm('ارسال')

    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(/نسخه تازه‌ای فرستاده است/)
    expect((within(dialog()).getByRole('textbox') as HTMLTextAreaElement).value).toBe('دلیل من')
    expect(refresh).toHaveBeenCalled()
  })

  it('explains a case that already left triage and stops offering the send', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(409, { error: 'invalid_triage_state' })))
    const view = panel(['read', 'triage'])
    open('رد درخواست')
    type('دلیل')
    confirm('رد درخواست')
    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(/دیگر در مرحله بررسی اولیه نیست/)

    // The refreshed case no longer lists triage: the dialog stays to explain, without a send.
    view.rerender(createElement(RequestActionsPanel, { id: 'req-1', actions: ['read'], revision: 5 }))
    expect(within(dialog()).getByText('این اقدام دیگر برای این پرونده فعال نیست.')).toBeTruthy()
    expect((within(dialog()).getByRole('button', { name: 'رد درخواست' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reports a denied command without claiming success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(403, { error: 'forbidden' })))
    panel(['read', 'triage'])
    open('پذیرش و ارجاع به داوری')
    confirm('پذیرش')
    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(/برای نقش شما مجاز نیست/)
    expect(screen.queryByText(/پذیرفته شد/)).toBeNull()
  })

  it('reports a dropped connection and a server error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    panel(['read', 'triage'])
    open('پذیرش و ارجاع به داوری')
    confirm('پذیرش')
    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(/ارتباط با سرور برقرار نشد/)

    vi.stubGlobal('fetch', vi.fn(async () => json(500, { error: 'internal' })))
    confirm('پذیرش')
    await waitFor(() => expect(within(dialog()).getByRole('alert').textContent).toMatch(/اقدام انجام نشد/))
  })

  it('closes on cancel without sending', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    panel(['read', 'triage'])
    open('رد درخواست')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'انصراف' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the review-decision command, not the triage one, after four evaluations', async () => {
    const fetchMock = vi.fn(async () => json(200, { request: {} }))
    vi.stubGlobal('fetch', fetchMock)
    panel(['read', 'decideReview'])
    open('رد درخواست')
    type('امتیاز ناکافی')
    confirm('رد درخواست')
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/review-decision',
      expect.objectContaining({ body: JSON.stringify({ action: 'reject', reason: 'امتیاز ناکافی', expectedRevision: 4 }) }),
    )
  })
})

describe('owner reopen', () => {
  it('appears only when the server lists reopen', () => {
    panel(['read', 'triage'])
    expect(screen.queryByRole('button', { name: 'بازگشایی پرونده' })).toBeNull()
    cleanup()
    panel(['read', 'reopen'])
    expect(screen.getByRole('button', { name: 'بازگشایی پرونده' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'رد درخواست' })).toBeNull()
  })

  it('requires a reason and uses the audited owner route', async () => {
    const fetchMock = vi.fn(async () => json(200, { request: {} }))
    vi.stubGlobal('fetch', fetchMock)
    panel(['read', 'reopen'])

    open('بازگشایی پرونده')
    expect(dialog().textContent).toMatch(/دلیل بازگشایی در تاریخچه پرونده ثبت می‌شود/)
    confirm('بازگشایی')
    expect(fetchMock).not.toHaveBeenCalled()
    type('خطای ثبت')
    confirm('بازگشایی')

    expect((await screen.findByText(/پرونده بازگشایی شد/)).closest('[role="status"]')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/admin/requests/req-1/reopen',
      expect.objectContaining({ body: JSON.stringify({ reason: 'خطای ثبت', expectedRevision: 4 }) }),
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('explains a case that is no longer rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(409, { error: 'invalid_reopen_state' })))
    panel(['read', 'reopen'])
    open('بازگشایی پرونده')
    type('دلیل')
    confirm('بازگشایی')
    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(/دیگر قابل بازگشایی نیست/)
  })
})

describe('chief intake snapshots', () => {
  const detail = (actions: RequestAction[]): RequestDetail => ({
    request: {
      id: 'req-1',
      trackingCode: 'EV-1',
      title: 'پرونده رویداد',
      serviceId: 's',
      serviceKey: 'events',
      serviceName: 'رویداد',
      ownerId: 'owner-1',
      status: 'in_review',
      reviewStage: 'chief_triage',
      revision: 4,
      currentStepIndex: 0,
      assignedRole: null,
      currentStep: null,
      answers: {},
      submissionDate: '2026-10-01T00:00:00.000Z',
      dueDate: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
      allowedActions: actions,
    },
    timeline: [],
    workflow: [],
    owner: { id: 'owner-1', name: 'شرکت نمونه' },
  })

  it('shows the submitted profile and proposal snapshot next to the triage actions', () => {
    render(
      createElement(RequestDossier, {
        role: 'chief-reviewer',
        detail: detail(['read', 'triage']),
        round: null,
        evaluations: null,
        proposal: {
          agreements: [],
          proposal: {
            requestId: 'req-1',
            revision: 2,
            formVersion: 'v1',
            applicationTeam: [],
            proposalDocuments: [
              { id: 'd1', filename: 'proposal-v2.pdf', mimeType: 'application/pdf', sizeBytes: 10, logicalVersion: 2, createdAt: '2026-10-01T00:00:00.000Z' },
            ],
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        },
        profile: {
          verification: {
            requestId: 'req-1',
            revision: 3,
            createdAt: '2026-10-01T00:00:00.000Z',
            snapshot: {
              company: { name: 'آریانا فناوران', nationalId: '10101010101', type: 'سهامی خاص' },
              dossier: { activityDomain: 'انرژی', productsServices: ['توربین', 'پمپ'] },
            },
          },
        },
      }),
    )
    expect(screen.getByRole('heading', { name: 'اطلاعات شرکت در زمان ثبت' })).toBeTruthy()
    expect(screen.getByText('آریانا فناوران')).toBeTruthy()
    expect(screen.getByText('10101010101')).toBeTruthy()
    expect(screen.getByText('توربین، پمپ')).toBeTruthy()
    expect(screen.getByText(/نسخه ۳ پروفایل تأییدشده/)).toBeTruthy()
    expect(screen.getByText(/فایل پروپوزال: proposal-v2.pdf/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'پذیرش و ارجاع به داوری' })).toBeTruthy()
  })

  it('tells a failed profile read apart from a case without one', () => {
    const base = { role: 'chief-reviewer' as const, detail: detail(['read']), round: null, evaluations: null, proposal: null }
    render(createElement(RequestDossier, { ...base, profile: 'failed' }))
    expect(screen.getByText(/دریافت پروفایل ثبت‌شده شرکت انجام نشد/)).toBeTruthy()
    cleanup()
    render(createElement(RequestDossier, { ...base, profile: { verification: null } }))
    expect(screen.getByText('پروفایلی همراه این درخواست ثبت نشده است.')).toBeTruthy()
  })
})

describe('chief intake queue', () => {
  it('shows each case stage and the step waiting on this person', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(200, {
          totalPages: 1,
          items: [
            { id: 'a', title: 'درخواست الف', status: 'in_review', reviewStage: 'chief_triage', allowedActions: ['read', 'triage'], createdAt: '2026-10-01T00:00:00.000Z', owner: { companyName: 'شرکت الف' } },
            { id: 'b', title: 'درخواست ب', status: 'rejected', reviewStage: 'chief_triage', allowedActions: ['read'], createdAt: '2026-10-01T00:00:00.000Z', owner: { companyName: 'شرکت ب' } },
          ],
        }),
      ),
    )
    type Props = NonNullable<Parameters<typeof AdminRequestList>[0]>
    const List = AdminRequestList as (props: Props) => ReturnType<typeof AdminRequestList>
    render(createElement(List, { filters: { queue: 'chief_triage' } }))
    expect(await screen.findByText('منتظر بررسی اولیه شما')).toBeTruthy()
    expect(screen.getAllByText('بررسی اولیه').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('منتظر بررسی اولیه شما')).toHaveLength(1)
  })
})
