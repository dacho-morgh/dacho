// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/new-request',
}))

// The proposal upload control is FE07's; here it reports a ready upload for the draft it is bound to.
vi.mock('@/components/documents/private-document-field', () => ({
  PrivateDocumentField: ({ requestId, onReadyChange }: { requestId?: string; onReadyChange?: (ready: boolean) => void }) => {
    useEffect(() => {
      onReadyChange?.(true)
    }, [onReadyChange])
    return createElement('div', { 'data-testid': `proposal-field-${requestId}` })
  },
}))

import { NewRequestForm } from '@/components/dashboard/new-request-form'
import * as dashboardApi from '@/utilities/dashboard-api'
import {
  isTeamComplete,
  loadExistingApplications,
  missingFieldLabels,
  teamForAnswers,
  teamFromAnswers,
} from '@/utilities/event-application'

const EVENT_ID = '00000000-0000-4000-8000-000000000001'
const SUB_1 = '00000000-0000-4000-8000-0000000000a1'
const SUB_2 = '00000000-0000-4000-8000-0000000000a2'
const RFP_1 = '00000000-0000-4000-8000-0000000000b1'
const RFP_2 = '00000000-0000-4000-8000-0000000000b2'
const RFP_OLD = '00000000-0000-4000-8000-0000000000b0'

const { DashboardApiError } = dashboardApi

function subtopic(id: string, title: string, currentRfpVersionId: string | null): dashboardApi.EventSubtopicDto {
  return { id, eventId: EVENT_ID, categoryId: 'cat-1', categoryTitle: 'انرژی', title, employerId: 'emp', currentRfpVersionId }
}

function request(id: string, extra: Partial<dashboardApi.RequestDto> = {}): dashboardApi.RequestDto {
  return {
    id,
    trackingCode: `TRK-${id}`,
    title: 'رویدادها — زیرعنوان',
    serviceId: 'svc-events',
    serviceKey: 'events',
    serviceName: 'رویدادها',
    ownerId: 'owner',
    status: 'draft',
    currentStepIndex: 0,
    assignedRole: null,
    currentStep: null,
    answers: {},
    submissionDate: null,
    dueDate: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...extra,
  }
}

function rfp(subtopicId: string, id: string): { version: dashboardApi.RfpVersionDto } {
  return { version: { id, subtopicId, createdBy: 'owner', createdAt: '', reason: '', files: [] } }
}

const AGREEMENTS: dashboardApi.AgreementDefinition[] = [
  { type: 'non_compete', version: 'non-compete-unapproved-placeholder', title: 'قرارداد عدم رقابت', approved: false },
  { type: 'event_rules', version: 'event-rules-unapproved-placeholder', title: 'قوانین رویداد', approved: false },
]

function verification(status: dashboardApi.CompanyVerificationStatus): dashboardApi.CompanyVerificationDto {
  return { status, revision: 1, submittedAt: null, decidedAt: null, reason: null, canRequestVerification: false }
}

function mockVerification(status: dashboardApi.CompanyVerificationStatus) {
  vi.spyOn(dashboardApi, 'fetchCompanyVerification').mockResolvedValue(verification(status))
  vi.spyOn(dashboardApi, 'fetchProfileDossier').mockResolvedValue({
    dossier: {} as dashboardApi.CompanyDossierDto,
    documents: [],
    missing: { required: [], optional: [], canRequestVerification: true },
  })
}

/** The server's view of this company's applications: request list plus each pinned RFP context. */
function mockExisting(entries: Array<{ request: dashboardApi.RequestDto; subtopicId: string; rfpVersionId: string }>) {
  vi.spyOn(dashboardApi, 'listRequests').mockResolvedValue({
    items: entries.map((entry) => entry.request),
    total: entries.length,
    page: 1,
    totalPages: 1,
  })
  vi.spyOn(dashboardApi, 'getRequestRfp').mockImplementation(async (id) => {
    const entry = entries.find((item) => item.request.id === id)
    if (!entry) throw new DashboardApiError(404, 'not_found')
    return rfp(entry.subtopicId, entry.rfpVersionId)
  })
}

const fields = [{ name: 'projectTitle', label: 'عنوان طرح', blockType: 'text', required: true }]

function renderWorkspace(subtopicIds: string[] = [SUB_1, SUB_2]) {
  return render(
    createElement(NewRequestForm, {
      serviceId: 'svc-events',
      serviceKey: 'events',
      title: 'رویدادها',
      fields,
      participation: { kind: 'event', eventId: EVENT_ID, subtopicIds },
    }),
  )
}

async function card(subtopicId: string) {
  return within(await screen.findByTestId(`application-${subtopicId}`))
}

async function enabledButton(scope: ReturnType<typeof within>, name: string) {
  const button = scope.getByRole('button', { name }) as HTMLButtonElement
  await waitFor(() => expect(button.disabled).toBe(false))
  return button
}

function fillTeam(scope: ReturnType<typeof within>) {
  fireEvent.change(scope.getByLabelText('نام عضو ۱'), { target: { value: 'مریم احمدی' } })
  fireEvent.change(scope.getByLabelText('نقش در پروژه'), { target: { value: 'مدیر فنی' } })
}

function acceptAgreements(scope: ReturnType<typeof within>) {
  fireEvent.click(scope.getByRole('checkbox', { name: /قرارداد عدم رقابت/ }))
  fireEvent.click(scope.getByRole('checkbox', { name: /قوانین رویداد/ }))
}

beforeEach(() => {
  vi.spyOn(dashboardApi, 'getEventSubtopics').mockResolvedValue({
    items: [subtopic(SUB_1, 'ذخیره‌سازی انرژی', RFP_1), subtopic(SUB_2, 'هوشمندسازی شبکه', RFP_2)],
  })
  vi.spyOn(dashboardApi, 'listAgreements').mockResolvedValue({ agreements: AGREEMENTS })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('event application helpers', () => {
  it('keeps only filled team rows and treats a nameless or roleless member as incomplete', () => {
    const team = [
      { name: ' مریم ', role: ' مدیر ', relation: '' },
      { name: '', role: '', relation: '' },
      { name: 'علی', role: 'برنامه‌نویس', relation: 'کارمند' },
    ]
    expect(teamForAnswers(team)).toEqual([
      { name: 'مریم', role: 'مدیر' },
      { name: 'علی', role: 'برنامه‌نویس', relation: 'کارمند' },
    ])
    expect(isTeamComplete(team)).toBe(true)
    expect(isTeamComplete([{ name: 'مریم', role: '', relation: '' }])).toBe(false)
    expect(isTeamComplete([{ name: '', role: '', relation: '' }])).toBe(false)
    expect(teamFromAnswers(undefined)).toEqual([{ name: '', role: '', relation: '' }])
    expect(teamFromAnswers([{ name: 'مریم', role: 'مدیر' }])).toEqual([{ name: 'مریم', role: 'مدیر', relation: '' }])
  })

  it('names missing server fields in Persian, using the form labels', () => {
    expect(missingFieldLabels(['applicationTeam', 'proposalDocuments', 'projectTitle', 'x'], { projectTitle: 'عنوان طرح' })).toEqual([
      'اعضای کلیدی تیم',
      'فایل پروپوزال',
      'عنوان طرح',
      'x',
    ])
  })

  it('maps existing applications by their server-pinned subtopic and skips non-event requests', async () => {
    mockExisting([
      { request: request('newer'), subtopicId: SUB_1, rfpVersionId: RFP_1 },
      { request: request('older'), subtopicId: SUB_1, rfpVersionId: RFP_OLD },
      { request: request('other-2'), subtopicId: SUB_2, rfpVersionId: RFP_2 },
    ])
    const existing = await loadExistingApplications(EVENT_ID)
    expect(dashboardApi.listRequests).toHaveBeenCalledWith({ eventId: EVENT_ID, page: 1, limit: 50 })
    expect(existing.get(SUB_1)?.request.id).toBe('newer')
    expect(existing.get(SUB_2)?.rfpVersionId).toBe(RFP_2)
  })
})

describe('EventApplicationWorkspace drafts', () => {
  it('creates one independent draft per subtopic bound to its RFP version', async () => {
    mockVerification('approved')
    mockExisting([])
    const create = vi
      .spyOn(dashboardApi, 'createRequest')
      .mockResolvedValueOnce({ request: request('req-1') })
    renderWorkspace()

    const first = await card(SUB_1)
    fireEvent.change(first.getByLabelText('عنوان طرح'), { target: { value: 'باتری شبکه' } })
    fillTeam(first)
    fireEvent.click(await enabledButton(first, 'ذخیره پیش‌نویس'))

    await waitFor(() => expect(first.getByTestId('tracking-code').textContent).toContain('TRK-req-1'))
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      serviceId: 'svc-events',
      title: 'رویدادها — ذخیره‌سازی انرژی',
      answers: { projectTitle: 'باتری شبکه', applicationTeam: [{ name: 'مریم احمدی', role: 'مدیر فنی' }] },
      eventId: EVENT_ID,
      subtopicId: SUB_1,
      rfpVersionId: RFP_1,
    })
    expect(first.getByTestId('proposal-field-req-1')).toBeDefined()
    // The second subtopic keeps its own, still unsaved application.
    const second = await card(SUB_2)
    expect(second.queryByTestId('tracking-code')).toBeNull()
    expect(second.getByText('بدون پیش‌نویس')).toBeDefined()
  })

  it('resumes a saved draft and updates it instead of creating another application', async () => {
    mockVerification('approved')
    mockExisting([
      {
        request: request('req-9', { answers: { projectTitle: 'طرح قبلی', applicationTeam: [{ name: 'رضا', role: 'مدیر' }] } }),
        subtopicId: SUB_1,
        rfpVersionId: RFP_1,
      },
    ])
    const create = vi.spyOn(dashboardApi, 'createRequest')
    const update = vi.spyOn(dashboardApi, 'updateRequest').mockImplementation(async (id, input) => ({
      request: request(id, { answers: input.answers }),
    }))
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    await waitFor(() => expect((first.getByLabelText('عنوان طرح') as HTMLInputElement).value).toBe('طرح قبلی'))
    expect((first.getByLabelText('نام عضو ۱') as HTMLInputElement).value).toBe('رضا')
    expect(first.getByTestId('tracking-code').textContent).toContain('TRK-req-9')
    fireEvent.change(first.getByLabelText('عنوان طرح'), { target: { value: 'طرح اصلاح‌شده' } })
    fireEvent.click(await enabledButton(first, 'ذخیره پیش‌نویس'))

    // The saved result is a toast outside the workspace (FE43).
    await screen.findByText(/پیش‌نویس ذخیره شد/)
    expect(create).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith('req-9', {
      answers: { projectTitle: 'طرح اصلاح‌شده', applicationTeam: [{ name: 'رضا', role: 'مدیر' }] },
    })
  })

  it('adopts the existing draft when the server reports a duplicate subtopic application', async () => {
    mockVerification('approved')
    mockExisting([])
    vi.spyOn(dashboardApi, 'createRequest').mockRejectedValue(new DashboardApiError(409, 'duplicate_subtopic_request'))
    const update = vi.spyOn(dashboardApi, 'updateRequest').mockImplementation(async (id, input) => ({
      request: request(id, { answers: input.answers }),
    }))
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    fillTeam(first)
    // Another tab created the draft after this page loaded.
    mockExisting([{ request: request('req-other-tab'), subtopicId: SUB_1, rfpVersionId: RFP_1 }])
    fireEvent.click(await enabledButton(first, 'ذخیره پیش‌نویس'))

    await first.findByText(/همان پیش‌نویس بازیابی/)
    expect(update).toHaveBeenCalledWith('req-other-tab', {
      answers: { applicationTeam: [{ name: 'مریم احمدی', role: 'مدیر فنی' }] },
    })
    expect(first.getByTestId('tracking-code').textContent).toContain('TRK-req-other-tab')
    expect(dashboardApi.createRequest).toHaveBeenCalledTimes(1)
  })

  it('preserves input and explains the conflict when no existing draft can be found for a duplicate', async () => {
    mockVerification('approved')
    mockExisting([])
    vi.spyOn(dashboardApi, 'createRequest').mockRejectedValue(new DashboardApiError(409, 'duplicate_subtopic_request'))
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    fillTeam(first)
    fireEvent.click(await enabledButton(first, 'ذخیره پیش‌نویس'))

    expect(await first.findByText(/قبلاً درخواستی ثبت کرده‌اید/)).toBeDefined()
    expect(first.getByRole('link', { name: 'مشاهده فهرست درخواست‌ها' }).getAttribute('href')).toBe('/dashboard/requests')
    expect((first.getByLabelText('نام عضو ۱') as HTMLInputElement).value).toBe('مریم احمدی')
  })
})

describe('EventApplicationWorkspace proposal submission', () => {
  it('submits with the server agreement versions and shows the independent tracking result', async () => {
    mockVerification('approved')
    mockExisting([
      { request: request('req-1', { answers: { applicationTeam: [{ name: 'رضا', role: 'مدیر' }] } }), subtopicId: SUB_1, rfpVersionId: RFP_1 },
      { request: request('req-2'), subtopicId: SUB_2, rfpVersionId: RFP_2 },
    ])
    vi.spyOn(dashboardApi, 'updateRequest').mockImplementation(async (id, input) => ({ request: request(id, { answers: input.answers }) }))
    const submit = vi
      .spyOn(dashboardApi, 'submitRequest')
      .mockResolvedValue({ request: request('req-1', { status: 'in_review' }) })
    renderWorkspace()

    const first = await card(SUB_1)
    const nonCompete = first.getByRole('checkbox', { name: /قرارداد عدم رقابت/ })
    expect(nonCompete.getAttribute('data-state')).toBe('unchecked')
    expect(first.getByTestId('agreement-unapproved')).toBeDefined()
    acceptAgreements(first)
    fireEvent.click(await enabledButton(first, 'ارسال پروپوزال'))

    const result = await first.findByTestId('application-result')
    expect(result.textContent).toContain('TRK-req-1')
    expect(within(result).getByRole('link', { name: 'مشاهده و پیگیری درخواست' }).getAttribute('href')).toBe('/dashboard/requests/req-1')
    expect(submit).toHaveBeenCalledWith('req-1', {
      nonCompeteAcceptance: { accepted: true, textVersionId: 'non-compete-unapproved-placeholder' },
      eventRulesAcceptance: { accepted: true, textVersionId: 'event-rules-unapproved-placeholder' },
    })
    // The other subtopic is still its own draft.
    const second = await card(SUB_2)
    expect(second.getByTestId('tracking-code').textContent).toContain('TRK-req-2')
    expect(second.queryByTestId('application-result')).toBeNull()
    expect(second.getByRole('button', { name: 'ارسال پروپوزال' })).toBeDefined()
  })

  it('recovers after draft-create succeeds but final submit fails, without creating a duplicate', async () => {
    mockVerification('approved')
    mockExisting([])
    const create = vi.spyOn(dashboardApi, 'createRequest').mockResolvedValue({ request: request('req-1') })
    vi.spyOn(dashboardApi, 'updateRequest').mockImplementation(async (id, input) => ({ request: request(id, { answers: input.answers }) }))
    const submit = vi
      .spyOn(dashboardApi, 'submitRequest')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ request: request('req-1', { status: 'in_review' }) })
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    fillTeam(first)
    fireEvent.click(await enabledButton(first, 'ذخیره پیش‌نویس'))
    await first.findByTestId('proposal-field-req-1')
    acceptAgreements(first)
    fireEvent.click(await enabledButton(first, 'ارسال پروپوزال'))

    expect(await first.findByText(/ارتباط با سرور برقرار نشد/)).toBeDefined()
    expect((first.getByLabelText('نام عضو ۱') as HTMLInputElement).value).toBe('مریم احمدی')
    expect(first.getByRole('checkbox', { name: /قوانین رویداد/ }).getAttribute('data-state')).toBe('checked')

    fireEvent.click(await enabledButton(first, 'ارسال پروپوزال'))
    await first.findByTestId('application-result')
    expect(create).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledTimes(2)
    expect(submit.mock.calls.every(([id]) => id === 'req-1')).toBe(true)
  })

  it('keeps create and submit off while verification is not approved', async () => {
    mockVerification('pending')
    mockExisting([])
    const create = vi.spyOn(dashboardApi, 'createRequest')
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    await screen.findByTestId('eligibility-state')
    expect((first.getByRole('button', { name: 'ذخیره پیش‌نویس' }) as HTMLButtonElement).disabled).toBe(true)
    expect((first.getByRole('button', { name: 'ارسال پروپوزال' }) as HTMLButtonElement).disabled).toBe(true)
    expect(create).not.toHaveBeenCalled()
  })

  it('re-checks eligibility at submit and does not submit when verification was withdrawn', async () => {
    vi.spyOn(dashboardApi, 'fetchCompanyVerification')
      .mockResolvedValueOnce(verification('approved'))
      .mockResolvedValue(verification('returned'))
    vi.spyOn(dashboardApi, 'fetchProfileDossier').mockResolvedValue({
      dossier: {} as dashboardApi.CompanyDossierDto,
      documents: [],
      missing: { required: [], optional: [], canRequestVerification: true },
    })
    mockExisting([{ request: request('req-1', { answers: { applicationTeam: [{ name: 'رضا', role: 'مدیر' }] } }), subtopicId: SUB_1, rfpVersionId: RFP_1 }])
    const submit = vi.spyOn(dashboardApi, 'submitRequest')
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    acceptAgreements(first)
    fireEvent.click(await enabledButton(first, 'ارسال پروپوزال'))

    expect(await first.findByText(/دیگر تأییدشده نیست/)).toBeDefined()
    expect(submit).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('eligibility-state').getAttribute('data-state')).toBe('returned'))
    expect(first.getByRole('link', { name: 'بررسی وضعیت احراز هویت در پروفایل شرکت' })).toBeDefined()
  })

  it('handles a server eligibility denial at submit', async () => {
    mockVerification('approved')
    mockExisting([{ request: request('req-1', { answers: { applicationTeam: [{ name: 'رضا', role: 'مدیر' }] } }), subtopicId: SUB_1, rfpVersionId: RFP_1 }])
    vi.spyOn(dashboardApi, 'updateRequest').mockImplementation(async (id, input) => ({ request: request(id, { answers: input.answers }) }))
    vi.spyOn(dashboardApi, 'submitRequest').mockRejectedValue(new DashboardApiError(403, 'company_not_verified'))
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    acceptAgreements(first)
    fireEvent.click(await enabledButton(first, 'ارسال پروپوزال'))
    expect(await first.findByText(/در حین تکمیل فرم تغییر کرده/)).toBeDefined()
    expect(first.queryByTestId('application-result')).toBeNull()
  })

  it('reports a stale RFP at submit with a link back to the event', async () => {
    mockVerification('approved')
    mockExisting([{ request: request('req-1', { answers: { applicationTeam: [{ name: 'رضا', role: 'مدیر' }] } }), subtopicId: SUB_1, rfpVersionId: RFP_1 }])
    vi.spyOn(dashboardApi, 'updateRequest').mockImplementation(async (id, input) => ({ request: request(id, { answers: input.answers }) }))
    vi.spyOn(dashboardApi, 'submitRequest').mockRejectedValue(new DashboardApiError(409, 'stale_rfp'))
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    acceptAgreements(first)
    fireEvent.click(await enabledButton(first, 'ارسال پروپوزال'))
    expect(await first.findByText(/نسخه RFP این زیرعنوان/)).toBeDefined()
    expect(first.getByRole('link', { name: 'بازگشت به رویداد و مطالعه نسخه جدید RFP' }).getAttribute('href')).toBe(
      `/dashboard/events?eventId=${EVENT_ID}&subtopicId=${SUB_1}`,
    )
  })

  it('labels a draft pinned to a replaced RFP version and keeps its submit off', async () => {
    mockVerification('approved')
    mockExisting([{ request: request('req-1'), subtopicId: SUB_1, rfpVersionId: RFP_OLD }])
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    expect(await first.findByTestId('stale-draft')).toBeDefined()
    await enabledButton(first, 'ذخیره پیش‌نویس')
    expect((first.getByRole('button', { name: 'ارسال پروپوزال' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows an already-submitted application from another tab instead of resubmitting', async () => {
    mockVerification('approved')
    mockExisting([{ request: request('req-1', { answers: { applicationTeam: [{ name: 'رضا', role: 'مدیر' }] } }), subtopicId: SUB_1, rfpVersionId: RFP_1 }])
    vi.spyOn(dashboardApi, 'updateRequest').mockRejectedValue(new DashboardApiError(409, 'request_not_draft'))
    vi.spyOn(dashboardApi, 'getRequest').mockResolvedValue({
      request: request('req-1', { status: 'in_review' }),
      timeline: [],
      workflow: [],
    })
    const submit = vi.spyOn(dashboardApi, 'submitRequest')
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    acceptAgreements(first)
    fireEvent.click(await enabledButton(first, 'ارسال پروپوزال'))
    expect(await first.findByText(/پیش‌تر ارسال شده است/)).toBeDefined()
    await first.findByTestId('application-result')
    expect(submit).not.toHaveBeenCalled()
  })

  it('names the fields the server reported missing and keeps the input', async () => {
    mockVerification('approved')
    mockExisting([{ request: request('req-1', { answers: { applicationTeam: [{ name: 'رضا', role: 'مدیر' }] } }), subtopicId: SUB_1, rfpVersionId: RFP_1 }])
    vi.spyOn(dashboardApi, 'updateRequest').mockImplementation(async (id, input) => ({ request: request(id, { answers: input.answers }) }))
    vi.spyOn(dashboardApi, 'submitRequest').mockRejectedValue(
      new DashboardApiError(400, 'invalid_answers', ['projectTitle', 'proposalDocuments']),
    )
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    acceptAgreements(first)
    fireEvent.click(await enabledButton(first, 'ارسال پروپوزال'))
    expect(await first.findByText(/عنوان طرح، فایل پروپوزال/)).toBeDefined()
    expect((first.getByLabelText('نام عضو ۱') as HTMLInputElement).value).toBe('رضا')
  })

  it('lists incomplete fixed items before calling the server', async () => {
    mockVerification('approved')
    mockExisting([{ request: request('req-1'), subtopicId: SUB_1, rfpVersionId: RFP_1 }])
    const submit = vi.spyOn(dashboardApi, 'submitRequest')
    renderWorkspace([SUB_1])

    const first = await card(SUB_1)
    fireEvent.click(await enabledButton(first, 'ارسال پروپوزال'))
    expect(
      await first.findByText(/اعضای کلیدی تیم، پذیرش توافق‌نامه عدم رقابت، پذیرش قوانین رویداد/),
    ).toBeDefined()
    expect(submit).not.toHaveBeenCalled()
  })
})

describe('EventApplicationWorkspace load states', () => {
  it('reports denial for an account that may not apply', async () => {
    mockVerification('approved')
    mockExisting([])
    vi.spyOn(dashboardApi, 'getEventSubtopics').mockRejectedValue(new DashboardApiError(404, 'not_found'))
    renderWorkspace()
    expect((await screen.findByTestId('workspace-denied')).textContent).toContain('نماینده شرکت')
  })

  it('shows a retryable error and recovers', async () => {
    mockVerification('approved')
    mockExisting([])
    vi.spyOn(dashboardApi, 'listAgreements')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ agreements: AGREEMENTS })
    renderWorkspace([SUB_1])
    const error = await screen.findByTestId('workspace-error')
    fireEvent.click(within(error).getByRole('button', { name: 'تلاش دوباره' }))
    expect(await screen.findByTestId(`application-${SUB_1}`)).toBeDefined()
  })

  it('shows an empty state when no selected subtopic belongs to the event', async () => {
    mockVerification('approved')
    mockExisting([])
    renderWorkspace(['00000000-0000-4000-8000-0000000000ff'])
    const empty = await screen.findByTestId('workspace-empty')
    expect(within(empty).getByRole('link', { name: 'انتخاب زیرعنوان در صفحه رویداد' })).toBeDefined()
  })

  it('refuses to create a draft for a subtopic without a published RFP', async () => {
    mockVerification('approved')
    mockExisting([])
    vi.spyOn(dashboardApi, 'getEventSubtopics').mockResolvedValue({ items: [subtopic(SUB_1, 'بدون RFP', null)] })
    const create = vi.spyOn(dashboardApi, 'createRequest')
    renderWorkspace([SUB_1])
    const first = await card(SUB_1)
    fireEvent.click(await enabledButton(first, 'ذخیره پیش‌نویس'))
    expect(await first.findByText(/RFP این زیرعنوان هنوز منتشر نشده/)).toBeDefined()
    expect(create).not.toHaveBeenCalled()
  })
})
