// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }))

// FE07's upload control reads files itself; here it reports a ready proposal for the case it is bound to.
vi.mock('@/components/documents/private-document-field', () => ({
  PrivateDocumentField: ({
    category,
    requestId,
    onReadyChange,
  }: {
    category: string
    requestId?: string
    onReadyChange?: (ready: boolean) => void
  }) => {
    useEffect(() => {
      onReadyChange?.(true)
    }, [onReadyChange])
    return createElement('div', { 'data-testid': 'document-field', 'data-request': requestId }, category)
  },
}))
vi.mock('@/components/dashboard/secretariat-follow-up-panel', () => ({
  SecretariatFollowUpPanel: () => createElement('div', null, 'پنل دبیرخانه'),
}))
vi.mock('@/components/dashboard/request-assignment-panel', () => ({
  RequestAssignmentPanel: () => createElement('div', null, 'پنل انتساب'),
}))
vi.mock('@/components/dashboard/investment-memo-panel', () => ({
  InvestmentMemoPanel: () => createElement('div', null, 'پنل یادداشت'),
}))

import { CompanyCorrectionPanel } from '@/components/dashboard/company-correction-panel'
import { CompanyRequestTracking } from '@/components/dashboard/company-request-tracking'
import { RequestDossier } from '@/components/dashboard/request-dossier'
import { RequestsListRow } from '@/components/dashboard/requests/requests-list-row'
import {
  DashboardApiError,
  mapRequestItem,
  type ActivityDto,
  type RequestAction,
  type RequestDto,
} from '@/utilities/dashboard-api'
import {
  companyNextAction,
  companyStageLabel,
  describeCorrectionFailure,
  trackingOutcome,
} from '@/utilities/request-tracking'

const REQUEST_ID = '00000000-0000-4000-8000-0000000000c1'

function request(extra: Partial<RequestDto> = {}): RequestDto {
  return {
    id: REQUEST_ID,
    trackingCode: 'EV-1405-0007',
    title: 'رویداد انرژی — ذخیره‌سازی',
    serviceId: 'svc-events',
    serviceKey: 'events',
    serviceName: 'رویدادها',
    ownerId: 'owner',
    status: 'in_review',
    reviewStage: 'chief_triage',
    revision: 3,
    currentStepIndex: 0,
    assignedRole: null,
    currentStep: null,
    answers: { projectTitle: 'باتری شبکه', applicationTeam: [{ name: 'رضا', role: 'مدیر فنی' }] },
    submissionDate: '2026-10-20T00:00:00.000Z',
    dueDate: null,
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-21T00:00:00.000Z',
    allowedActions: ['read'],
    ...extra,
  }
}

function row(action: string, at: string, extra: Partial<ActivityDto> = {}): ActivityDto {
  return {
    id: `${action}-${at}`,
    ownerId: 'owner',
    requestId: REQUEST_ID,
    letterId: null,
    type: 'transition',
    title: action,
    description: null,
    at,
    action,
    reason: null,
    revision: null,
    ...extra,
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const AGREEMENTS = {
  agreements: [
    { type: 'non_compete', version: 'nc-v1', title: 'قرارداد عدم رقابت', approved: false },
    { type: 'event_rules', version: 'rules-v1', title: 'قوانین رویداد', approved: false },
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('tracking state of an own application', () => {
  it('names each stage the server reports, never a raw key', () => {
    expect(companyStageLabel(request({ status: 'draft', reviewStage: null }))).toBe('پیش‌نویس (ارسال نشده)')
    expect(companyStageLabel(request())).toBe('بررسی اولیه')
    expect(companyStageLabel(request({ reviewStage: 'triaged' }))).toBe('داوری')
    expect(companyStageLabel(request({ reviewStage: 'advanced' }))).toBe('مالی و سرمایه‌گذاری')
    expect(companyStageLabel(request({ status: 'action_needed' }))).toBe('بازگشت برای اصلاح')
    expect(companyStageLabel(request({ status: 'rejected' }))).toBe('رد نهایی')
  })

  it('derives the next action only from the server-listed actions', () => {
    expect(companyNextAction(request({ allowedActions: ['read', 'submit'] }))).toBe('تکمیل و ارسال پیش‌نویس')
    expect(companyNextAction(request({ allowedActions: ['read', 'correct'] }))).toBe('اصلاح پرونده و ارسال دوباره')
    expect(companyNextAction(request({ allowedActions: ['read', 'submitFinancialPackage'] }))).toBe('بارگذاری و ارسال بسته مالی')
    // A returned status without the listed action offers no correction step.
    expect(companyNextAction(request({ status: 'action_needed', allowedActions: ['read'] }))).toBe('منتظر بررسی؛ اقدامی از شما لازم نیست')
    expect(companyNextAction(request({ status: 'rejected', allowedActions: ['read'] }))).toBe('اقدامی از شما لازم نیست')
  })

  it('carries stage, next action and revision to the list row', () => {
    const item = mapRequestItem(request({ status: 'action_needed', allowedActions: ['read', 'correct'], revision: 4 }))
    expect(item).toMatchObject({ stageLabel: 'بازگشت برای اصلاح', nextAction: 'اصلاح پرونده و ارسال دوباره', revision: 4 })
    render(createElement('table', null, createElement('tbody', null, createElement(RequestsListRow, { item }))))
    expect(screen.getByTestId('row-stage').textContent).toBe('بازگشت برای اصلاح · نسخه ۴')
    expect(screen.getByTestId('row-next-action').textContent).toContain('اصلاح پرونده و ارسال دوباره')
    expect(screen.getByText(/EV-1405-0007/)).toBeTruthy()
  })

  it('reads a triage return and a post-review return with the reason the server recorded', () => {
    const returned = request({ status: 'action_needed' })
    expect(trackingOutcome(returned, [row('submit', '2026-10-01'), row('chief_return', '2026-10-02', { reason: 'بودجه ناقص است' })]))
      .toMatchObject({ kind: 'correction', after: 'triage', reason: 'بودجه ناقص است' })
    expect(
      trackingOutcome(returned, [
        row('chief_return', '2026-10-02', { reason: 'قدیمی' }),
        row('chief_review_return', '2026-10-09', { reason: 'روش ارزیابی روشن نیست' }),
      ]),
    ).toMatchObject({ kind: 'correction', after: 'review', reason: 'روش ارزیابی روشن نیست' })
  })

  it('reads a final rejection, a reopen and a resubmitted correction', () => {
    expect(trackingOutcome(request({ status: 'rejected' }), [row('chief_review_reject', '2026-10-05', { reason: 'خارج از دامنه' })]))
      .toMatchObject({ kind: 'rejected', after: 'review', reason: 'خارج از دامنه' })
    expect(trackingOutcome(request(), [row('chief_reject', '2026-10-05'), row('owner_reopen', '2026-10-06', { reason: 'بازبینی' })]))
      .toMatchObject({ kind: 'reopened', reason: 'بازبینی' })
    expect(
      trackingOutcome(request(), [
        row('chief_review_return', '2026-10-05'),
        row('correction_submit', '2026-10-07', { revision: 5 }),
      ]),
    ).toMatchObject({ kind: 'resubmitted', newRound: true, revision: 5 })
    expect(trackingOutcome(request(), [row('submit', '2026-10-01')])).toBeNull()
    // Never infer an outcome the server did not record.
    expect(trackingOutcome(request({ status: 'rejected' }), [])).toBeNull()
  })
})

describe('CompanyRequestTracking', () => {
  const tracking = (props: Partial<Parameters<typeof CompanyRequestTracking>[0]> = {}) =>
    render(
      createElement(CompanyRequestTracking, {
        request: request(),
        timeline: [],
        proposalRevision: 2,
        publishedResult: { result: null },
        ...props,
      }),
    )

  it('shows stage, required next action and the submitted proposal revision', () => {
    tracking({ request: request({ status: 'action_needed', allowedActions: ['read', 'correct'] }) })
    expect(screen.getByTestId('tracking-stage').textContent).toBe('بازگشت برای اصلاح')
    expect(screen.getByTestId('tracking-next').textContent).toBe('اصلاح پرونده و ارسال دوباره')
    expect(screen.getByTestId('tracking-proposal-revision').textContent).toBe('۲')
  })

  it('explains a return for correction with its reason', () => {
    tracking({
      request: request({ status: 'action_needed' }),
      timeline: [row('chief_review_return', '2026-10-09', { reason: 'روش ارزیابی روشن نیست' })],
    })
    expect(screen.getByTestId('tracking-correction').textContent).toContain('پس از داوری')
    expect(screen.getByTestId('tracking-reason').textContent).toContain('روش ارزیابی روشن نیست')
  })

  it('blocks only this event and subtopic on a final rejection and shows the reason', () => {
    tracking({
      request: request({ status: 'rejected' }),
      timeline: [row('chief_reject', '2026-10-05', { reason: 'خارج از دامنه رویداد' })],
    })
    const notice = screen.getByTestId('tracking-rejected')
    expect(notice.textContent).toContain('خارج از دامنه رویداد')
    expect(notice.textContent).toContain('فقط همین درخواست (همین رویداد و زیرعنوان)')
    expect(screen.getByTestId('tracking-next').textContent).toBe('اقدامی از شما لازم نیست')
  })

  it('shows the reopen state the server returned', () => {
    tracking({ timeline: [row('chief_reject', '2026-10-05'), row('owner_reopen', '2026-10-06', { reason: 'بازبینی مدارک' })] })
    expect(screen.getByTestId('tracking-reopened').textContent).toContain('بازبینی مدارک')
  })

  it('explains the new review round after a post-review correction was resubmitted', () => {
    tracking({ timeline: [row('chief_review_return', '2026-10-05'), row('correction_submit', '2026-10-07')] })
    expect(screen.getByTestId('tracking-resubmitted').textContent).toContain('دور داوری تازه')
  })

  it('renders only the released result text and date', () => {
    const released = {
      body: 'متن منتشرشده برای شرکت',
      publishedAt: '2026-10-30T00:00:00.000Z',
      // Fields a misbehaving response might carry must never reach the screen.
      memo: 'یادداشت داخلی سرمایه‌گذاری',
      score: 48.5,
      otherCompany: 'شرکت دیگر',
    }
    tracking({
      request: request({ reviewStage: 'advanced' }),
      publishedResult: { result: released as unknown as { body: string; publishedAt: string } },
    })
    const section = screen.getByTestId('published-result')
    expect(section.textContent).toContain('متن منتشرشده برای شرکت')
    expect(document.body.textContent).not.toContain('یادداشت داخلی')
    expect(document.body.textContent).not.toContain('48')
    expect(document.body.textContent).not.toContain('شرکت دیگر')
  })

  it('says a result is not published yet, and tells a failed read apart', () => {
    tracking({ request: request({ reviewStage: 'advanced' }) })
    expect(screen.getByTestId('result-pending')).toBeTruthy()
    cleanup()
    tracking({ request: request({ reviewStage: 'advanced' }), publishedResult: 'failed', proposalRevision: 'failed' })
    expect(screen.getByRole('alert').textContent).toContain('دریافت نتیجه پرونده انجام نشد')
    expect(screen.queryByTestId('result-pending')).toBeNull()
    expect(screen.getByTestId('tracking-proposal-revision').textContent).toBe('دریافت نشد')
  })
})

describe('CompanyCorrectionPanel', () => {
  const FIELDS = [{ name: 'projectTitle', label: 'عنوان طرح', blockType: 'text', required: true }]

  function stubApi(handlers: { patch?: () => Response; resubmit?: () => Response; agreements?: () => Response }) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.endsWith('/agreements')) return handlers.agreements?.() ?? json(200, AGREEMENTS)
      if (method === 'PATCH' && url.endsWith(`/requests/${REQUEST_ID}`)) {
        return handlers.patch?.() ?? json(200, { request: request({ status: 'action_needed' }) })
      }
      if (method === 'POST' && url.endsWith(`/requests/${REQUEST_ID}/resubmit`)) {
        return handlers.resubmit?.() ?? json(200, { request: request({ revision: 4 }) })
      }
      return json(404, { error: 'not_found' })
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  const panel = (after: 'triage' | 'review' | null = 'triage') =>
    render(createElement(CompanyCorrectionPanel, { request: request({ status: 'action_needed' }), fields: FIELDS, after }))

  const acceptAgreements = async () => {
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /قرارداد عدم رقابت/ }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByRole('checkbox', { name: /قرارداد عدم رقابت/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /قوانین رویداد/ }))
  }

  it('edits the same case and resubmits it with the agreement versions', async () => {
    const fetchMock = stubApi({})
    panel()
    expect((screen.getByLabelText('عنوان طرح') as HTMLInputElement).value).toBe('باتری شبکه')
    expect(screen.getByTestId('document-field').getAttribute('data-request')).toBe(REQUEST_ID)
    fireEvent.change(screen.getByLabelText('عنوان طرح'), { target: { value: 'باتری شبکه اصلاح‌شده' } })
    await acceptAgreements()
    fireEvent.click(screen.getByRole('button', { name: 'ارسال اصلاحیه' }))

    await waitFor(() => expect(screen.getByTestId('correction-sent')).toBeTruthy())
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET')
    expect(writes.map(([url, init]) => `${init?.method} ${String(url)}`)).toEqual([
      `PATCH /api/dashboard/requests/${REQUEST_ID}`,
      `POST /api/dashboard/requests/${REQUEST_ID}/resubmit`,
    ])
    const patched = JSON.parse(String(writes[0]![1]!.body))
    expect(patched.answers.projectTitle).toBe('باتری شبکه اصلاح‌شده')
    expect(patched.answers.applicationTeam).toEqual([{ name: 'رضا', role: 'مدیر فنی' }])
    expect(JSON.parse(String(writes[1]![1]!.body))).toEqual({
      nonCompeteAcceptance: { accepted: true, textVersionId: 'nc-v1' },
      eventRulesAcceptance: { accepted: true, textVersionId: 'rules-v1' },
    })
    expect(refresh).toHaveBeenCalled()
    // Never a new application: nothing creates a request.
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/requests') && init?.method === 'POST')).toBe(false)
  })

  it('explains the new review round only after a post-review return', () => {
    stubApi({})
    panel('review')
    expect(screen.getByTestId('new-round-note').textContent).toContain('دور داوری تازه')
    cleanup()
    panel('triage')
    expect(screen.queryByTestId('new-round-note')).toBeNull()
  })

  it('does not send without the agreements, and says what is missing', async () => {
    const fetchMock = stubApi({})
    panel()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /قرارداد عدم رقابت/ }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'ارسال اصلاحیه' }))
    expect(screen.getByRole('alert').textContent).toContain('پذیرش توافق‌نامه عدم رقابت')
    expect(fetchMock.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true)
  })

  it('handles a stale case: rereads it and keeps the typed input', async () => {
    stubApi({ resubmit: () => json(409, { error: 'not_correctable' }) })
    panel()
    fireEvent.change(screen.getByLabelText('عنوان طرح'), { target: { value: 'متن حفظ‌شده' } })
    await acceptAgreements()
    fireEvent.click(screen.getByRole('button', { name: 'ارسال اصلاحیه' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('دیگر در وضعیت اصلاح نیست'))
    expect(refresh).toHaveBeenCalled()
    expect((screen.getByLabelText('عنوان طرح') as HTMLInputElement).value).toBe('متن حفظ‌شده')
    expect(screen.queryByTestId('correction-sent')).toBeNull()
  })

  it('treats an edit refused as no longer correctable as stale too', async () => {
    const fetchMock = stubApi({ patch: () => json(409, { error: 'request_not_draft' }) })
    panel()
    await acceptAgreements()
    fireEvent.click(screen.getByRole('button', { name: 'ارسال اصلاحیه' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('دیگر در وضعیت اصلاح نیست'))
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/resubmit'))).toBe(false)
  })

  it('names the fields the server reported missing', async () => {
    stubApi({ resubmit: () => json(400, { error: 'invalid_answers', missingFields: ['projectTitle', 'proposalDocuments'] }) })
    panel()
    await acceptAgreements()
    fireEvent.click(screen.getByRole('button', { name: 'ارسال اصلاحیه' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('عنوان طرح، فایل پروپوزال'))
  })

  it('links to verification when the company is no longer verified', async () => {
    stubApi({ resubmit: () => json(403, { error: 'company_not_verified' }) })
    panel()
    await acceptAgreements()
    fireEvent.click(screen.getByRole('button', { name: 'ارسال اصلاحیه' }))
    await waitFor(() => expect(screen.getByRole('link', { name: /احراز هویت/ })).toBeTruthy())
  })

  it('shows a denied refusal and an agreement load error with retry', async () => {
    stubApi({ agreements: () => json(500, { error: 'boom' }) })
    panel()
    await waitFor(() => expect(screen.getByText('دریافت نسخه تعهدنامه‌ها انجام نشد.')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeTruthy()
    expect(describeCorrectionFailure(new DashboardApiError(403, 'forbidden'), {}).kind).toBe('denied')
    expect(describeCorrectionFailure(new DashboardApiError(404, 'not_found'), {}).kind).toBe('denied')
    expect(describeCorrectionFailure(new TypeError('Failed to fetch'), {}).kind).toBe('network')
  })
})

describe('RequestDossier with the correction form', () => {
  const detail = (actions: RequestAction[]) => ({
    request: request({ status: 'action_needed', allowedActions: actions }),
    timeline: [],
    workflow: [],
    owner: null,
  })

  it('drops the "not built" note and the duplicate proposal slot when the form is present', () => {
    render(
      createElement(RequestDossier, {
        role: 'representative',
        detail: detail(['read', 'correct', 'uploadDocument', 'deleteDocument']),
        proposal: null,
        round: null,
        evaluations: null,
        correctionHandled: true,
        companySections: createElement('div', null, 'فرم اصلاح'),
      }),
    )
    expect(screen.queryByText(/ارسال دوباره از این صفحه هنوز فعال نیست/)).toBeNull()
    expect(screen.getAllByTestId('document-field').map((field) => field.textContent)).not.toContain('proposal')
    expect(screen.getByText('فرم اصلاح')).toBeTruthy()
  })
})
