// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReviewerCaseFile, type ReviewerCaseInitial } from '@/components/dashboard/reviewer/reviewer-case-file'
import { ReviewerQueue } from '@/components/dashboard/reviewer/reviewer-queue'
import {
  caseFileChanged,
  isReviewerRole,
  ownEvaluationLabel,
  parseReviewQueuePage,
  parseReviewQueueView,
  reviewQueueHref,
  reviewWorkState,
  type ReviewCaseFileDto,
  type ReviewQueueDto,
  type ReviewQueueItemDto,
} from '@/utilities/reviewer-case'

const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: nav.push, replace: vi.fn() }),
  usePathname: () => '/dashboard/requests',
  useSearchParams: () => new URLSearchParams(),
}))

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const item = (overrides: Partial<ReviewQueueItemDto> = {}): ReviewQueueItemDto => ({
  requestId: '11111111-1111-4111-8111-111111111111',
  trackingCode: 'EV-1405-0001',
  title: 'پلتفرم پایش انرژی',
  revision: 2,
  status: 'in_review',
  reviewStage: 'triaged',
  submissionDate: '2026-10-01T00:00:00.000Z',
  event: { id: 'ev-1', title: 'رویداد انرژی' },
  subtopic: { id: 'sub-1', title: 'بهره‌وری' },
  companyName: 'شرکت نمونه',
  assignment: { role: 'reviewer', slot: 'ordinary', assignedAt: '2026-10-05T00:00:00.000Z' },
  round: { id: 'round-1', requestRevision: 2, proposalRevision: 1, current: true },
  proposalRevision: 1,
  actionable: true,
  evaluation: null,
  ...overrides,
})

const queue = (items: ReviewQueueItemDto[], counts = { open: items.length, closed: 0, all: items.length }): ReviewQueueDto => ({
  items,
  total: items.length,
  page: 1,
  totalPages: 1,
  counts,
})

const caseFile = (overrides: Partial<ReviewCaseFileDto> = {}): ReviewCaseFileDto => ({
  case: item(),
  proposal: {
    revision: 1,
    formVersion: 'v1',
    applicationTeam: [{ name: 'مریم احمدی', role: 'مدیر فنی' }],
    answers: { summary: 'خلاصه طرح' },
    documents: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        filename: 'proposal.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        downloadUrl: '/api/dashboard/documents/22222222-2222-4222-8222-222222222222/download',
      },
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  rfp: { versionId: 'rfp-1', files: [{ id: 'f1', filename: 'rfp.pdf', mimeType: 'application/pdf', sizeBytes: 4096 }] },
  company: {
    company: { name: 'شرکت نمونه', nationalId: '10100578556', type: 'سهامی خاص', province: 'بوشهر', city: 'بوشهر' },
    dossier: { legalEntityType: 'خصوصی', classification: 'دانش‌بنیان', activityDomain: 'انرژی', productsServices: 'نرم‌افزار' },
  },
  ...overrides,
})

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const focusWindow = async () => {
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
  })
}

describe('reviewer case helpers', () => {
  it('recognizes only the two reviewing roles', () => {
    expect(isReviewerRole('reviewer')).toBe(true)
    expect(isReviewerRole('employer-reviewer')).toBe(true)
    for (const role of ['chief-reviewer', 'investment-reviewer', 'system-owner', 'central-secretariat', 'representative', null]) {
      expect(isReviewerRole(role)).toBe(false)
    }
  })

  it('parses the queue view and page from the URL, defaulting to open work', () => {
    expect(parseReviewQueueView(undefined)).toBe('open')
    expect(parseReviewQueueView('closed')).toBe('closed')
    expect(parseReviewQueueView(['all'])).toBe('all')
    expect(parseReviewQueueView('everyone')).toBe('open')
    expect(parseReviewQueuePage('3')).toBe(3)
    expect(parseReviewQueuePage('-1')).toBe(1)
    expect(parseReviewQueuePage('x')).toBe(1)
    expect(reviewQueueHref('open')).toBe('/dashboard/requests')
    expect(reviewQueueHref('closed', 2)).toBe('/dashboard/requests?view=closed&page=2')
  })

  it('labels the work state from the server flags', () => {
    expect(reviewWorkState(item())).toBe('open')
    expect(reviewWorkState(item({ actionable: false, round: { id: 'r', requestRevision: 1, proposalRevision: 1, current: false } }))).toBe('superseded')
    expect(reviewWorkState(item({ actionable: false }))).toBe('closed')
  })

  it('describes only the caller’s own evaluation state, never a score', () => {
    expect(ownEvaluationLabel(null)).toBe('شروع نشده')
    expect(ownEvaluationLabel({ state: 'draft', revision: 2, updatedAt: '', finalizedAt: null })).toBe('پیش‌نویس ذخیره شده')
    expect(ownEvaluationLabel({ state: 'final', revision: 2, updatedAt: '', finalizedAt: '' })).toBe('ارزیابی نهایی شده')
  })

  it('detects a case that moved to another round or revision', () => {
    const base = caseFile()
    expect(caseFileChanged(base, caseFile())).toBe(false)
    expect(caseFileChanged(base, caseFile({ case: item({ round: { id: 'round-2', requestRevision: 3, proposalRevision: 2, current: true } }) }))).toBe(true)
    expect(caseFileChanged(base, caseFile({ case: item({ revision: 3 }) }))).toBe(true)
    expect(caseFileChanged(base, caseFile({ case: item({ actionable: false }) }))).toBe(true)
  })
})

describe('ReviewerQueue', () => {
  it('reads only the server assignment queue for the chosen view', async () => {
    fetchMock.mockResolvedValue(json(200, queue([item()], { open: 1, closed: 2, all: 3 })))
    render(createElement(ReviewerQueue, { view: 'open', page: 1 }))

    expect(screen.getByRole('status')).toBeTruthy()
    await screen.findAllByText('پلتفرم پایش انرژی')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/dashboard/review/queue?view=open&page=1&limit=25')
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(links).toContain('/dashboard/requests/11111111-1111-4111-8111-111111111111')
    // No generic request listing is read for this role.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/admin/requests'))).toBe(false)
    // Counts come from the server, over every active assignment of the caller; they sit in the shared filter (FE35).
    fireEvent.click(screen.getByRole('button', { name: 'فیلتر پرونده‌های داوری' }))
    const views = await screen.findByRole('combobox', { name: 'نمای صف' })
    expect(within(views).getByRole('option', { name: /بسته‌شده/ }).textContent).toContain('۲')
    expect(within(views).getByRole('option', { name: /همه/ }).textContent).toContain('۳')
  })

  it('opens the case from the whole row, with one direct action instead of a menu', async () => {
    fetchMock.mockResolvedValue(json(200, queue([item()])))
    render(createElement(ReviewerQueue, { view: 'open', page: 1 }))
    await screen.findAllByText('پلتفرم پایش انرژی')

    const row = screen.getAllByRole('row').find((candidate) => candidate.getAttribute('data-row-link') !== null)!
    // Not started yet: «ارزیابی»; a lone action is shown, never hidden in a «more» menu.
    expect(within(row).getByRole('link', { name: 'ارزیابی' }).getAttribute('href')).toBe(
      '/dashboard/requests/11111111-1111-4111-8111-111111111111',
    )
    expect(within(row).queryByRole('button', { name: 'عملیات' })).toBeNull()
    expect(row.className).toContain('hover:bg-neutral-50')

    fireEvent.click(within(row).getByText('EV-1405-0001'))
    expect(nav.push).toHaveBeenCalledWith('/dashboard/requests/11111111-1111-4111-8111-111111111111')
    nav.push.mockClear()
    fireEvent.click(within(row).getByRole('link', { name: 'ارزیابی' }))
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('names the single action after the state of the reader’s own evaluation', async () => {
    const draft = { state: 'draft' as const, revision: 2, updatedAt: '', finalizedAt: null }
    const final = { state: 'final' as const, revision: 2, updatedAt: '', finalizedAt: '' }
    fetchMock.mockResolvedValue(
      json(200, queue([
        item({ requestId: 'a1111111-1111-4111-8111-111111111111', title: 'طرح الف', evaluation: draft }),
        item({ requestId: 'b1111111-1111-4111-8111-111111111111', title: 'طرح ب', evaluation: final }),
        item({ requestId: 'c1111111-1111-4111-8111-111111111111', title: 'طرح ج', actionable: false, round: null }),
      ])),
    )
    render(createElement(ReviewerQueue, { view: 'all', page: 1 }))
    await screen.findAllByText('طرح الف')
    const labels = screen.getAllByRole('row').flatMap((row) =>
      row.getAttribute('data-row-link') === null ? [] : [within(row).getByRole('link', { name: /^(ارزیابی|ادامه|مشاهده)$/ }).textContent],
    )
    expect(labels).toEqual(['ادامه', 'مشاهده', 'مشاهده'])
  })

  it('searches the cases on the page from the toolbar, on the right of the filter', async () => {
    fetchMock.mockResolvedValue(
      json(200, queue([item(), item({ requestId: '33333333-3333-4333-8333-333333333333', title: 'طرح دوم', companyName: 'شرکت دوم' })])),
    )
    const { container } = render(createElement(ReviewerQueue, { view: 'open', page: 1 }))
    await screen.findAllByText('پلتفرم پایش انرژی')

    // Search and the filter button share the toolbar's first group (the RTL right), search first.
    const group = container.querySelector('[data-slot="list-toolbar"]')!.firstElementChild!
    expect(group.firstElementChild!.getAttribute('role')).toBe('search')
    expect(group.querySelector('button[aria-label^="فیلتر پرونده‌های داوری"]')).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجو در پرونده‌های این صفحه' }), { target: { value: 'دوم' } })
    expect(screen.queryAllByText('پلتفرم پایش انرژی')).toHaveLength(0)
    expect(screen.getAllByText('طرح دوم').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجو در پرونده‌های این صفحه' }), { target: { value: 'ناموجود' } })
    expect(screen.getByText('پرونده‌ای با این جستجو در این صفحه پیدا نشد.')).toBeTruthy()
  })

  it('shows only the cases the server returned and never other people’s scores', async () => {
    fetchMock.mockResolvedValue(
      json(200, queue([item({ evaluation: { state: 'draft', revision: 2, updatedAt: '2026-10-06T00:00:00.000Z', finalizedAt: null } })])),
    )
    render(createElement(ReviewerQueue, { view: 'open', page: 1 }))
    await screen.findAllByText('پلتفرم پایش انرژی')
    expect(screen.getAllByText(/پیش‌نویس ذخیره شده/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/امتیاز/)
  })

  it('shows an empty state only for a successful empty read', async () => {
    fetchMock.mockResolvedValue(json(200, queue([])))
    render(createElement(ReviewerQueue, { view: 'open', page: 1 }))
    expect(await screen.findByText('پرونده‌ای در انتظار ارزیابی شما نیست.')).toBeTruthy()
  })

  it('distinguishes denied, expired and failed reads from an empty queue', async () => {
    fetchMock.mockResolvedValueOnce(json(403, { error: 'forbidden' }))
    render(createElement(ReviewerQueue, { view: 'open', page: 1 }))
    expect(await screen.findByText('دسترسی به صف داوری مجاز نیست')).toBeTruthy()
    cleanup()

    fetchMock.mockResolvedValueOnce(json(401, { error: 'unauthorized' }))
    render(createElement(ReviewerQueue, { view: 'closed', page: 1 }))
    expect(await screen.findByText('نشست شما پایان یافته است')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'ورود دوباره' }).getAttribute('href')).toContain('expired')
    cleanup()

    fetchMock.mockResolvedValueOnce(json(500, { error: 'boom' }))
    fetchMock.mockResolvedValueOnce(json(200, queue([item()])))
    render(createElement(ReviewerQueue, { view: 'open', page: 1 }))
    expect(await screen.findByText('دریافت پرونده‌ها انجام نشد')).toBeTruthy()
    expect(screen.queryByText('پرونده‌ای در انتظار ارزیابی شما نیست.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    await screen.findAllByText('پلتفرم پایش انرژی')
  })

  it('drops a case whose assignment ended while the page was open', async () => {
    const other = item({ requestId: '33333333-3333-4333-8333-333333333333', title: 'طرح دوم' })
    fetchMock.mockResolvedValueOnce(json(200, queue([item(), other])))
    render(createElement(ReviewerQueue, { view: 'open', page: 1 }))
    await screen.findAllByText('پلتفرم پایش انرژی')

    fetchMock.mockResolvedValueOnce(json(200, queue([other])))
    await focusWindow()
    await waitFor(() => expect(screen.queryAllByText('پلتفرم پایش انرژی')).toHaveLength(0))
    expect(screen.getAllByText('طرح دوم').length).toBeGreaterThan(0)
  })

  it('clears the rows when the role is withdrawn during a background refresh', async () => {
    fetchMock.mockResolvedValueOnce(json(200, queue([item()])))
    render(createElement(ReviewerQueue, { view: 'open', page: 1 }))
    await screen.findAllByText('پلتفرم پایش انرژی')

    fetchMock.mockResolvedValueOnce(json(403, { error: 'forbidden' }))
    await focusWindow()
    expect(await screen.findByText('دسترسی به صف داوری مجاز نیست')).toBeTruthy()
    expect(screen.queryAllByText('پلتفرم پایش انرژی')).toHaveLength(0)
  })

  it('keeps the last authorized rows when only the network fails in the background', async () => {
    fetchMock.mockResolvedValueOnce(json(200, queue([item()])))
    render(createElement(ReviewerQueue, { view: 'open', page: 1 }))
    await screen.findAllByText('پلتفرم پایش انرژی')
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await focusWindow()
    expect(screen.getAllByText('پلتفرم پایش انرژی').length).toBeGreaterThan(0)
  })
})

const renderCase = (initial: ReviewerCaseInitial) =>
  render(createElement(ReviewerCaseFile, { requestId: '11111111-1111-4111-8111-111111111111', initial }))

describe('ReviewerCaseFile', () => {
  it('shows the necessary company profile, the reviewed proposal, the RFP and the reader’s own evaluation', () => {
    renderCase({ kind: 'ok', data: caseFile() })
    expect(screen.getByRole('heading', { name: 'پلتفرم پایش انرژی' })).toBeTruthy()
    expect(screen.getByText('10100578556')).toBeTruthy()
    expect(screen.getByText('دانش‌بنیان')).toBeTruthy()
    expect(screen.getByText('خلاصه طرح')).toBeTruthy()
    expect(screen.getByText(/مریم احمدی/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'دانلود proposal.pdf' })).toBeTruthy()
    expect(screen.getByText('rfp.pdf')).toBeTruthy()
    expect(screen.getByText('شروع نشده')).toBeTruthy()
    expect(screen.getByText('داور')).toBeTruthy()
  })

  it('never renders fields outside the necessary projection, other evaluations or financial files', () => {
    const data = caseFile()
    // Even if a response carried more, only the fixed profile fields are rendered.
    ;(data.company!.company as Record<string, unknown>).ownerPhone = '09120000000'
    ;(data as unknown as Record<string, unknown>).evaluations = [{ weightedHundredths: 4700 }]
    renderCase({ kind: 'ok', data })
    const text = document.body.textContent ?? ''
    expect(text).not.toContain('09120000000')
    expect(text).not.toMatch(/امتیاز/)
    expect(text).not.toMatch(/صورت‌های مالی|مدارک مالی|بسته مالی/)
    expect(text).not.toContain('مشاهده پروفایل شرکت')
  })

  it('labels the employer role from the assignment', () => {
    renderCase({ kind: 'ok', data: caseFile({ case: item({ assignment: { role: 'employer-reviewer', slot: 'employer', assignedAt: '2026-10-05T00:00:00.000Z' } }) }) })
    expect(screen.getByText('کارفرما')).toBeTruthy()
  })

  it('marks a superseded round as read-only history of what was reviewed', () => {
    renderCase({
      kind: 'ok',
      data: caseFile({ case: item({ actionable: false, round: { id: 'round-1', requestRevision: 1, proposalRevision: 1, current: false } }) }),
    })
    expect(screen.getAllByText(/نسخه جدیدتری از پرونده ثبت شده است/).length).toBeGreaterThan(0)
  })

  it('shows a clear denied state for an unassigned, foreign-event or guessed id', () => {
    renderCase({ kind: 'not-assigned' })
    expect(screen.getByRole('heading', { name: 'این پرونده به شما ارجاع نشده است' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'پرونده‌های من' }).getAttribute('href')).toBe('/dashboard/requests')
  })

  it('distinguishes a role denial, an expired session and a failed read', () => {
    renderCase({ kind: 'denied' })
    expect(screen.getByText('دسترسی به پرونده‌های داوری مجاز نیست')).toBeTruthy()
    cleanup()
    renderCase({ kind: 'expired' })
    expect(screen.getByRole('link', { name: 'ورود دوباره' }).getAttribute('href')).toContain('expired')
    cleanup()
    renderCase({ kind: 'error' })
    expect(screen.getByText('دریافت پرونده انجام نشد')).toBeTruthy()
  })

  it('removes the case from the page when access is revoked while it is open', async () => {
    renderCase({ kind: 'ok', data: caseFile() })
    expect(screen.getByText('10100578556')).toBeTruthy()

    fetchMock.mockResolvedValueOnce(json(404, { error: 'not_found' }))
    await focusWindow()
    expect(await screen.findByText('دسترسی شما به این پرونده پایان یافته است')).toBeTruthy()
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/dashboard/review/cases/11111111-1111-4111-8111-111111111111')
    const text = document.body.textContent ?? ''
    expect(text).not.toContain('10100578556')
    expect(text).not.toContain('proposal.pdf')
    expect(text).not.toContain('خلاصه طرح')
  })

  it('removes the case when the session or role ends while it is open', async () => {
    renderCase({ kind: 'ok', data: caseFile() })
    fetchMock.mockResolvedValueOnce(json(403, { error: 'forbidden' }))
    await focusWindow()
    expect(await screen.findByText('دسترسی به پرونده‌های داوری مجاز نیست')).toBeTruthy()
    expect(document.body.textContent).not.toContain('10100578556')
    cleanup()

    renderCase({ kind: 'ok', data: caseFile() })
    fetchMock.mockResolvedValueOnce(json(401, { error: 'unauthorized' }))
    await focusWindow()
    expect(await screen.findByText('نشست شما پایان یافته است')).toBeTruthy()
    expect(document.body.textContent).not.toContain('10100578556')
  })

  it('replaces stale data and says so when the case moved to a new round', async () => {
    renderCase({ kind: 'ok', data: caseFile() })
    const next = caseFile({
      case: item({ revision: 3, round: { id: 'round-2', requestRevision: 3, proposalRevision: 2, current: true }, proposalRevision: 2 }),
      proposal: { ...caseFile().proposal!, revision: 2, answers: { summary: 'خلاصه اصلاح‌شده' } },
    })
    fetchMock.mockResolvedValueOnce(json(200, next))
    await focusWindow()
    expect(await screen.findByText(/این پرونده پس از باز شدن صفحه تغییر کرده است/)).toBeTruthy()
    expect(screen.getByText('خلاصه اصلاح‌شده')).toBeTruthy()
    expect(screen.queryByText('خلاصه طرح')).toBeNull()
  })

  it('warns, without claiming revocation, when the access check itself fails', async () => {
    renderCase({ kind: 'ok', data: caseFile() })
    fetchMock.mockResolvedValueOnce(json(502, { error: 'bad_gateway' }))
    await focusWindow()
    expect(await screen.findByText(/بررسی دوباره دسترسی انجام نشد/)).toBeTruthy()
    expect(screen.queryByText('دسترسی شما به این پرونده پایان یافته است')).toBeNull()
  })

  it('stays quiet when a refresh finds the same case', async () => {
    renderCase({ kind: 'ok', data: caseFile() })
    fetchMock.mockResolvedValueOnce(json(200, caseFile()))
    await focusWindow()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/تغییر کرده است/)).toBeNull()
  })
})
