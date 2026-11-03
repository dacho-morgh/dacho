// @vitest-environment jsdom

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
vi.mock('@/components/dashboard/investment-dossier-panel', () => ({
  InvestmentDossierPanel: () => createElement('div', null, 'پنل یادداشت'),
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

  it.each(['system-owner', 'central-secretariat'] as const)(
    'keeps the financial slots for %s',
    (role) => {
      dossier({ role, detail: detail(['read']) })
      expect(fields()).toEqual(['proposal', ...FINANCIAL])
    },
  )

  // The company uploads in its package form and the investment person reads the frozen package (S6).
  it.each(['investment-reviewer', 'representative'] as const)(
    'leaves the financial files to the package views for %s',
    (role) => {
      dossier({ role, detail: detail(['read']) })
      expect(fields()).toEqual(['proposal'])
    },
  )

  it('gives the investment person the dossier with the memo', () => {
    dossier({ role: 'investment-reviewer', detail: detail(['read']) })
    expect(screen.getByText('پنل یادداشت')).toBeTruthy()
  })

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
    expect(screen.getByText('اصلاح پرونده و ارسال دوباره')).toBeTruthy()
    expect(screen.getByText(/ارسال دوباره از این صفحه هنوز فعال نیست/)).toBeTruthy()
    expect(screen.queryByText('correct')).toBeNull()
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
