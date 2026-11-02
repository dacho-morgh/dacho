// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReviewEvaluationForm } from '@/components/dashboard/reviewer/review-evaluation-form'
import { ReviewerCaseFile } from '@/components/dashboard/reviewer/reviewer-case-file'
import {
  EMPLOYER_RISK_GROUPS,
  emptyFormValues,
  evaluationPayload,
  formatHundredths,
  formValuesFromEvaluation,
  missingForFinal,
  ORDINARY_QUESTIONS,
  serverErrorText,
  type EvaluationDto,
  type OwnEvaluationResponse,
} from '@/utilities/review-evaluation'
import type { ReviewCaseFileDto, ReviewQueueItemDto } from '@/utilities/reviewer-case'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/requests/x/evaluation',
  useSearchParams: () => new URLSearchParams(),
}))

const REQUEST_ID = '11111111-1111-4111-8111-111111111111'
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const caseItem = (overrides: Partial<ReviewQueueItemDto> = {}): ReviewQueueItemDto => ({
  requestId: REQUEST_ID,
  trackingCode: 'EV-1405-0001',
  title: 'پلتفرم پایش انرژی',
  revision: 2,
  status: 'in_review',
  reviewStage: 'triaged',
  submissionDate: '2026-10-01T00:00:00.000Z',
  event: { id: 'ev-1', title: 'رویداد انرژی' },
  subtopic: null,
  companyName: 'شرکت نمونه',
  assignment: { role: 'reviewer', slot: 'ordinary', assignedAt: '2026-10-05T00:00:00.000Z' },
  round: { id: 'round-1', requestRevision: 2, proposalRevision: 1, current: true },
  proposalRevision: 1,
  actionable: true,
  evaluation: null,
  ...overrides,
})

const completeScores = {
  a: {
    technologyLevel: { tier: 'mid', score: 5 },
    interdisciplinary: 6,
    innovation: { articles: true, domesticPatentCount: 2, international: false },
    customization: 4,
    developmentMethod: { tier: 'improvement', score: 5 },
    environment: { tier: 'medium', score: 4 },
  },
  b: {
    developmentStage: { tier: 'pilot', score: 5 },
    addedValue: 7,
    marketReach: { tier: 'national_other_industries', score: 8 },
    futureOilGasDemand: 6,
    importSubstitution: 5,
  },
  c: {
    technicalReportQuality: { tier: 'medium', score: 5 },
    scientificAuthorityEndorsement: 5,
    nationalStandard: 0,
    isoProductQuality: 10,
    salesContracts: 3,
  },
}

const completeOrdinaryAnswers = {
  ...Object.fromEntries(ORDINARY_QUESTIONS.map((question, index) => [question.key, index % 2 ? 'no' : 'yes'])),
  recommendation: 'recommend',
  topFive: { answer: 'no', rationale: 'بازار هدف محدود است.' },
}

const evaluation = (overrides: Partial<EvaluationDto> = {}): EvaluationDto => ({
  id: 'eval-1',
  requestId: REQUEST_ID,
  role: 'reviewer',
  variant: 'ordinary',
  state: 'draft',
  revision: 2,
  scores: completeScores,
  scoreA: 34,
  scoreB: 31,
  scoreC: 23,
  weightedHundredths: 3115,
  answers: completeOrdinaryAnswers,
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
  finalizedAt: null,
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

const renderForm = (initial: OwnEvaluationResponse = { evaluation: null, revision: 2 }, item = caseItem()) =>
  render(createElement(ReviewEvaluationForm, { requestId: REQUEST_ID, caseItem: item, initial }))

const click = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}
const goToSummary = () => click(/جمع‌بندی/)
const lastBody = () => JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)) as Record<string, unknown>

describe('review evaluation helpers', () => {
  it('sends only started rows in a draft, as numbers, with the reviewed revision', () => {
    const values = emptyFormValues()
    values.scores.a.interdisciplinary = { score: '۷' }
    values.scores.a.technologyLevel = { tier: 'high' }
    values.scores.c.nationalStandard = { score: '10' }
    values.questions.technicalApproachClear = 'no'
    values.comments['a.interdisciplinary'] = 'توضیح'
    expect(evaluationPayload(values, 'ordinary', 4)).toEqual({
      revision: 4,
      scores: { a: { interdisciplinary: 7, technologyLevel: { tier: 'high', score: '' } }, c: { nationalStandard: 10 } },
      answers: { technicalApproachClear: 'no', comments: { 'a.interdisciplinary': 'توضیح' } },
    })
  })

  it('never sends client-side totals for the server to trust', () => {
    const body = evaluationPayload(formValuesFromEvaluation(evaluation()), 'ordinary', 2)
    expect(body).not.toHaveProperty('calculatedScores')
    expect(JSON.stringify(body)).not.toContain('weightedHundredths')
  })

  it('round-trips a persisted evaluation into the form unchanged', () => {
    const body = evaluationPayload(formValuesFromEvaluation(evaluation()), 'ordinary', 2)
    expect(body.scores).toEqual(completeScores)
    expect(body.answers).toEqual(completeOrdinaryAnswers)
  })

  it('lists every required entry that is still empty, accepting «no» as an answer', () => {
    expect(missingForFinal(formValuesFromEvaluation(evaluation()), 'ordinary')).toEqual([])
    const empty = missingForFinal(emptyFormValues(), 'ordinary')
    expect(empty).toContain('scores.a.technologyLevel')
    expect(empty).toContain('answers.technicalApproachClear')
    expect(empty).toContain('answers.topFive.rationale')
    const employer = missingForFinal(emptyFormValues(), 'employer')
    const riskCount = EMPLOYER_RISK_GROUPS.reduce((sum, group) => sum + group.items.length, 0)
    expect(employer.filter((path) => path.startsWith('answers.risk.'))).toHaveLength(riskCount)
    expect(employer).not.toContain('answers.technicalApproachClear')
  })

  it('formats exact server hundredths and translates server messages', () => {
    expect(formatHundredths(5505)).toBe('۵۵٫۰۵')
    expect(formatHundredths(3100)).toBe('۳۱٫۰۰')
    expect(serverErrorText('Expected integer from 0 to 9.')).toBe('یک عدد صحیح از ۰ تا ۹ وارد کنید.')
    expect(serverErrorText('Score does not match selected tier.')).toBe('امتیاز با سطح انتخاب‌شده هم‌خوانی ندارد.')
    expect(serverErrorText('Something new.')).toBe('سرور این مقدار را نپذیرفت.')
  })
})

describe('ReviewEvaluationForm', () => {
  it('renders the fixed ordinary form with its ranges and the rubric source', () => {
    renderForm()
    expect(screen.getByRole('heading', { name: 'فرم داوری' })).toBeTruthy()
    expect(screen.getByText(/فرم ثابت داوری/)).toBeTruthy()
    expect(screen.getByText(/سطح فناوری محصول/)).toBeTruthy()
    expect(screen.getByText('پایین (۰–۳)')).toBeTruthy()
    expect(screen.getByText(/مقاله دارد \(۲ امتیاز/)).toBeTruthy()
  })

  it('saves a draft with the revision, shows the persisted state and server score', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('امتیاز: میزان بین رشته‌ای بودن محصول'), { target: { value: '7' } })
    fetchMock.mockResolvedValueOnce(json(200, { evaluation: evaluation({ scores: { a: { interdisciplinary: 7 } }, answers: {}, scoreA: 7, scoreB: 0, scoreC: 0, weightedHundredths: 315 }) }))
    await click('ذخیره پیش‌نویس')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe(`/api/dashboard/requests/${REQUEST_ID}/evaluation`)
    expect(init?.method).toBe('PUT')
    expect(lastBody()).toEqual({ revision: 2, scores: { a: { interdisciplinary: 7 } }, answers: {} })
    expect(await screen.findByText(/پیش‌نویس ذخیره شد/)).toBeTruthy()

    await goToSummary()
    expect(screen.getByText('۳٫۱۵ از ۵۵٫۰۵')).toBeTruthy()
    expect(screen.getByText('۷ از ۶۴')).toBeTruthy()
  })

  it('reopens a saved draft with its values', () => {
    renderForm({ evaluation: evaluation(), revision: 2 })
    expect((screen.getByLabelText('امتیاز: میزان بین رشته‌ای بودن محصول') as HTMLInputElement).value).toBe('6')
    expect(screen.getByText(/پیش‌نویس ذخیره‌شده در/)).toBeTruthy()
  })

  it('shows server field errors next to the field and moves to its step', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('امتیاز: میزان بین رشته‌ای بودن محصول'), { target: { value: '12' } })
    fetchMock.mockResolvedValueOnce(json(400, {
      error: 'validation_failed',
      errors: { 'scores.a.interdisciplinary': 'Expected integer from 0 to 9.' },
    }))
    await click('بعدی')
    await click('ذخیره پیش‌نویس')
    expect(lastBody()).toMatchObject({ scores: { a: { interdisciplinary: 12 } } })
    expect(await screen.findByText('یک عدد صحیح از ۰ تا ۹ وارد کنید.')).toBeTruthy()
    expect(screen.getByText(/سرور ۱ مورد را نپذیرفت/)).toBeTruthy()
    // What was typed stays on screen.
    expect((screen.getByLabelText('امتیاز: میزان بین رشته‌ای بودن محصول') as HTMLInputElement).value).toBe('12')
  })

  it('maps a tier/score mismatch to the row', async () => {
    renderForm()
    fetchMock.mockResolvedValueOnce(json(400, {
      error: 'validation_failed',
      errors: { 'scores.b.marketReach.score': 'Score does not match selected tier.' },
    }))
    await click('ذخیره پیش‌نویس')
    const alert = await screen.findByText('امتیاز با سطح انتخاب‌شده هم‌خوانی ندارد.')
    expect(alert.getAttribute('data-error-for')).toBe('scores.b.marketReach')
  })

  it('refuses to open the final confirmation while required entries are empty', async () => {
    renderForm()
    await goToSummary()
    await click('ثبت نهایی ارزیابی')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText(/مورد الزامی هنوز تکمیل نشده است/)).toBeTruthy()
    // It jumps to the first step with a missing entry.
    expect(screen.getAllByText('این مورد برای ثبت نهایی الزامی است.').length).toBeGreaterThan(0)
  })

  it('finalizes only after explicit confirmation and then locks the form', async () => {
    renderForm({ evaluation: evaluation(), revision: 2 })
    await goToSummary()
    await click('ثبت نهایی ارزیابی')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/قفل می‌شود/)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValueOnce(json(200, { evaluation: evaluation({ state: 'final', finalizedAt: '2026-10-07T00:00:00.000Z' }) }))
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'تأیید و ثبت نهایی' }))
    })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe(`/api/dashboard/requests/${REQUEST_ID}/evaluation/finalize`)
    expect(init?.method).toBe('POST')
    expect(lastBody()).toMatchObject({ revision: 2, scores: completeScores, answers: completeOrdinaryAnswers })

    expect(await screen.findByText(/نهایی و قفل شد/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'ذخیره پیش‌نویس' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'ثبت نهایی ارزیابی' })).toBeNull()
    expect(screen.getByText('۳۱٫۱۵ از ۵۵٫۰۵')).toBeTruthy()
    expect(screen.getByText('نهایی و قفل‌شده')).toBeTruthy()
  })

  it('cancelling the confirmation sends nothing', async () => {
    renderForm({ evaluation: evaluation(), revision: 2 })
    await goToSummary()
    await click('ثبت نهایی ارزیابی')
    await click('انصراف')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('opens a finalized evaluation read-only', async () => {
    renderForm({ evaluation: evaluation({ state: 'final', finalizedAt: '2026-10-07T00:00:00.000Z' }), revision: 2 })
    const input = screen.getByLabelText('امتیاز: میزان بین رشته‌ای بودن محصول') as HTMLInputElement
    expect(input.closest('fieldset')?.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'ذخیره پیش‌نویس' })).toBeNull()
    expect(screen.getByText(/نهایی و قفل شد/)).toBeTruthy()
  })

  it('opens a closed or superseded assignment read-only', () => {
    renderForm({ evaluation: null, revision: 2 }, caseItem({ actionable: false }))
    expect(screen.queryByRole('button', { name: 'ذخیره پیش‌نویس' })).toBeNull()
    expect(screen.getByText(/فرم فقط برای مشاهده است/)).toBeTruthy()
  })

  it('handles a stale revision without moving answers to the new round', async () => {
    renderForm({ evaluation: evaluation(), revision: 2 })
    fetchMock.mockResolvedValueOnce(json(409, { error: 'stale_evaluation' }))
    await click('ذخیره پیش‌نویس')
    expect(await screen.findByText(/پاسخ‌ها به دور جدید منتقل نمی‌شوند/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'بارگذاری دوباره فرم' }).getAttribute('href')).toBe(`/dashboard/requests/${REQUEST_ID}/evaluation`)
    expect((screen.getByRole('button', { name: 'ذخیره پیش‌نویس' }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats an invalid revision refusal as stale', async () => {
    renderForm()
    fetchMock.mockResolvedValueOnce(json(400, { error: 'invalid_revision' }))
    await click('ذخیره پیش‌نویس')
    expect(await screen.findByText(/پاسخ‌ها به دور جدید منتقل نمی‌شوند/)).toBeTruthy()
  })

  it('shows the persisted final version when the server says it is already locked', async () => {
    renderForm({ evaluation: evaluation(), revision: 2 })
    fetchMock
      .mockResolvedValueOnce(json(409, { error: 'evaluation_locked' }))
      .mockResolvedValueOnce(json(200, { evaluation: evaluation({ state: 'final', finalizedAt: '2026-10-07T00:00:00.000Z' }), revision: 2 }))
    await click('ذخیره پیش‌نویس')
    expect(await screen.findByText(/پیش‌تر نهایی و قفل شده است/)).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(`/api/dashboard/requests/${REQUEST_ID}/evaluation`)
    expect(screen.queryByRole('button', { name: 'ذخیره پیش‌نویس' })).toBeNull()
  })

  it('replaces the form with a denied state when the server refuses the role', async () => {
    renderForm({ evaluation: evaluation(), revision: 2 })
    fetchMock.mockResolvedValueOnce(json(403, { error: 'forbidden' }))
    await click('ذخیره پیش‌نویس')
    expect(await screen.findByText('اجازه ثبت این ارزیابی را ندارید')).toBeTruthy()
    expect(document.body.textContent).not.toContain('بازار هدف محدود است.')
  })

  it('replaces the form when the assignment ended while it was open', async () => {
    renderForm({ evaluation: evaluation(), revision: 2 })
    fetchMock.mockResolvedValueOnce(json(404, { error: 'not_found' }))
    await click('ذخیره پیش‌نویس')
    expect(await screen.findByText('این پرونده دیگر به شما ارجاع نشده است')).toBeTruthy()
  })

  it('asks for a new sign-in when the session expired', async () => {
    renderForm({ evaluation: evaluation(), revision: 2 })
    fetchMock.mockResolvedValueOnce(json(401, { error: 'unauthorized' }))
    await click('ذخیره پیش‌نویس')
    const link = await screen.findByRole('link', { name: 'ورود دوباره' })
    expect(link.getAttribute('href')).toContain('expired')
  })

  it('keeps the typed values on a network or server failure', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('امتیاز: میزان بین رشته‌ای بودن محصول'), { target: { value: '5' } })
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await click('ذخیره پیش‌نویس')
    expect(await screen.findByText(/ذخیره انجام نشد/)).toBeTruthy()
    expect((screen.getByLabelText('امتیاز: میزان بین رشته‌ای بودن محصول') as HTMLInputElement).value).toBe('5')

    fetchMock.mockResolvedValueOnce(json(500, { error: 'internal' }))
    await click('ذخیره پیش‌نویس')
    expect(await screen.findByText(/ذخیره انجام نشد/)).toBeTruthy()
  })

  it('renders the employer risk checklist instead of the ordinary questions', async () => {
    renderForm(
      { evaluation: null, revision: 2 },
      caseItem({ assignment: { role: 'employer-reviewer', slot: 'employer', assignedAt: '2026-10-05T00:00:00.000Z' } }),
    )
    await click(/اظهار نظر کیفی/)
    expect(screen.getByText('چک‌لیست ریسک')).toBeTruthy()
    expect(screen.getByText('ریسک مالی')).toBeTruthy()
    expect(screen.queryByText(ORDINARY_QUESTIONS[0]!.label)).toBeNull()

    const prompt = screen.getByText('چه عواملی می‌توانند بر هزینه‌های پروژه تأثیر بگذارند؟')
    fireEvent.change(prompt.closest('label')!.querySelector('textarea')!, { target: { value: 'نرخ ارز' } })
    fetchMock.mockResolvedValueOnce(json(200, { evaluation: evaluation({ variant: 'employer', role: 'employer-reviewer', scores: {}, answers: { risk: { financial: { costDrivers: 'نرخ ارز' } } } }) }))
    await click('ذخیره پیش‌نویس')
    expect(lastBody()).toEqual({ revision: 2, scores: {}, answers: { risk: { financial: { costDrivers: 'نرخ ارز' } } } })
  })

  it('never claims an outcome or a score normalized to 100', async () => {
    renderForm({ evaluation: evaluation(), revision: 2 })
    await goToSummary()
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/از ۱۰۰/)
    expect(text).toContain('عبور خودکار ایجاد نمی‌کند')
  })
})

describe('reviewer case file link to the form', () => {
  const caseFile = (item: ReviewQueueItemDto): ReviewCaseFileDto => ({ case: item, proposal: null, rfp: null, company: null })

  it('offers to start, continue or view the form according to the server state', () => {
    render(createElement(ReviewerCaseFile, { requestId: REQUEST_ID, initial: { kind: 'ok', data: caseFile(caseItem()) } }))
    expect(screen.getByRole('link', { name: 'شروع فرم ارزیابی' }).getAttribute('href')).toBe(`/dashboard/requests/${REQUEST_ID}/evaluation`)
    cleanup()
    render(createElement(ReviewerCaseFile, {
      requestId: REQUEST_ID,
      initial: { kind: 'ok', data: caseFile(caseItem({ evaluation: { state: 'draft', revision: 2, updatedAt: '2026-10-06T00:00:00.000Z', finalizedAt: null } })) },
    }))
    expect(screen.getByRole('link', { name: 'ادامه فرم ارزیابی' })).toBeTruthy()
    cleanup()
    render(createElement(ReviewerCaseFile, {
      requestId: REQUEST_ID,
      initial: { kind: 'ok', data: caseFile(caseItem({ evaluation: { state: 'final', revision: 2, updatedAt: '2026-10-06T00:00:00.000Z', finalizedAt: '2026-10-07T00:00:00.000Z' } })) },
    }))
    expect(screen.getByRole('link', { name: 'مشاهده فرم ارزیابی' })).toBeTruthy()
  })
})
