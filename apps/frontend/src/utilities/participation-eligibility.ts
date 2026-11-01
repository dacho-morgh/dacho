/**
 * Participation eligibility (FE06). The server remains the authority: these
 * helpers only explain the state it returned and route the representative to
 * the precise profile section, keeping the intended event/subtopic or booth.
 */
import { getExplicitSafeReturnUrl } from './auth-return-url'
import {
  DashboardApiError,
  dossierFieldLabel,
  type CompanyVerificationDto,
  type MissingDossierItemsDto,
} from './dashboard-api'

export type ParticipationTarget =
  | { kind: 'event'; eventId: string; subtopicIds?: readonly string[] }
  | { kind: 'exhibition'; exhibitionId: string; exhibitionTitle?: string; boothId?: string }

export type EligibilityState =
  | 'incomplete'
  | 'ready_to_request'
  | 'pending'
  | 'returned'
  | 'rejected'
  | 'approved'

export interface Eligibility {
  state: EligibilityState
  /** Whether the UI should offer participation; the server re-checks at submit. */
  canParticipate: boolean
  missingRequired: string[]
  reason: string | null
}

export function deriveEligibility(
  verification: Pick<CompanyVerificationDto, 'status' | 'reason'>,
  missing: Pick<MissingDossierItemsDto, 'required'> | null | undefined,
): Eligibility {
  const missingRequired = [...(missing?.required ?? [])]
  const reason = verification.reason ?? null
  switch (verification.status) {
    case 'approved':
      return { state: 'approved', canParticipate: true, missingRequired: [], reason: null }
    case 'pending':
      return { state: 'pending', canParticipate: false, missingRequired: [], reason: null }
    case 'returned':
      return { state: 'returned', canParticipate: false, missingRequired, reason }
    case 'rejected':
      return { state: 'rejected', canParticipate: false, missingRequired, reason }
    default:
      return {
        state: missingRequired.length > 0 ? 'incomplete' : 'ready_to_request',
        canParticipate: false,
        missingRequired,
        reason: null,
      }
  }
}

/** The page the representative intended to reach before eligibility stopped them. */
export function participationDestination(target: ParticipationTarget): string {
  const params = new URLSearchParams()
  if (target.kind === 'event') {
    params.set('eventId', target.eventId)
    const subtopics = (target.subtopicIds ?? []).filter(Boolean)
    if (subtopics.length > 0) params.set('subtopicId', subtopics.join(','))
    return `/dashboard/events?${params.toString()}`
  }
  params.set('service', 'exhibitions')
  params.set('eventId', target.exhibitionId)
  if (target.exhibitionTitle) params.set('eventTitle', target.exhibitionTitle)
  if (target.boothId) params.set('boothId', target.boothId)
  return `/dashboard/new-request?${params.toString()}`
}

export interface ProfileSection {
  key: 'company-basic' | 'company-documents' | 'company-addresses' | 'resume-products' | 'company-verification'
  title: string
  path: '/dashboard/profile/company' | '/dashboard/profile/resume'
}

const SECTIONS: Record<ProfileSection['key'], ProfileSection> = {
  'company-basic': { key: 'company-basic', title: 'اطلاعات پایه شرکت', path: '/dashboard/profile/company' },
  'company-documents': { key: 'company-documents', title: 'مدارک رسمی شرکت', path: '/dashboard/profile/company' },
  'company-addresses': { key: 'company-addresses', title: 'آدرس‌ها', path: '/dashboard/profile/company' },
  'resume-products': { key: 'resume-products', title: 'محصولات و خدمات (رزومه)', path: '/dashboard/profile/resume' },
  'company-verification': {
    key: 'company-verification',
    title: 'وضعیت احراز هویت شرکت',
    path: '/dashboard/profile/company',
  },
}

const FIELD_SECTION: Record<string, ProfileSection['key']> = {
  registrationNumber: 'company-basic',
  legalEntityType: 'company-basic',
  foundingYear: 'company-basic',
  status: 'company-basic',
  classification: 'company-basic',
  knowledgeBasedStatus: 'company-basic',
  activityDomain: 'company-basic',
  articlesOfAssociation: 'company-documents',
  establishmentNotices: 'company-documents',
  addresses: 'company-addresses',
  productsServices: 'resume-products',
}

export function profileSectionHref(section: ProfileSection['key'], returnTo: string): string {
  const { path } = SECTIONS[section]
  const safe = getExplicitSafeReturnUrl(returnTo)
  const query = safe ? `?returnTo=${encodeURIComponent(safe)}` : ''
  return `${path}${query}#${section}`
}

export interface MissingSectionLink {
  section: ProfileSection
  href: string
  fields: { key: string; label: string }[]
}

/** Groups missing dossier keys by the exact profile section that edits them. */
export function missingSectionLinks(missingRequired: readonly string[], returnTo: string): MissingSectionLink[] {
  const groups = new Map<ProfileSection['key'], MissingSectionLink>()
  for (const key of missingRequired) {
    const sectionKey = FIELD_SECTION[key] ?? 'company-verification'
    let group = groups.get(sectionKey)
    if (!group) {
      group = { section: SECTIONS[sectionKey], href: profileSectionHref(sectionKey, returnTo), fields: [] }
      groups.set(sectionKey, group)
    }
    group.fields.push({ key, label: dossierFieldLabel(key) })
  }
  return [...groups.values()]
}

export type SubmissionFailureKind =
  | 'not_verified'
  | 'stale_rfp'
  | 'already_submitted'
  | 'duplicate'
  | 'session'
  | 'forbidden'
  | 'network'
  | 'other'

export interface SubmissionFailure {
  kind: SubmissionFailureKind
  message: string
}

/** What a refused create/submit means once eligibility may have changed mid-form. */
export function describeSubmissionFailure(cause: unknown, fallback: string): SubmissionFailure {
  if (cause instanceof TypeError) {
    return {
      kind: 'network',
      message: 'ارتباط با سرور برقرار نشد. اطلاعات این صفحه حفظ شده است؛ اتصال را بررسی کنید و دوباره تلاش کنید.',
    }
  }
  if (!(cause instanceof DashboardApiError)) return { kind: 'other', message: fallback }
  if (cause.status === 401) {
    return {
      kind: 'session',
      message: 'نشست شما پایان یافته است. در برگه‌ای دیگر دوباره وارد شوید و سپس همین‌جا ادامه دهید؛ اطلاعات این صفحه حفظ شده است.',
    }
  }
  if (cause.code === 'company_not_verified') {
    return {
      kind: 'not_verified',
      message:
        'وضعیت احراز هویت شرکت شما در حین تکمیل فرم تغییر کرده و دیگر تأییدشده نیست. درخواست ارسال نشد؛ پیش‌نویس حفظ شده است.',
    }
  }
  if (cause.code === 'stale_rfp') {
    return {
      kind: 'stale_rfp',
      message: 'نسخه RFP این زیرعنوان پس از باز شدن فرم تغییر کرده است. نسخه جدید را مطالعه کنید و دوباره ثبت‌نام کنید.',
    }
  }
  if (cause.code === 'already_submitted') {
    return {
      kind: 'already_submitted',
      message: 'این درخواست پیش‌تر ارسال شده است. وضعیت آن را از صفحه پیگیری درخواست ببینید.',
    }
  }
  if (cause.code === 'duplicate_subtopic_request') {
    return {
      kind: 'duplicate',
      message: 'برای این زیرعنوان قبلاً درخواستی ثبت کرده‌اید. پرونده موجود را از فهرست درخواست‌ها ادامه دهید.',
    }
  }
  if (cause.status === 403) {
    return { kind: 'forbidden', message: 'اجازه انجام این کار را ندارید یا دسترسی شما تغییر کرده است.' }
  }
  if (cause.status === 409) {
    return {
      kind: 'other',
      message: 'این مورد پس از باز شدن صفحه تغییر کرده است. صفحه را تازه کنید و وضعیت را دوباره بررسی کنید.',
    }
  }
  return { kind: 'other', message: fallback }
}
