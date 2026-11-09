// @vitest-environment jsdom

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen, within } from '@testing-library/react'
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

describe('company-facing status (design QA #280)', () => {
  const allStages = ['احراز هویت', 'در حال داوری', 'تمام‌شده (نتیجهٔ نهایی)']
  const rawStatuses = ['پیش‌نویس', 'در حال بررسی', 'نیازمند اقدام', 'نیازمند اصلاح', 'تایید شده', 'رد شده']

  it.each([
    ['draft', null, 'احراز هویت'],
    ['in_review', 'chief_triage', 'احراز هویت'],
    ['action_needed', 'chief_triage', 'احراز هویت'],
    ['in_review', 'triaged', 'در حال داوری'],
    ['in_review', 'advanced', 'در حال داوری'],
    ['approved', 'advanced', 'تمام‌شده (نتیجهٔ نهایی)'],
    ['rejected', 'triaged', 'تمام‌شده (نتیجهٔ نهایی)'],
  ] as const)('shows a company the stage of %s / %s, never the raw status', (status, reviewStage, label) => {
    dossier({ role: 'representative', detail: detail(['read'], { status, reviewStage }) })
    expect(allStages).toContain(label)
    // The tag, the history header and the «وضعیت» field all read the stage.
    expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(2)
    for (const raw of rawStatuses) expect(screen.queryByText(raw)).toBeNull()
  })

  it('keeps the real status and stage for staff, with one wording for «action needed»', () => {
    dossier({ role: 'chief-reviewer', detail: detail(['read'], { status: 'action_needed', reviewStage: 'chief_triage' }) })
    expect(screen.getAllByText('نیازمند اقدام').length).toBeGreaterThan(0)
    expect(screen.queryByText('نیازمند اصلاح')).toBeNull()
    expect(screen.queryByText('احراز هویت')).toBeNull()
  })
})

/** What #288 added to `GET /requests/:id`, as the supervisory roles receive it. */
const rich = (actions: RequestAction[] = ['read'], overrides: Partial<RequestDetail['request']> = {}): RequestDetail => ({
  ...detail(actions, overrides),
  owner: { id: 'owner-1', name: 'نماینده شرکت ۱۰' },
  event: {
    id: 'ev-1',
    title: 'نمایشگاه نفت و گاز',
    category: null,
    subtopic: null,
    image: { url: '/api/media/file/poster.jpg', alt: 'پوستر' },
    startDate: '2027-02-01T00:00:00.000Z',
    endDate: '2027-02-04T00:00:00.000Z',
    location: 'عسلویه، بلوار سیراف',
    status: 'past',
  },
  company: {
    id: 'c-1',
    name: 'شرکت آریانا فناوران',
    type: 'سهامی عام',
    province: 'تهران',
    city: 'تهران',
    status: 'فعال',
    active: true,
    foundingYear: '1400',
    ageYears: 5,
    logo: { url: '/api/dashboard/requests/req-1/company/logo' },
    source: 'profile',
  },
  workflow: [
    { key: 'submission', title: 'ثبت و ارسال درخواست', role: 'representative', roleName: 'شرکت', order: 1, state: 'done' },
    { key: 'chief_triage', title: 'بررسی اولیه سردبیر', role: 'chief-reviewer', roleName: 'سردبیر', order: 2, state: 'done' },
    { key: 'review', title: 'داوری و تصمیم سردبیر', role: 'chief-reviewer', roleName: 'سردبیر', order: 3, state: 'current' },
    { key: 'investment', title: 'بررسی سرمایه‌گذاری', role: 'investment-reviewer', roleName: 'کمیته', order: 4, state: 'upcoming' },
    { key: 'result', title: 'اعلام نتیجه', role: 'central-secretariat', roleName: 'دبیرخانه', order: 5, state: 'upcoming' },
  ],
})

describe('data-dependent cards (#289)', () => {
  it('names the company by its own name, with logo and «فعال | نوع | سن», never by the representative', () => {
    dossier({ role: 'central-secretariat', detail: rich() })
    const card = screen.getByTestId('request-company-card')
    expect(within(card).getByRole('heading', { name: 'شرکت آریانا فناوران' })).toBeTruthy()
    expect(within(card).getByText('فعال | سهامی عام | ۵ سال')).toBeTruthy()
    expect(within(card).getByRole('img', { name: 'لوگوی شرکت آریانا فناوران' }).getAttribute('src')).toContain('/api/dashboard/requests/req-1/company/logo')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('درخواست شرکت آریانا فناوران')
    expect(screen.queryByText(/نماینده شرکت ۱۰/)).toBeNull()
  })

  it('gives reviewers and the employer the company name and type from the submission, and no owner, logo or age', () => {
    const view = rich()
    const { ownerId: _ownerId, ...request } = view.request
    dossier({
      role: 'employer-reviewer',
      detail: {
        ...view,
        owner: null,
        request: request as RequestDetail['request'],
        company: { id: null, name: 'شرکت آریانا فناوران', type: 'سهامی عام', province: 'تهران', city: 'شیراز', status: null, active: null, foundingYear: null, ageYears: null, logo: null, source: 'submission' },
      },
    })
    const card = screen.getByTestId('request-company-card')
    expect(within(card).getByText('سهامی عام | تهران | شیراز')).toBeTruthy()
    expect(within(card).queryByRole('img')).toBeNull()
    expect(screen.queryByText(/نماینده شرکت/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'مشاهده پروفایل شرکت' })).toBeNull()
  })

  it('draws the event photo, held dates, place and the event status on the application card', () => {
    dossier({ role: 'representative', detail: rich() })
    const card = screen.getByTestId('request-event-card')
    expect(within(card).getByRole('img', { name: 'پوستر' })).toBeTruthy()
    expect(within(card).getByText('۱۲–۱۵ بهمن ۱۴۰۵')).toBeTruthy()
    expect(within(card).getByText('عسلویه، بلوار سیراف')).toBeTruthy()
    expect(within(card).getByText('نمایشگاه نفت و گاز')).toBeTruthy()
    expect(within(card).getByText('تمام شده')).toBeTruthy()
  })

  it('keeps the case status on the card when the event is unknown', () => {
    dossier({ role: 'representative', detail: { ...rich(), event: null } })
    const card = screen.getByTestId('request-event-card')
    expect(within(card).queryByRole('img')).toBeNull()
    expect(within(card).getByText('در حال داوری')).toBeTruthy()
    expect(within(card).getByText('پرونده آزمایشی')).toBeTruthy()
  })

  it('walks the stepper by the server state of each step, though the case has no current step', () => {
    dossier({ role: 'representative', detail: rich(['read'], { currentStep: null }) })
    const steps = within(screen.getByTestId('request-event-card')).getAllByRole('listitem').filter((item) => item.hasAttribute('data-step-state'))
    expect(steps.map((step) => step.getAttribute('data-step-state'))).toEqual(['done', 'done', 'current', 'next', 'next'])
    expect(steps[2]!.getAttribute('aria-current')).toBe('step')
  })

  it('shows a rejected step in its own state', () => {
    const view = rich()
    view.workflow = view.workflow.map((step) => (step.key === 'review' ? { ...step, state: 'rejected' as const } : step))
    dossier({ role: 'central-secretariat', detail: view })
    const rejected = screen.getAllByRole('listitem').find((item) => item.getAttribute('data-step-state') === 'rejected')
    expect(rejected?.textContent).toContain('درخواست در این مرحله رد شد')
  })

  it('names who took each history step for staff, and only the fund for a company', () => {
    const timeline = [
      { id: 'a1', ownerId: 'o', requestId: 'req-1', letterId: null, type: 'chief_triage', title: 'پذیرش برای داوری', description: null, at: '2026-10-03T00:00:00.000Z', actorName: 'امیر احمدی', actorRole: 'chief-reviewer' },
      { id: 'a2', ownerId: 'o', requestId: 'req-1', letterId: null, type: 'submitted', title: 'ثبت درخواست', description: null, at: '2026-10-02T00:00:00.000Z', actorName: 'نماینده شرکت', actorRole: 'representative' },
    ]
    dossier({ role: 'central-secretariat', detail: { ...rich(), timeline } })
    expect(screen.getAllByTestId('history-actor').map((item) => item.textContent)).toEqual(['توسط امیر احمدی', 'توسط نماینده شرکت'])
    cleanup()

    // The company gets a name only for its own steps; Fund staff arrive as a role with no name.
    dossier({
      role: 'representative',
      detail: { ...rich(), timeline: [{ ...timeline[0]!, actorName: null }, timeline[1]!] },
    })
    const lines = screen.getAllByTestId('history-actor').map((item) => item.textContent)
    expect(lines).toEqual(['توسط کارکنان صندوق', 'توسط نماینده شرکت'])
    expect(screen.queryByText(/امیر احمدی/)).toBeNull()
    expect(within(screen.getByTestId('request-history')).queryByText(/سردبیر/)).toBeNull()
  })

  it('draws no actor line when the server named none (reviewer, employer)', () => {
    dossier({ role: 'reviewer', detail: rich() })
    expect(screen.queryByTestId('history-actor')).toBeNull()
  })
})

describe('event form and company resume (#289)', () => {
  const formFields = [
    { name: 'summary', label: 'خلاصه طرح', blockType: 'textarea' },
    { name: 'budget', label: 'بودجه', blockType: 'text' },
    { name: 'sector', label: 'بخش', blockType: 'select', options: [{ label: 'نفت', value: 'oil' }] },
  ]

  it('labels the stored answers with the service form, in its order, and keeps unknown keys', () => {
    dossier({
      role: 'representative',
      formFields,
      detail: rich(['read'], { answers: { budget: '۵۰۰', legacyKey: 'مقدار قدیمی', sector: 'oil', summary: 'متن' } }),
    })
    const labels = screen.getAllByTestId('labelled-field').map((field) => field.firstElementChild?.textContent)
    expect(labels).toEqual(['خلاصه طرح', 'بودجه', 'بخش', 'legacyKey'])
    expect(screen.getByText('نفت')).toBeTruthy()
    expect(screen.queryByTestId('request-form-empty')).toBeNull()
  })

  it('shows a designed empty state for a request with no answers, by audience', () => {
    dossier({ role: 'representative', detail: rich(['read'], { answers: {}, status: 'draft' }) })
    expect(screen.getByTestId('request-form-empty').textContent).toContain('با تکمیل و ارسال فرم درخواست')
    cleanup()
    dossier({ role: 'representative', detail: rich(['read'], { answers: {} }) })
    expect(screen.getByTestId('request-form-empty').textContent).toContain('برای این درخواست پاسخی در فرم رویداد ثبت نشده است')
    cleanup()
    dossier({ role: 'chief-reviewer', detail: rich(['read'], { answers: {} }) })
    expect(screen.getByTestId('request-form-empty').textContent).toContain('متقاضی در فرم رویداد پاسخی ثبت نکرده است')
  })

  it('does not call a failed proposal read an empty form', () => {
    dossier({ role: 'representative', proposal: 'failed', detail: rich(['read'], { answers: {} }) })
    expect(screen.queryByTestId('request-form-empty')).toBeNull()
  })

  it('draws the company resume block for the company only', () => {
    const companyProfile: NonNullable<RequestDetail['companyProfile']> = {
      company: {
        name: 'شرکت آریانا فناوران',
        establishmentDate: '1371/04/12',
        status: 'فعال',
        type: 'سهامی عام',
        registrationNumber: '15781',
        economicCode: '411111495187',
        nationalId: '10100578556',
      },
      activityDomain: 'انرژی',
      province: 'تهران',
      city: 'تهران',
      executives: [{ role: 'مدیرعامل', name: 'امیر احمدی' }],
      addresses: [{ id: 'ad-1', title: 'دفتر مرکزی', province: 'تهران', city: 'تهران', postalCode: '1531638111', address: 'خیابان بهشتی' }],
      dossier: { productsServices: ['پایش خطوط'], keyMembers: [{ name: 'علی رضایی', role: 'مهندس ارشد' }], insuredEmployeeCount: 12 },
    }
    dossier({ role: 'representative', detail: { ...rich(), companyProfile } })
    const block = screen.getByTestId('request-company-profile')
    expect(screen.getByRole('heading', { name: 'رزومه و اطلاعات شرکت' })).toBeTruthy()
    for (const text of ['10100578556', '1371/04/12', 'امیر احمدی', 'دفتر مرکزی', 'پایش خطوط', 'علی رضایی', '۱۲']) {
      expect(within(block).getAllByText(new RegExp(text)).length).toBeGreaterThan(0)
    }
    cleanup()

    dossier({ role: 'central-secretariat', detail: { ...rich(), companyProfile: null } })
    expect(screen.queryByTestId('request-company-profile')).toBeNull()
    expect(screen.queryByText('رزومه و اطلاعات شرکت')).toBeNull()
  })
})
