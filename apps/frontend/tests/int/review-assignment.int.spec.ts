// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReviewAssignmentPanel, type ReviewAssignmentPanelProps } from '@/components/dashboard/review-assignment-panel'
import type { EvaluationListDto, ReviewRoundDto, ReviewRoundSlotDto } from '@/utilities/dashboard-api'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}))

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const PEOPLE: Record<string, string> = {
  emp: 'کارفرما یکم',
  emp2: 'کارفرما دوم',
  r1: 'داور الف',
  r2: 'داور ب',
  r3: 'داور ج',
  r4: 'داور د',
  r5: 'داور ه',
  chief: 'سردبیر',
  owner: 'صاحب سیستم',
}

const CANDIDATES = {
  items: [
    { id: 'r1', name: 'داور الف' },
    { id: 'r2', name: 'داور ب' },
    { id: 'r3', name: 'داور ج' },
    { id: 'r4', name: 'داور د' },
  ],
  employerId: 'emp',
}

const slot = (userId: string, kind: 'employer' | 'ordinary', overrides: Partial<ReviewRoundSlotDto> = {}): ReviewRoundSlotDto => ({
  assignmentId: `a-${userId}`,
  userId,
  role: kind === 'employer' ? 'employer-reviewer' : 'reviewer',
  slot: kind,
  active: true,
  assignedAt: '2026-10-05T00:00:00.000Z',
  revokedAt: null,
  revokeReason: null,
  ...overrides,
})

const round = (overrides: Partial<ReviewRoundDto> = {}): ReviewRoundDto => ({
  id: 'round-1',
  requestRevision: 4,
  proposalRevision: 3,
  employerId: 'emp',
  startedAt: '2026-10-05T00:00:00.000Z',
  completion: { required: 4, finalized: 1, ready: false, completedAt: null },
  decision: null,
  slots: [slot('emp', 'employer'), slot('r1', 'ordinary'), slot('r2', 'ordinary'), slot('r3', 'ordinary')],
  replacements: [],
  ...overrides,
})

const evaluations = (items: EvaluationListDto['items']): EvaluationListDto => ({ items, completedCount: 0, requiredCount: 4 })

const panel = (props: Partial<ReviewAssignmentPanelProps> = {}) =>
  render(
    createElement(ReviewAssignmentPanel, {
      id: 'req-1',
      actions: ['read'],
      revision: 4,
      proposalRevision: 3,
      round: { round: null },
      evaluations: evaluations([]),
      people: PEOPLE,
      employerId: 'emp',
      ...props,
    }),
  )

const dialog = () => screen.getByRole('dialog')
const selects = () => within(dialog()).getAllByRole('combobox') as HTMLSelectElement[]
const pick = (select: HTMLSelectElement, value: string) => fireEvent.change(select, { target: { value } })
const confirm = (label: string) => fireEvent.click(within(dialog()).getByRole('button', { name: label }))

/** Answers GETs with the given candidate lists and POSTs with `post`. */
const api = (post: () => Response | Promise<Response>, candidates: unknown = CANDIDATES, employers: unknown = { items: [{ id: 'emp2', name: 'کارفرما دوم' }], employerId: 'emp' }) =>
  vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return post()
    if (url.endsWith('/employer-candidates')) return json(200, employers)
    return json(200, candidates)
  })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('four-reviewer assignment', () => {
  it('stays hidden for a reader without the round read or a start command', () => {
    const { container } = panel({ round: null })
    expect(container.firstChild).toBeNull()
  })

  it('shows the fixed employer, three distinct selectors and the proposal revision', async () => {
    vi.stubGlobal('fetch', api(() => json(201, { round: {} })))
    panel({ actions: ['read', 'startReview'] })

    fireEvent.click(screen.getByRole('button', { name: 'ارجاع به داوران' }))
    expect(within(dialog()).getByText('کارفرما یکم')).toBeTruthy()
    expect(within(dialog()).getByText(/نسخه پروپوزال مورد داوری: ۳/)).toBeTruthy()
    expect(within(dialog()).getByRole('status').textContent).toMatch(/در حال دریافت فهرست داوران/)

    await waitFor(() => expect(selects()).toHaveLength(3))
    expect(within(dialog()).getByText('۱/۴')).toBeTruthy()
    pick(selects()[0], 'r1')
    // A person picked in one slot is not offered in the others.
    const second = Array.from(selects()[1].options).map((option) => option.value)
    expect(second).not.toContain('r1')
    expect(within(dialog()).getByText('۲/۴')).toBeTruthy()
  })

  it('assigns the three reviewers with the expected revision and refreshes the case', async () => {
    const fetchMock = api(() => json(201, { round: {} }))
    vi.stubGlobal('fetch', fetchMock)
    panel({ actions: ['read', 'startReview'] })

    fireEvent.click(screen.getByRole('button', { name: 'ارجاع به داوران' }))
    await waitFor(() => expect(selects()).toHaveLength(3))
    pick(selects()[0], 'r1')
    pick(selects()[1], 'r2')
    pick(selects()[2], 'r3')
    expect(within(dialog()).getByText('۴/۴')).toBeTruthy()
    confirm('ارجاع')

    expect(await screen.findByText(/پرونده به چهار داور ارجاع شد/)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(refresh).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/review-round',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ reviewerIds: ['r1', 'r2', 'r3'], expectedRevision: 4 }) }),
    )
  })

  it('does not send an incomplete pick', async () => {
    const fetchMock = api(() => json(201, {}))
    vi.stubGlobal('fetch', fetchMock)
    panel({ actions: ['read', 'startReview'] })

    fireEvent.click(screen.getByRole('button', { name: 'ارجاع به داوران' }))
    await waitFor(() => expect(selects()).toHaveLength(3))
    pick(selects()[0], 'r1')
    confirm('ارجاع')
    expect(within(dialog()).getByText('سه داور را انتخاب کنید.')).toBeTruthy()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  })

  it.each([
    ['duplicate_people', 400, /یک نفر دو بار انتخاب شده است/],
    ['reviewer_not_eligible', 400, /دیگر فعال یا واجد شرایط نیست/],
    ['stale_revision', 409, /پس از باز شدن این صفحه تغییر کرده است/],
    ['round_already_started', 409, /قبلاً آغاز شده است/],
    ['forbidden', 403, /برای نقش شما مجاز نیست/],
    ['boom', 500, /اقدام انجام نشد/],
  ])('keeps the picks and explains a refused start (%s)', async (code, status, message) => {
    vi.stubGlobal('fetch', api(() => json(status, { error: code })))
    panel({ actions: ['read', 'startReview'] })

    fireEvent.click(screen.getByRole('button', { name: 'ارجاع به داوران' }))
    await waitFor(() => expect(selects()).toHaveLength(3))
    pick(selects()[0], 'r1')
    pick(selects()[1], 'r2')
    pick(selects()[2], 'r3')
    confirm('ارجاع')

    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(message)
    expect(selects()[0].value).toBe('r1')
    expect(refresh).toHaveBeenCalled()
  })

  it('explains too few eligible reviewers and a failed candidate read', async () => {
    vi.stubGlobal('fetch', api(() => json(201, {}), { items: [{ id: 'r1', name: 'داور الف' }], employerId: 'emp' }))
    panel({ actions: ['read', 'startReview'] })
    fireEvent.click(screen.getByRole('button', { name: 'ارجاع به داوران' }))
    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(/فقط ۱ داور فعال/)
    cleanup()

    vi.stubGlobal('fetch', vi.fn(async () => json(403, { error: 'forbidden' })))
    panel({ actions: ['read', 'startReview'] })
    fireEvent.click(screen.getByRole('button', { name: 'ارجاع به داوران' }))
    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(/دریافت فهرست داوران انجام نشد/)
  })
})

describe('round slots and progress', () => {
  it('lists the employer and three reviewers with their status and 1/4 progress', () => {
    panel({
      round: { round: round() },
      evaluations: evaluations([
        { id: 'e1', userId: 'r1', variant: 'ordinary', state: 'final', finalizedAt: '2026-10-06T00:00:00.000Z' },
        { id: 'e2', userId: 'r2', variant: 'ordinary', state: 'draft', finalizedAt: null },
      ]),
    })
    expect(screen.getByText('ارزیابی نهایی: ۱ از ۴')).toBeTruthy()
    expect(screen.getByText(/نسخه پرونده ۴ · نسخه پروپوزال ۳/)).toBeTruthy()
    const rows = screen.getAllByRole('listitem')
    expect(rows[0].textContent).toMatch(/کارفرما \(ثابت\).*کارفرما یکم.*در انتظار ارزیابی/)
    expect(rows[1].textContent).toMatch(/داور الف.*ارزیابی نهایی شد/)
    expect(rows[2].textContent).toMatch(/داور ب.*در حال ارزیابی/)
    expect(rows[3].textContent).toMatch(/داور ج.*در انتظار ارزیابی/)
    // Without a replace command nobody gets a control.
    expect(screen.queryByRole('button', { name: /جایگزینی/ })).toBeNull()
  })

  it.each([0, 2, 3, 4])('shows %i/4 from the server count', (finalized) => {
    panel({ round: { round: round({ completion: { required: 4, finalized, ready: finalized === 4, completedAt: null } }) } })
    expect(screen.getByText(`ارزیابی نهایی: ${finalized.toLocaleString('fa-IR')} از ۴`)).toBeTruthy()
  })

  it('offers replacement only for unfinished ordinary reviewers to the chief', () => {
    panel({
      actions: ['read', 'replaceReviewer'],
      round: { round: round() },
      evaluations: evaluations([{ id: 'e1', userId: 'r1', variant: 'ordinary', state: 'final', finalizedAt: '2026-10-06T00:00:00.000Z' }]),
    })
    const buttons = screen.getAllByRole('button', { name: /^جایگزینی داور/ })
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['جایگزینی داور: داور ب', 'جایگزینی داور: داور ج'])
    expect(screen.queryByRole('button', { name: /جایگزینی کارفرما/ })).toBeNull()
  })

  it('offers no replacement for a round of an earlier revision or unknown evaluation state', () => {
    panel({ actions: ['read', 'replaceReviewer'], round: { round: round({ requestRevision: 3 }) } })
    expect(screen.getByText(/این دور برای نسخه پیشین پرونده است/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /جایگزینی/ })).toBeNull()
    cleanup()

    panel({ actions: ['read', 'replaceReviewer'], round: { round: round() }, evaluations: 'failed' })
    expect(screen.getByText(/جایگزینی تا بارگذاری دوباره صفحه غیرفعال است/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /جایگزینی/ })).toBeNull()
  })

  it('keeps the replacement history with people, actor and reason', () => {
    panel({
      round: {
        round: round({
          slots: [
            slot('emp', 'employer'),
            slot('r4', 'ordinary', { active: false, revokedAt: '2026-10-07T00:00:00.000Z', revokeReason: 'replaced_reviewer' }),
            slot('r1', 'ordinary'),
            slot('r2', 'ordinary'),
            slot('r3', 'ordinary'),
          ],
          replacements: [
            { id: 'h1', slot: 'ordinary', oldUserId: 'r4', newUserId: 'r3', replacedBy: 'chief', reason: 'در دسترس نیست', replacedAt: '2026-10-07T00:00:00.000Z' },
          ],
        }),
      },
    })
    // The revoked holder is no longer listed as a slot.
    expect(screen.queryByText('داور د', { selector: 'p' })).toBeNull()
    const history = screen.getByRole('heading', { name: 'سابقه جایگزینی' }).parentElement as HTMLElement
    expect(history.textContent).toMatch(/داور: داور د ← داور ج/)
    expect(history.textContent).toMatch(/توسط سردبیر/)
    expect(history.textContent).toMatch(/دلیل: در دسترس نیست/)
  })

  it('reports a failed round read', () => {
    panel({ round: 'failed' })
    expect(screen.getByRole('alert').textContent).toMatch(/دریافت اطلاعات داوری انجام نشد/)
  })
})

describe('controlled replacement', () => {
  const chiefPanel = () =>
    panel({ actions: ['read', 'replaceReviewer'], round: { round: round() }, evaluations: evaluations([]) })

  it('replaces an unfinished reviewer with an optional reason and refreshes the slots', async () => {
    const fetchMock = api(() => json(200, { round: {} }), { items: [{ id: 'r5', name: 'داور ه' }], employerId: 'emp' })
    vi.stubGlobal('fetch', fetchMock)
    chiefPanel()

    fireEvent.click(screen.getByRole('button', { name: 'جایگزینی داور: داور ب' }))
    expect(dialog().textContent).toMatch(/دسترسی داور ب/)
    await waitFor(() => expect(selects()).toHaveLength(1))
    pick(selects()[0], 'r5')
    confirm('جایگزینی')

    expect(await screen.findByText(/داور جایگزین شد/)).toBeTruthy()
    expect(refresh).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/review-round/reviewers/r2/replace',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ replacementId: 'r5', expectedRevision: 4 }) }),
    )
  })

  it('requires a pick before sending', async () => {
    const fetchMock = api(() => json(200, {}), { items: [{ id: 'r5', name: 'داور ه' }], employerId: 'emp' })
    vi.stubGlobal('fetch', fetchMock)
    chiefPanel()
    fireEvent.click(screen.getByRole('button', { name: 'جایگزینی داور: داور ب' }))
    await waitFor(() => expect(selects()).toHaveLength(1))
    confirm('جایگزینی')
    expect(within(dialog()).getByText('جایگزین را انتخاب کنید.')).toBeTruthy()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  })

  it.each([
    ['evaluation_final', 409, /ارزیابی خود را نهایی کرده است/],
    ['already_assigned', 409, /در همین دور داوری جایگاه دارد/],
    ['previously_assigned', 409, /نمی‌تواند بازگردد/],
    ['stale_revision', 409, /پس از باز شدن این صفحه تغییر کرده است/],
    ['forbidden', 403, /برای نقش شما مجاز نیست/],
  ])('explains a refused replacement (%s) and keeps the typed reason', async (code, status, message) => {
    vi.stubGlobal('fetch', api(() => json(status, { error: code }), { items: [{ id: 'r5', name: 'داور ه' }], employerId: 'emp' }))
    chiefPanel()
    fireEvent.click(screen.getByRole('button', { name: 'جایگزینی داور: داور ب' }))
    await waitFor(() => expect(selects()).toHaveLength(1))
    pick(selects()[0], 'r5')
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'غیبت طولانی' } })
    confirm('جایگزینی')

    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(message)
    expect((within(dialog()).getByRole('textbox') as HTMLTextAreaElement).value).toBe('غیبت طولانی')
    expect(refresh).toHaveBeenCalled()
  })

  it('says when no eligible replacement remains', async () => {
    vi.stubGlobal('fetch', api(() => json(200, {}), { items: [], employerId: 'emp' }))
    chiefPanel()
    fireEvent.click(screen.getByRole('button', { name: 'جایگزینی داور: داور ب' }))
    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(/داور فعال دیگری/)
  })

  it('lets only the owner replace the employer, with a required reason', async () => {
    const fetchMock = api(() => json(200, { round: {} }))
    vi.stubGlobal('fetch', fetchMock)
    panel({
      actions: ['read', 'replaceEmployer'],
      round: { round: round() },
      evaluations: evaluations([{ id: 'e0', userId: 'emp', variant: 'employer', state: 'final', finalizedAt: '2026-10-06T00:00:00.000Z' }]),
    })
    // The owner has no ordinary-reviewer control, but may replace even a finished employer.
    expect(screen.queryByRole('button', { name: /جایگزینی داور/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'جایگزینی کارفرما: کارفرما یکم' }))
    expect(dialog().textContent).toMatch(/در این دور شمرده نمی‌شود/)
    await waitFor(() => expect(selects()).toHaveLength(1))
    pick(selects()[0], 'emp2')
    confirm('جایگزینی')
    expect(within(dialog()).getByText('نوشتن دلیل الزامی است.')).toBeTruthy()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)

    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: '  تعارض منافع  ' } })
    confirm('جایگزینی')
    expect(await screen.findByText(/کارفرمای پرونده جایگزین شد/)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/review-round/employer/replace',
      expect.objectContaining({ body: JSON.stringify({ employerId: 'emp2', reason: 'تعارض منافع', expectedRevision: 4 }) }),
    )
  })

  it('reports a dropped connection without closing the dialog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') throw new TypeError('network')
        return json(200, { items: [{ id: 'r5', name: 'داور ه' }], employerId: 'emp' })
      }),
    )
    chiefPanel()
    fireEvent.click(screen.getByRole('button', { name: 'جایگزینی داور: داور ب' }))
    await waitFor(() => expect(selects()).toHaveLength(1))
    pick(selects()[0], 'r5')
    confirm('جایگزینی')
    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(/ارتباط با سرور برقرار نشد/)
  })
})

describe('reviewer list with avatars and status chips (#288, Figma «لیست داوران»)', () => {
  const named = (userId: string, kind: 'employer' | 'ordinary', name: string | null, status: ReviewRoundSlotDto['status']) =>
    slot(userId, kind, { name, avatarUrl: null, viewedAt: null, status })

  it('names each slot with its own name, draws initials and the server status chip', () => {
    panel({
      actions: ['read'],
      // The account lookup knows nobody here: only the slots carry names.
      people: {},
      round: {
        round: round({
          slots: [
            named('emp', 'employer', 'کارفرما یکم', 'final'),
            named('r1', 'ordinary', 'داور الف', 'not_viewed'),
            named('r2', 'ordinary', 'علی رضایی', 'in_review'),
            named('r3', 'ordinary', null, 'not_viewed'),
          ],
        }),
      },
    })
    const rows = screen.getAllByTestId('review-slot')
    expect(rows).toHaveLength(4)
    expect(within(rows[0]!).getByText('کارفرما یکم')).toBeTruthy()
    expect(within(rows[0]!).getByTestId('review-slot-status').textContent).toBe('نهایی')
    expect(within(rows[1]!).getByTestId('review-slot-status').textContent).toBe('مشاهده نشده')
    expect(within(rows[2]!).getByTestId('review-slot-status').textContent).toBe('درحال بررسی')
    // First and last initial, joined with a ZWNJ as Persian initials are.
    expect(within(rows[2]!).getByTestId('person-avatar').textContent).toBe('ع‌ر')
    expect(within(rows[1]!).getByTestId('person-avatar').textContent).toBe('د‌ا')
    // A slot with no name falls back to its position, and draws no letters for it.
    expect(within(rows[3]!).getAllByText('داور ۳').length).toBeGreaterThan(0)
    expect(within(rows[3]!).getByTestId('person-avatar').textContent).toBe('?')
  })

  it('keeps the evaluation-derived chip when an older response has no slot status', () => {
    panel({
      round: { round: round() },
      evaluations: evaluations([{ id: 'e1', userId: 'r1', variant: 'ordinary', state: 'final', finalizedAt: '2026-10-06T00:00:00.000Z' }]),
    })
    const chips = screen.getAllByTestId('review-slot-status').map((chip) => chip.textContent)
    expect(chips).toContain('ارزیابی نهایی شد')
    expect(chips).toContain('در انتظار ارزیابی')
  })
})
