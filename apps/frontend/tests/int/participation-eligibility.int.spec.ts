// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/events',
}))

// The proposal upload field is FE07's; here it only reports a ready upload.
vi.mock('@/components/documents/private-document-field', () => ({
  PrivateDocumentField: ({ onReadyChange }: { onReadyChange?: (ready: boolean) => void }) => {
    useEffect(() => {
      onReadyChange?.(true)
    }, [onReadyChange])
    return createElement('div', { 'data-testid': 'proposal-field' })
  },
}))

import { ParticipationEligibilityPanel } from '@/components/dashboard/participation-eligibility-panel'
import { EventsView, type EventItem } from '@/components/dashboard/events-view'
import { NewRequestForm } from '@/components/dashboard/new-request-form'
import { registrationReturnUrl } from '@/components/dashboard/profile/return-to-registration'
import * as dashboardApi from '@/utilities/dashboard-api'
import {
  deriveEligibility,
  describeSubmissionFailure,
  missingSectionLinks,
  participationDestination,
} from '@/utilities/participation-eligibility'

const EVENT_ID = '00000000-0000-0000-0000-000000000001'

function verification(
  status: dashboardApi.CompanyVerificationStatus,
  extra: Partial<dashboardApi.CompanyVerificationDto> = {},
): dashboardApi.CompanyVerificationDto {
  return {
    status,
    revision: 1,
    submittedAt: null,
    decidedAt: null,
    reason: null,
    canRequestVerification: false,
    ...extra,
  }
}

function dossier(required: string[]): dashboardApi.DossierResponseDto {
  return {
    dossier: {} as dashboardApi.CompanyDossierDto,
    documents: [],
    missing: { required, optional: [], canRequestVerification: required.length === 0 },
  }
}

function mockEligibility(
  status: dashboardApi.CompanyVerificationStatus,
  required: string[] = [],
  extra: Partial<dashboardApi.CompanyVerificationDto> = {},
) {
  vi.spyOn(dashboardApi, 'fetchCompanyVerification').mockResolvedValue(verification(status, extra))
  vi.spyOn(dashboardApi, 'fetchProfileDossier').mockResolvedValue(dossier(required))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  mockPush.mockReset()
})

describe('participation eligibility rules', () => {
  it('maps every verification status to an explained state; only approval allows participation', () => {
    expect(deriveEligibility(verification('unsubmitted'), { required: ['addresses'] })).toMatchObject({
      state: 'incomplete',
      canParticipate: false,
      missingRequired: ['addresses'],
    })
    expect(deriveEligibility(verification('unsubmitted'), { required: [] }).state).toBe('ready_to_request')
    expect(deriveEligibility(verification('pending'), { required: [] })).toMatchObject({ state: 'pending', canParticipate: false })
    expect(
      deriveEligibility(verification('returned', { reason: 'آگهی تأسیس خوانا نیست' }), { required: ['establishmentNotices'] }),
    ).toMatchObject({ state: 'returned', canParticipate: false, reason: 'آگهی تأسیس خوانا نیست' })
    expect(deriveEligibility(verification('rejected'), null).canParticipate).toBe(false)
    expect(deriveEligibility(verification('approved'), { required: ['website'] })).toMatchObject({
      state: 'approved',
      canParticipate: true,
      missingRequired: [],
    })
  })

  it('preserves the intended event/subtopics or exhibition booth as the destination', () => {
    expect(participationDestination({ kind: 'event', eventId: EVENT_ID, subtopicIds: ['sub-1', 'sub-2'] })).toBe(
      `/dashboard/events?eventId=${EVENT_ID}&subtopicId=sub-1%2Csub-2`,
    )
    expect(
      participationDestination({ kind: 'exhibition', exhibitionId: '7', exhibitionTitle: 'نمایشگاه', boothId: 'booth-9' }),
    ).toBe('/dashboard/new-request?service=exhibitions&eventId=7&eventTitle=%D9%86%D9%85%D8%A7%DB%8C%D8%B4%DA%AF%D8%A7%D9%87&boothId=booth-9')
  })

  it('links each missing field to its precise profile section with the return destination', () => {
    const returnTo = `/dashboard/events?eventId=${EVENT_ID}&subtopicId=sub-1`
    const links = missingSectionLinks(
      ['registrationNumber', 'foundingYear', 'articlesOfAssociation', 'addresses', 'productsServices'],
      returnTo,
    )
    const encoded = encodeURIComponent(returnTo)
    expect(links.map((link) => link.href)).toEqual([
      `/dashboard/profile/company?returnTo=${encoded}#company-basic`,
      `/dashboard/profile/company?returnTo=${encoded}#company-documents`,
      `/dashboard/profile/company?returnTo=${encoded}#company-addresses`,
      `/dashboard/profile/resume?returnTo=${encoded}#resume-products`,
    ])
    expect(links[0]?.fields.map((field) => field.label)).toEqual(['شماره ثبت', 'سال تأسیس'])
  })

  it('never carries an external or non-registration return URL', () => {
    expect(missingSectionLinks(['addresses'], 'https://evil.example/x')[0]?.href).toBe(
      '/dashboard/profile/company#company-addresses',
    )
    expect(registrationReturnUrl('//evil.example')).toBeNull()
    expect(registrationReturnUrl('/dashboard/letters')).toBeNull()
    expect(registrationReturnUrl('/dashboard/events?eventId=1&subtopicId=a')).toBe('/dashboard/events?eventId=1&subtopicId=a')
    expect(registrationReturnUrl('/dashboard/new-request?service=exhibitions&eventId=7&boothId=b')).toBe(
      '/dashboard/new-request?service=exhibitions&eventId=7&boothId=b',
    )
  })

  it('distinguishes a verification withdrawn mid-form from stale and duplicate submissions', () => {
    const fallback = 'خطا'
    expect(describeSubmissionFailure(new dashboardApi.DashboardApiError(403, 'company_not_verified'), fallback).kind).toBe('not_verified')
    expect(describeSubmissionFailure(new dashboardApi.DashboardApiError(409, 'stale_rfp'), fallback).kind).toBe('stale_rfp')
    expect(describeSubmissionFailure(new dashboardApi.DashboardApiError(409, 'already_submitted'), fallback).kind).toBe('already_submitted')
    expect(describeSubmissionFailure(new dashboardApi.DashboardApiError(409, 'duplicate_subtopic_request'), fallback).kind).toBe('duplicate')
    expect(describeSubmissionFailure(new TypeError('fetch failed'), fallback).kind).toBe('network')
    expect(describeSubmissionFailure(new dashboardApi.DashboardApiError(500, 'request_failed'), fallback)).toEqual({
      kind: 'other',
      message: fallback,
    })
  })
})

describe('ParticipationEligibilityPanel', () => {
  const eventTarget = { kind: 'event' as const, eventId: EVENT_ID, subtopicIds: ['sub-1'] }

  it('shows loading, then an incomplete dossier with links to the missing sections', async () => {
    mockEligibility('unsubmitted', ['registrationNumber', 'establishmentNotices'])
    render(createElement(ParticipationEligibilityPanel, { target: eventTarget }))
    expect(screen.getByRole('status', { name: 'در حال بررسی وضعیت احراز هویت شرکت' })).toBeDefined()

    const state = await screen.findByTestId('eligibility-state')
    expect(state.getAttribute('data-state')).toBe('incomplete')
    const list = screen.getByRole('list', { name: 'بخش‌های ناقص پروفایل' })
    const links = within(list).getAllByRole('link')
    const returnTo = encodeURIComponent(`/dashboard/events?eventId=${EVENT_ID}&subtopicId=sub-1`)
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `/dashboard/profile/company?returnTo=${returnTo}#company-basic`,
      `/dashboard/profile/company?returnTo=${returnTo}#company-documents`,
    ])
  })

  it('offers the verification request when the dossier is complete and refreshes to pending', async () => {
    const fetchVerification = vi
      .spyOn(dashboardApi, 'fetchCompanyVerification')
      .mockResolvedValueOnce(verification('unsubmitted', { canRequestVerification: true }))
      .mockResolvedValue(verification('pending'))
    vi.spyOn(dashboardApi, 'fetchProfileDossier').mockResolvedValue(dossier([]))
    const submit = vi.spyOn(dashboardApi, 'submitCompanyVerification').mockResolvedValue({})
    render(createElement(ParticipationEligibilityPanel, { target: eventTarget }))

    expect((await screen.findByTestId('eligibility-state')).getAttribute('data-state')).toBe('ready_to_request')
    fireEvent.click(screen.getByRole('button', { name: 'ارسال درخواست احراز هویت' }))
    await waitFor(() => expect(screen.getByTestId('eligibility-state').getAttribute('data-state')).toBe('pending'))
    expect(submit).toHaveBeenCalledTimes(1)
    expect(fetchVerification).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/در حال بررسی دبیرخانه است/)).toBeDefined()
  })

  it('explains a returned verification with the secretariat reason and the sections to fix', async () => {
    mockEligibility('returned', ['articlesOfAssociation'], { reason: 'اساس‌نامه ناقص است', canRequestVerification: false })
    render(createElement(ParticipationEligibilityPanel, { target: eventTarget }))
    expect((await screen.findByTestId('eligibility-state')).getAttribute('data-state')).toBe('returned')
    expect(screen.getByText('اساس‌نامه ناقص است')).toBeDefined()
    expect(screen.getByRole('link', { name: 'تکمیل مدارک رسمی شرکت' })).toBeDefined()
    expect(screen.queryByRole('button', { name: /ارسال دوباره برای احراز هویت/ })).toBeNull()
  })

  it('reports approval without implying proposal acceptance', async () => {
    const onChange = vi.fn()
    mockEligibility('approved')
    render(createElement(ParticipationEligibilityPanel, { target: eventTarget, onEligibilityChange: onChange }))
    expect((await screen.findByTestId('eligibility-state')).getAttribute('data-state')).toBe('approved')
    expect(screen.getByText(/تأیید احراز هویت به معنی پذیرش پروپوزال نیست/)).toBeDefined()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ canParticipate: true }))
  })

  it('separates company verification, booth attendance approval and payment permission', async () => {
    mockEligibility('approved')
    vi.spyOn(dashboardApi, 'listMyBoothReservations').mockResolvedValue({
      items: [
        {
          id: 'r1', boothId: 'b1', boothIdentifier: 'A-12', exhibitionId: '7', active: true,
          attendanceStatus: 'pending', attendanceReason: null, paymentStatus: 'unpaid', createdAt: '', allowedActions: ['read'],
        },
        {
          id: 'r2', boothId: 'b2', boothIdentifier: 'B-03', exhibitionId: '7', active: true,
          attendanceStatus: 'approved', attendanceReason: null, paymentStatus: 'unpaid', createdAt: '', allowedActions: ['read', 'submit_receipt'],
        },
      ],
    })
    render(createElement(ParticipationEligibilityPanel, { target: { kind: 'exhibition', exhibitionId: '7', boothId: 'b1' } }))
    const list = await screen.findByRole('list', { name: 'غرفه‌های رزروشده' })
    expect(screen.getByText('۲. تأیید حضور در نمایشگاه')).toBeDefined()
    expect(screen.getByText('۳. اجازه پرداخت')).toBeDefined()
    const rows = within(list).getAllByRole('listitem')
    expect(within(rows[0]!).getByText('در انتظار تأیید حضور')).toBeDefined()
    expect(within(rows[0]!).getByText('پرداخت هنوز مجاز نیست')).toBeDefined()
    expect(within(rows[1]!).getByText('حضور تأیید شده')).toBeDefined()
    expect(within(rows[1]!).getByText('مجاز به پرداخت و ارسال رسید')).toBeDefined()
  })

  it('shows an empty reservation state for an approved company with no booths', async () => {
    mockEligibility('approved')
    vi.spyOn(dashboardApi, 'listMyBoothReservations').mockResolvedValue({ items: [] })
    render(createElement(ParticipationEligibilityPanel, { target: { kind: 'exhibition', exhibitionId: '7' } }))
    expect(await screen.findByText('هنوز غرفه‌ای در این نمایشگاه رزرو نکرده‌اید.')).toBeDefined()
  })

  it('reports denial for accounts that are not a company representative', async () => {
    vi.spyOn(dashboardApi, 'fetchCompanyVerification').mockRejectedValue(new dashboardApi.DashboardApiError(403, 'forbidden'))
    vi.spyOn(dashboardApi, 'fetchProfileDossier').mockRejectedValue(new dashboardApi.DashboardApiError(403, 'forbidden'))
    const onChange = vi.fn()
    render(createElement(ParticipationEligibilityPanel, { target: eventTarget, onEligibilityChange: onChange }))
    expect(await screen.findByText(/فقط برای نماینده یک شرکت ثبت‌شده/)).toBeDefined()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('shows a retryable error and recovers', async () => {
    vi.spyOn(dashboardApi, 'fetchCompanyVerification')
      .mockRejectedValueOnce(new dashboardApi.DashboardApiError(500, 'request_failed'))
      .mockResolvedValue(verification('pending'))
    vi.spyOn(dashboardApi, 'fetchProfileDossier').mockResolvedValue(dossier([]))
    render(createElement(ParticipationEligibilityPanel, { target: eventTarget }))
    fireEvent.click(await screen.findByRole('button', { name: 'تلاش دوباره' }))
    await waitFor(() => expect(screen.getByTestId('eligibility-state').getAttribute('data-state')).toBe('pending'))
  })

  it('drops an older server reply that arrives after a newer one', async () => {
    let resolveOld: (value: dashboardApi.CompanyVerificationDto) => void = () => undefined
    vi.spyOn(dashboardApi, 'fetchCompanyVerification')
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValue(verification('pending'))
    vi.spyOn(dashboardApi, 'fetchProfileDossier').mockResolvedValue(dossier([]))
    const { rerender } = render(createElement(ParticipationEligibilityPanel, { target: eventTarget, refreshKey: 0 }))
    rerender(createElement(ParticipationEligibilityPanel, { target: eventTarget, refreshKey: 1 }))
    await waitFor(() => expect(screen.getByTestId('eligibility-state').getAttribute('data-state')).toBe('pending'))
    await act(async () => {
      resolveOld(verification('approved'))
    })
    expect(screen.getByTestId('eligibility-state').getAttribute('data-state')).toBe('pending')
  })
})

describe('EventsView eligibility gate', () => {
  const event: EventItem = {
    id: `events-${EVENT_ID}`,
    rawId: EVENT_ID,
    serviceKey: 'events',
    title: 'رویداد نوآوری',
    badgeText: 'در حال برگزاری',
    badgeType: 'active',
    dates: '۱۲ بهمن',
    location: 'بوشهر',
    hasActionButton: true,
  }

  beforeEach(() => {
    vi.spyOn(dashboardApi, 'getEventCategories').mockResolvedValue({
      items: [{ id: 'cat-1', eventId: EVENT_ID, title: 'دسته', createdAt: '', updatedAt: '' }],
    })
    vi.spyOn(dashboardApi, 'getEventSubtopics').mockResolvedValue({
      items: [
        { id: 'sub-1', eventId: EVENT_ID, categoryId: 'cat-1', categoryTitle: 'دسته', title: 'زیرعنوان اول', employerId: 'employer-1', currentRfpVersionId: null },
        { id: 'sub-2', eventId: EVENT_ID, categoryId: 'cat-1', categoryTitle: 'دسته', title: 'زیرعنوان دوم', employerId: 'employer-1', currentRfpVersionId: null },
      ] satisfies dashboardApi.EventSubtopicDto[],
    })
  })

  it('restores the returned subtopic selection but keeps registration off while verification is pending', async () => {
    mockEligibility('pending')
    render(createElement(EventsView, { initialEventsList: [event], initialSelectedEventId: EVENT_ID, initialSubtopicIds: ['sub-2', 'gone'] }))
    const checkbox = (await screen.findByRole('checkbox', { name: /انتخاب زیرعنوان زیرعنوان دوم/ })) as HTMLInputElement
    await waitFor(() => expect(checkbox.checked).toBe(true))
    expect((await screen.findByTestId('eligibility-state')).getAttribute('data-state')).toBe('pending')
    const register = screen.getByRole('button', { name: /ثبت درخواست \(۱ زیرعنوان\)/ }) as HTMLButtonElement
    expect(register.disabled).toBe(true)
    fireEvent.click(register)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('carries the selected subtopics into the profile return link', async () => {
    mockEligibility('unsubmitted', ['addresses'])
    render(createElement(EventsView, { initialEventsList: [event], initialSelectedEventId: EVENT_ID }))
    fireEvent.click(await screen.findByRole('checkbox', { name: /انتخاب زیرعنوان زیرعنوان اول/ }))
    const link = await screen.findByRole('link', { name: 'تکمیل آدرس‌ها' })
    expect(link.getAttribute('href')).toBe(
      `/dashboard/profile/company?returnTo=${encodeURIComponent(`/dashboard/events?eventId=${EVENT_ID}&subtopicId=sub-1`)}#company-addresses`,
    )
  })

  it('enables registration once the server reports approval', async () => {
    mockEligibility('approved')
    render(createElement(EventsView, { initialEventsList: [event], initialSelectedEventId: EVENT_ID }))
    fireEvent.click(await screen.findByRole('checkbox', { name: /انتخاب زیرعنوان زیرعنوان اول/ }))
    await screen.findByTestId('eligibility-state')
    const register = screen.getByRole('button', { name: /ثبت درخواست \(۱ زیرعنوان\)/ }) as HTMLButtonElement
    await waitFor(() => expect(register.disabled).toBe(false))
    fireEvent.click(register)
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining(`eventId=${EVENT_ID}&subtopicId=sub-1`))
  })
})

describe('NewRequestForm final-submit eligibility', () => {
  const exhibition = { kind: 'exhibition' as const, exhibitionId: '7', boothId: 'b1' }
  const props = {
    serviceId: 'svc-1',
    serviceKey: 'exhibitions',
    title: 'خدمات نمایشگاهی',
    fields: [],
    participation: exhibition,
    returnTo: '/dashboard/new-request?service=exhibitions&eventId=7&boothId=b1',
  }

  beforeEach(() => {
    vi.spyOn(dashboardApi, 'listMyBoothReservations').mockResolvedValue({ items: [] })
    vi.spyOn(dashboardApi, 'createRequest').mockResolvedValue({ request: { id: 'req-1' } as dashboardApi.RequestDto })
  })

  async function createDraft() {
    render(createElement(NewRequestForm, props))
    const create = (await screen.findByRole('button', { name: 'ایجاد پیش‌نویس و ادامه' })) as HTMLButtonElement
    await waitFor(() => expect(create.disabled).toBe(false))
    fireEvent.click(create)
    return (await screen.findByRole('button', { name: 'ثبت و ارسال درخواست' })) as HTMLButtonElement
  }

  it('keeps draft creation disabled until verification is approved', async () => {
    mockEligibility('pending')
    render(createElement(NewRequestForm, props))
    await screen.findByTestId('eligibility-state')
    const create = screen.getByRole('button', { name: 'ایجاد پیش‌نویس و ادامه' }) as HTMLButtonElement
    expect(create.disabled).toBe(true)
    expect(dashboardApi.createRequest).not.toHaveBeenCalled()
  })

  it('re-checks eligibility at final submit and does not submit when verification was withdrawn', async () => {
    const fetchVerification = vi
      .spyOn(dashboardApi, 'fetchCompanyVerification')
      .mockResolvedValueOnce(verification('approved'))
      .mockResolvedValue(verification('returned', { reason: 'تغییر اطلاعات ثبتی' }))
    vi.spyOn(dashboardApi, 'fetchProfileDossier').mockResolvedValue(dossier([]))
    const submit = vi.spyOn(dashboardApi, 'submitRequest')

    const submitButton = await createDraft()
    fireEvent.click(submitButton)
    expect(await screen.findByText(/پس از باز شدن این فرم تغییر کرده/)).toBeDefined()
    expect(submit).not.toHaveBeenCalled()
    expect(fetchVerification.mock.calls.length).toBeGreaterThanOrEqual(2)
    await waitFor(() => expect(screen.getByTestId('eligibility-state').getAttribute('data-state')).toBe('returned'))
    expect(screen.getByRole('link', { name: 'بررسی وضعیت احراز هویت در پروفایل شرکت' }).getAttribute('href')).toBe(
      `/dashboard/profile/company?returnTo=${encodeURIComponent(props.returnTo)}#company-verification`,
    )
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('handles a server denial when verification changes between the re-check and submit', async () => {
    vi.spyOn(dashboardApi, 'fetchCompanyVerification')
      .mockResolvedValueOnce(verification('approved'))
      .mockResolvedValueOnce(verification('approved'))
      .mockResolvedValue(verification('pending'))
    vi.spyOn(dashboardApi, 'fetchProfileDossier').mockResolvedValue(dossier([]))
    vi.spyOn(dashboardApi, 'submitRequest').mockRejectedValue(new dashboardApi.DashboardApiError(403, 'company_not_verified'))

    const submitButton = await createDraft()
    fireEvent.click(submitButton)
    expect(await screen.findByText(/در حین تکمیل فرم تغییر کرده/)).toBeDefined()
    await waitFor(() => expect(screen.getByTestId('eligibility-state').getAttribute('data-state')).toBe('pending'))
    expect((screen.getByRole('button', { name: 'ثبت و ارسال درخواست' }) as HTMLButtonElement).disabled).toBe(true)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('reports a stale (already submitted) submission with a link to the existing request', async () => {
    mockEligibility('approved')
    vi.spyOn(dashboardApi, 'submitRequest').mockRejectedValue(new dashboardApi.DashboardApiError(409, 'already_submitted'))
    const submitButton = await createDraft()
    await waitFor(() => expect(submitButton.disabled).toBe(false))
    fireEvent.click(submitButton)
    expect(await screen.findByText(/این درخواست پیش‌تر ارسال شده است/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'مشاهده وضعیت درخواست' }).getAttribute('href')).toBe('/dashboard/requests/req-1')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('submits and opens the request when the server confirms eligibility', async () => {
    mockEligibility('approved')
    const submit = vi.spyOn(dashboardApi, 'submitRequest').mockResolvedValue({ request: { id: 'req-1' } as dashboardApi.RequestDto })
    const submitButton = await createDraft()
    await waitFor(() => expect(submitButton.disabled).toBe(false))
    fireEvent.click(submitButton)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/requests/req-1'))
    expect(submit).toHaveBeenCalledWith('req-1')
  })
})
