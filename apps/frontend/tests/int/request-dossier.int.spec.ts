// @vitest-environment jsdom

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RequestActionsPanel } from '@/components/dashboard/request-actions-panel'
import { RequestDossier, type RequestDossierProps } from '@/components/dashboard/request-dossier'
import type { RequestAction, RequestDetail } from '@/utilities/dashboard-api'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

// The field reads files itself; here only the categories the dossier asks for matter.
vi.mock('@/components/documents/private-document-field', () => ({
  PrivateDocumentField: ({ category, readOnly }: { category: string; readOnly?: boolean }) =>
    createElement('div', { 'data-testid': 'document-field', 'data-read-only': String(Boolean(readOnly)) }, category),
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

const FINANCIAL = [
  'financialStatements',
  'debtFacilityEvidence',
  'taxInsuranceRecords',
  'contractsOrdersMousCommitments',
  'projectEstimateUseOfFunds',
  'guaranteeCollateral',
]

const detail = (actions: RequestAction[], overrides: Partial<RequestDetail['request']> = {}): RequestDetail => ({
  request: {
    id: 'req-1',
    trackingCode: 'EV-1',
    title: 'پرونده آزمایشی',
    serviceId: 's',
    serviceKey: 'events',
    serviceName: 'رویداد',
    ownerId: 'owner-1',
    status: 'in_review',
    reviewStage: 'triaged',
    revision: 2,
    currentStepIndex: 0,
    assignedRole: null,
    currentStep: null,
    answers: { summary: 'خلاصه', applicationTeam: [{ name: 'x' }] },
    submissionDate: null,
    dueDate: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    allowedActions: actions,
    ...overrides,
  },
  timeline: [
    { id: 'a1', ownerId: 'o', requestId: 'req-1', letterId: null, type: 'chief_triage', title: 'ثبت بررسی', description: null, at: '2026-10-03T00:00:00.000Z' },
  ],
  workflow: [],
  owner: { id: 'owner-1', name: 'شرکت نمونه' },
})

const dossier = (props: Partial<RequestDossierProps> & Pick<RequestDossierProps, 'role' | 'detail'>) =>
  render(createElement(RequestDossier, { proposal: null, round: null, evaluations: null, ...props }))

const fields = () => screen.getAllByTestId('document-field').map((field) => field.textContent)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('RequestDossier per role', () => {
  it.each(['chief-reviewer', 'reviewer', 'employer-reviewer'] as const)(
    'gives %s no financial slot, wording or follow-up',
    (role) => {
      dossier({ role, detail: detail(['read']) })
      expect(fields()).toEqual(['proposal'])
      expect(screen.queryByText(/مدارک مالی/)).toBeNull()
      expect(screen.queryByText('پنل دبیرخانه')).toBeNull()
      expect(screen.queryByText('پنل یادداشت')).toBeNull()
      expect(screen.getByTestId('document-field').getAttribute('data-read-only')).toBe('true')
    },
  )

  it.each(['system-owner', 'central-secretariat', 'investment-reviewer', 'representative'] as const)(
    'keeps the financial slots for %s',
    (role) => {
      dossier({ role, detail: detail(['read']) })
      expect(fields()).toEqual(['proposal', ...FINANCIAL])
    },
  )

  it('shows stage, revision and history for internal roles and hides raw event types', () => {
    dossier({ role: 'chief-reviewer', detail: detail(['read']) })
    expect(screen.getByText('داوری')).toBeTruthy()
    expect(screen.getByText('۲')).toBeTruthy()
    expect(screen.getByText('ثبت بررسی')).toBeTruthy()
    expect(screen.queryByText(/chief_triage/)).toBeNull()
  })

  it('renders a reviewer projection without an owner, and offers no company link', () => {
    const view = detail(['read'])
    const { ownerId: _ownerId, ...request } = view.request
    dossier({
      role: 'reviewer',
      detail: { ...view, owner: null, request: request as RequestDetail['request'] },
    })
    expect(screen.queryByText(/شرکت نمونه/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'مشاهده پروفایل شرکت' })).toBeNull()
    expect(screen.getByText('فرم ارزیابی از این صفحه هنوز فعال نیست.')).toBeTruthy()
  })

  it('links the company profile for oversight only', () => {
    dossier({ role: 'central-secretariat', detail: detail(['read', 'uploadDocument']) })
    expect(screen.getByRole('link', { name: 'مشاهده پروفایل شرکت' }).getAttribute('href')).toBe(
      '/dashboard/companies/owner-1',
    )
    cleanup()
    dossier({ role: 'chief-reviewer', detail: detail(['read']) })
    expect(screen.queryByRole('link', { name: 'مشاهده پروفایل شرکت' })).toBeNull()
  })

  it('does not print the structured team as an object', () => {
    dossier({
      role: 'representative',
      detail: detail(['read']),
      proposal: {
        agreements: [],
        proposal: {
          requestId: 'req-1',
          revision: 3,
          formVersion: 'v1',
          applicationTeam: [{ name: 'نام عضو', role: 'نقش عضو' }],
          proposalDocuments: [],
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      },
    })
    expect(screen.queryByText(/object Object/)).toBeNull()
    expect(screen.getByText(/نام عضو · نقش عضو/)).toBeTruthy()
    expect(screen.getByText('نسخه پروپوزال: ۳')).toBeTruthy()
  })

  it('tells a failed section read apart from an empty one', () => {
    dossier({ role: 'chief-reviewer', detail: detail(['read']), proposal: 'failed', round: 'failed', evaluations: 'failed' })
    expect(screen.getByText('دریافت نسخه پروپوزال انجام نشد. صفحه را دوباره بارگذاری کنید.')).toBeTruthy()
    expect(screen.getByText('دریافت اطلاعات داوری انجام نشد. صفحه را دوباره بارگذاری کنید.')).toBeTruthy()
  })

  it('shows round progress and only final evaluations to oversight', () => {
    dossier({
      role: 'chief-reviewer',
      detail: detail(['read', 'decideReview']),
      round: {
        round: {
          id: 'r1',
          requestRevision: 2,
          proposalRevision: 1,
          startedAt: '2026-10-01T00:00:00.000Z',
          completion: { required: 4, finalized: 1, ready: false, completedAt: null },
          decision: null,
        },
      },
      evaluations: {
        completedCount: 1,
        requiredCount: 4,
        items: [
          { id: 'e1', variant: 'employer', state: 'final', weightedHundredths: 4250, finalizedAt: '2026-10-02T00:00:00.000Z' },
          { id: 'e2', variant: 'ordinary', state: 'draft', finalizedAt: null },
        ],
      },
    })
    expect(screen.getByText(/ارزیابی نهایی: ۱ از ۴/)).toBeTruthy()
    expect(screen.getByText(/ارزیابی کارفرما/)).toBeTruthy()
    expect(screen.queryByText(/ارزیابی داور/)).toBeNull()
  })

  it('names the actions it has no control for instead of offering a button', () => {
    dossier({ role: 'representative', detail: detail(['read', 'correct', 'uploadDocument', 'deleteDocument']) })
    expect(screen.getByText('اصلاح و ارسال دوباره پرونده')).toBeTruthy()
    expect(screen.getByText(/ارسال دوباره از این صفحه هنوز فعال نیست/)).toBeTruthy()
    expect(screen.queryByText('correct')).toBeNull()
  })
})

describe('RequestActionsPanel', () => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  const panel = (actions: RequestAction[]) =>
    render(createElement(RequestActionsPanel, { id: 'req-1', actions, revision: 2 }))

  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('renders no controls for an action the server did not list', () => {
    const { container } = panel(['read', 'uploadDocument', 'replaceReviewer'])
    expect(container.firstChild).toBeNull()
  })

  it('requires a reason to return, sends the revision, and rereads the case', async () => {
    const fetchMock = vi.fn(async () => json(200, { request: {} }))
    vi.stubGlobal('fetch', fetchMock)
    panel(['read', 'triage'])

    fireEvent.click(screen.getByRole('radio', { name: /بازگرداندن برای اصلاح/ }))
    const submit = screen.getByRole('button', { name: 'ثبت تصمیم' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/دلیل/), { target: { value: '  مدرک ناقص  ' } })
    fireEvent.click(submit)

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/triage',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'return', reason: 'مدرک ناقص', expectedRevision: 2 }),
      }),
    )
  })

  it('keeps the typed reason and explains a stale decision', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(409, { error: 'stale_revision' })))
    panel(['read', 'decideReview'])
    fireEvent.click(screen.getByRole('radio', { name: /رد نهایی/ }))
    fireEvent.change(screen.getByLabelText(/دلیل/), { target: { value: 'دلیل من' } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت تصمیم' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/تغییر کرده است/)
    expect((screen.getByLabelText(/دلیل/) as HTMLTextAreaElement).value).toBe('دلیل من')
    expect(refresh).toHaveBeenCalled()
  })

  it('reopens through the audited owner route', async () => {
    const fetchMock = vi.fn(async () => json(200, { request: {} }))
    vi.stubGlobal('fetch', fetchMock)
    panel(['read', 'reopen'])
    fireEvent.change(screen.getByLabelText(/دلیل بازگشایی/), { target: { value: 'خطای ثبت' } })
    fireEvent.click(screen.getByRole('button', { name: 'بازگشایی' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/admin/requests/req-1/reopen',
      expect.objectContaining({ body: JSON.stringify({ reason: 'خطای ثبت', expectedRevision: 2 }) }),
    )
  })

  it('starts a round only with three distinct reviewers', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json(201, { round: {} })
        : json(200, {
            employerId: 'employer',
            items: [
              { id: 'r1', name: 'الف' },
              { id: 'r2', name: 'ب' },
              { id: 'r3', name: 'ج' },
            ],
          }),
    )
    vi.stubGlobal('fetch', fetchMock)
    panel(['read', 'startReview'])

    const start = (await screen.findByRole('button', { name: 'شروع داوری' })) as HTMLButtonElement
    expect(start.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('داور ۱'), { target: { value: 'r1' } })
    // A picked person leaves the other two lists.
    expect(screen.getByLabelText('داور ۲').textContent).not.toContain('الف')
    fireEvent.change(screen.getByLabelText('داور ۲'), { target: { value: 'r2' } })
    fireEvent.change(screen.getByLabelText('داور ۳'), { target: { value: 'r3' } })
    fireEvent.click(start)

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/requests/req-1/review-round',
      expect.objectContaining({ body: JSON.stringify({ reviewerIds: ['r1', 'r2', 'r3'], expectedRevision: 2 }) }),
    )
  })
})

describe('removed routes', () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : []
    })

  it('leaves nothing in the frontend calling the deleted transition command', () => {
    const callers = sources(join(process.cwd(), 'src')).filter((path) =>
      /api\/dashboard[^'"`\n]*\/transition/.test(readFileSync(path, 'utf8')),
    )
    expect(callers).toEqual([])
  })
})
