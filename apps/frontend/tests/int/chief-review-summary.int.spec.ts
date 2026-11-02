// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChiefReviewSummary, type ChiefReviewSummaryProps } from '@/components/dashboard/chief-review-summary'
import { RequestActionsPanel } from '@/components/dashboard/request-actions-panel'
import type { EvaluationListDto, EvaluationSummaryDto, ReviewRoundDto } from '@/utilities/dashboard-api'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}))

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const PEOPLE = { emp: 'کارفرما یکم', r1: 'داور الف', r2: 'داور ب', r3: 'داور ج', chief: 'سردبیر پرونده' }

const final = (id: string, userId: string, variant: 'employer' | 'ordinary', weightedHundredths: number): EvaluationSummaryDto => ({
  id,
  userId,
  variant,
  state: 'final',
  scoreA: 50,
  scoreB: 40,
  scoreC: 30,
  weightedHundredths,
  finalizedAt: '2026-10-10T00:00:00.000Z',
})

const FOUR: EvaluationSummaryDto[] = [
  final('e-r1', 'r1', 'ordinary', 4800),
  final('e-emp', 'emp', 'employer', 5100),
  final('e-r2', 'r2', 'ordinary', 4975),
  final('e-r3', 'r3', 'ordinary', 5300),
]

const list = (items: EvaluationSummaryDto[], revision = 4): EvaluationListDto => ({
  items,
  completedCount: items.filter((item) => item.state === 'final').length,
  requiredCount: 4,
  revision,
})

const round = (overrides: Partial<ReviewRoundDto> = {}): ReviewRoundDto => ({
  id: 'round-2',
  requestRevision: 4,
  proposalRevision: 3,
  employerId: 'emp',
  startedAt: '2026-10-05T00:00:00.000Z',
  completion: { required: 4, finalized: 4, ready: true, completedAt: '2026-10-10T00:00:00.000Z' },
  decision: null,
  ...overrides,
})

const summary = (props: Partial<ChiefReviewSummaryProps> = {}) =>
  render(
    createElement(ChiefReviewSummary, {
      round: { round: round() },
      evaluations: list(FOUR),
      history: [],
      people: PEOPLE,
      canDecide: true,
      ...props,
    }),
  )

const section = () => screen.getByTestId('chief-review-summary')

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('chief four-review summary', () => {
  it('shows the four final evaluations with the server scores, employer first, and the 4/4 count', () => {
    summary()
    const cards = section().querySelectorAll('[data-evaluation]')
    expect(cards).toHaveLength(4)
    expect(cards[0]?.textContent).toContain('ارزیابی کارفرما · کارفرما یکم')
    expect(section().textContent).toContain('ارزیابی داور · داور الف')
    // Server values only: weighted hundredths as sent, section scores unchanged.
    expect(cards[0]?.textContent).toContain('۵۱٫۰۰')
    expect(cards[0]?.textContent).toContain('۵۰')
    expect(section().textContent).toContain('۴/۴')
    expect(section().querySelector('[data-readiness="ready"]')?.textContent).toMatch(/تصمیم خود را از بخش «اقدام شما»/)
    expect(section().textContent).toMatch(/امتیاز بالا پرونده را خودکار منتقل نمی‌کند/)
  })

  it('never lists draft evaluations and keeps advancement unavailable until 4/4', () => {
    summary({
      round: { round: round({ completion: { required: 4, finalized: 3, ready: false, completedAt: null } }) },
      evaluations: list([...FOUR.slice(0, 3), { id: 'e-d', userId: 'r3', variant: 'ordinary', state: 'draft', finalizedAt: null }]),
      canDecide: false,
    })
    expect(section().querySelectorAll('[data-evaluation]')).toHaveLength(3)
    expect(section().querySelector('[data-readiness="waiting"]')?.textContent).toMatch(/تا نهایی شدن هر چهار ارزیابی در دسترس نیست \(۳ از ۴/)
    expect(section().querySelector('[data-readiness="ready"]')).toBeNull()
  })

  it('rereads the authoritative state when the chief refreshes a waiting round', () => {
    summary({
      round: { round: round({ completion: { required: 4, finalized: 3, ready: false, completedAt: null } }) },
      evaluations: list(FOUR.slice(0, 3)),
      canDecide: false,
    })
    fireEvent.click(within(section()).getByRole('button', { name: 'به‌روزرسانی وضعیت' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('tells oversight without the command that the chief still has to decide', () => {
    summary({ canDecide: false })
    expect(section().querySelector('[data-readiness="ready"]')?.textContent).toMatch(/در انتظار تصمیم صریح سردبیر/)
  })

  it('shows a returned round as closed and earlier rounds as history that does not count', () => {
    summary({
      round: {
        round: round({
          decision: { action: 'return', decidedAt: '2026-10-12T00:00:00.000Z', reason: 'بودجه اصلاح شود', decidedBy: 'chief' },
        }),
      },
      history: [
        {
          round: round({
            id: 'round-1',
            requestRevision: 2,
            proposalRevision: 1,
            decision: { action: 'return', decidedAt: '2026-09-20T00:00:00.000Z', reason: 'نسخه نخست ناقص بود' },
          }),
          evaluations: list([final('old-emp', 'emp', 'employer', 3000)], 2),
        },
      ],
    })
    expect(section().textContent).toMatch(/امتیازهای آن در تاریخچه می‌ماند و در تصمیم بعدی شمرده نمی‌شود/)
    expect(section().textContent).toContain('تصمیم سردبیر: بازگشت برای اصلاح')
    expect(section().textContent).toContain('سردبیر پرونده')
    const history = screen.getByTestId('round-history')
    expect(history.textContent).toMatch(/در دور جاری شمرده نمی‌شود/)
    expect(history.textContent).toContain('دور نسخه ۲ پرونده')
    expect(history.textContent).toContain('نسخه نخست ناقص بود')
    expect(history.textContent).toContain('۳۰٫۰۰')
    // History cards stay apart from the current round's four.
    expect(within(history).getAllByText(/ارزیابی کارفرما/)).toHaveLength(1)
  })

  it('shows an empty state before any round, and distinct denied and failed states', () => {
    summary({ round: { round: null }, evaluations: list([]) })
    expect(section().textContent).toContain('هنوز دور داوری برای این پرونده آغاز نشده است.')
    cleanup()

    summary({ round: 'denied', evaluations: 'denied', history: 'denied' })
    expect(screen.getByRole('alert').textContent).toMatch(/دسترسی شما به ارزیابی‌های این پرونده مجاز نیست/)
    cleanup()

    summary({ evaluations: 'failed', history: 'failed' })
    const alerts = screen.getAllByRole('alert').map((node) => node.textContent)
    expect(alerts.some((text) => text?.includes('دریافت خلاصه ارزیابی‌ها انجام نشد.'))).toBe(true)
    expect(alerts.some((text) => text?.includes('دریافت دورهای پیشین داوری انجام نشد.'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    expect(refresh).toHaveBeenCalled()
  })
})

describe('explicit next-stage decision', () => {
  const panel = (revision = 4) => render(createElement(RequestActionsPanel, { id: 'req-1', actions: ['read', 'decideReview'], revision }))
  const dialog = () => screen.getByRole('dialog')
  const open = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }))
  const confirm = (label: string) => fireEvent.click(within(dialog()).getByRole('button', { name: label }))

  it('advances only after the chief explicitly confirms, sending the expected revision once', async () => {
    let answer: (response: Response) => void = () => {}
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { answer = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    panel()

    open('انتقال به مرحله مالی')
    expect(dialog().textContent).toMatch(/امتیازها پرونده را خودکار منتقل نمی‌کنند/)
    confirm('انتقال')
    expect(within(dialog()).getByText('برای ثبت این تصمیم، تأیید بالا را علامت بزنید.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(within(dialog()).getByRole('checkbox'))
    confirm('انتقال')
    // A second click while the decision is pending cannot send a duplicate transition.
    const pending = await within(dialog()).findByRole('button', { name: 'در حال ثبت…' })
    expect((pending as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(pending)
    answer(json(200, { request: {} }))
    expect(await screen.findByText(/پرونده به مرحله مالی منتقل شد/)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/review-decision',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'advance', expectedRevision: 4 }) }),
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('returns for correction only with a reason and explains that the scores stay historical', async () => {
    const fetchMock = vi.fn(async () => json(200, { request: {} }))
    vi.stubGlobal('fetch', fetchMock)
    panel()

    open('درخواست اصلاحیه')
    expect(dialog().textContent).toMatch(/امتیازهای این دور در تاریخچه می‌ماند و در تصمیم بعدی شمرده نمی‌شود/)
    expect(dialog().textContent).toMatch(/دور داوری تازه با چهار ارزیابی جدید لازم است/)
    confirm('ارسال')
    expect(within(dialog()).getByText('نوشتن دلیل الزامی است.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: '  جدول مالی کامل شود  ' } })
    confirm('ارسال')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/review-decision',
      expect.objectContaining({ body: JSON.stringify({ action: 'return', reason: 'جدول مالی کامل شود', expectedRevision: 4 }) }),
    )
  })

  it.each([
    ['stale_revision', 409, /پرونده پس از باز شدن این صفحه تغییر کرده است/],
    ['invalid_decision_state', 409, /دیگر در مرحله تصمیم سردبیر نیست/],
    ['round_not_ready', 409, /هنوز هر چهار ارزیابی نهایی نشده است/],
    ['forbidden', 403, /برای نقش شما مجاز نیست/],
  ])('keeps the dialog on %s, rereads the case and does not resend', async (error, status, message) => {
    const fetchMock = vi.fn(async () => json(status, { error }))
    vi.stubGlobal('fetch', fetchMock)
    panel()

    open('رد درخواست')
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'امتیاز ناکافی' } })
    confirm('رد درخواست')
    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(message)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    // What the chief typed is kept for a deliberate retry.
    expect((within(dialog()).getByRole('textbox') as HTMLTextAreaElement).value).toBe('امتیاز ناکافی')
  })

  it('explains instead of sending when the refreshed case no longer offers the decision', async () => {
    const fetchMock = vi.fn(async () => json(409, { error: 'stale_revision' }))
    vi.stubGlobal('fetch', fetchMock)
    const view = panel()

    open('رد درخواست')
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'امتیاز ناکافی' } })
    confirm('رد درخواست')
    await within(dialog()).findByRole('alert')

    // The authoritative reread shows another decision already moved the case on.
    view.rerender(createElement(RequestActionsPanel, { id: 'req-1', actions: ['read'], revision: 5 }))
    expect(within(dialog()).getByText('این اقدام دیگر برای این پرونده فعال نیست.')).toBeTruthy()
    expect((within(dialog()).getByRole('button', { name: 'رد درخواست' }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a network failure without closing the dialog', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    panel()
    open('رد درخواست')
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'دلیل' } })
    confirm('رد درخواست')
    expect(await within(dialog()).findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
