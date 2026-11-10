import type { CompanyRequestStage } from '../company-request-stage'

export type RequestStatus = 'draft' | 'in_review' | 'action_needed' | 'approved' | 'rejected'
export type LetterType = 'rejected' | 'approved' | 'needs_fix' | 'official' | 'notification'

/** Server-derived per role and stage; a control appears only for an action listed here. */
export type RequestAction =
  | 'read'
  | 'submit'
  | 'correct'
  | 'assign'
  | 'reopen'
  | 'triage'
  | 'startReview'
  | 'replaceReviewer'
  | 'replaceEmployer'
  | 'decideReview'
  | 'submitFinancialPackage'
  | 'uploadDocument'
  | 'deleteDocument'

export interface RequestDto {
  id: string
  trackingCode: string
  title: string
  serviceId: string
  serviceKey: string
  serviceName: string
  ownerId: string
  status: RequestStatus
  reviewStage?: string | null
  revision?: number
  currentStepIndex: number
  assignedRole: string | null
  currentStep: string | null
  answers: Record<string, unknown>
  submissionDate: string | null
  dueDate: string | null
  submittedBy?: string | null
  createdAt: string
  updatedAt: string
  allowedActions?: RequestAction[]
}

export interface LetterDto {
  id: string
  type: LetterType
  title: string
  body: string
  senderId: string | null
  senderName: string | null
  senderRole: string | null
  recipientId: string
  requestId: string | null
  read: boolean
  sentAt: string
  attachments: unknown[]
  /** What the recipient is expected to do next on the case (S1 inbox); null for plain letters. */
  nextStep?: string | null
  /** The step is still pending for the recipient. */
  actionRequired?: boolean
  /** Booth request notices (S7) name the booth request and its exhibition instead of a request. */
  boothReservationId?: string | null
  exhibitionId?: string | null
  createdAt: string
  updatedAt: string
}

export interface ActivityDto {
  id: string
  ownerId: string
  requestId: string | null
  letterId: string | null
  type: string
  title: string
  description: string | null
  at: string
  /** Transition rows: the server's action key, the reason it recorded and the case revision it produced. */
  action?: string | null
  reason?: string | null
  revision?: number | null
}

export interface RequestStats {
  total: number
  in_review: number
  approved: number
  action_needed: number
  rejected: number
  /**
   * The same rows by company-facing stage (#280), folded by the server with the table of
   * `company-request-stage.ts`. Optional so an older server reads as "no count", never as zero.
   */
  phases?: Record<CompanyRequestStage, number>
}

/** A queue the backend counts for the current role; an unknown key is never shown. */
export interface WorkQueueCountDto {
  key: string
  count: number
}

/** GET /stats/overview: every number comes from the actor's own row scope. */
export interface DashboardOverviewDto {
  counts: RequestStats
  queues: WorkQueueCountDto[]
  events: { id: string; title: string }[]
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface CompanyInfoDto {
  name: string
  establishmentDate: string
  status: string
  type: string
  registrationNumber: string
  economicCode: string
  nationalId: string
  /** Optional for responses from a backend that predates them. */
  province?: string
  city?: string
}

export interface ContactInfoDto {
  phone: string
  email: string
}

export interface ExecutiveDto {
  role: string
  name: string
}

export interface AddressDto {
  id: string
  title: string
  province: string
  city: string
  postalCode: string
  address: string
}

export interface ProfileDto {
  company: CompanyInfoDto
  contacts: ContactInfoDto
  executives: ExecutiveDto[]
  addresses: AddressDto[]
  companyId?: string | null
}

/** Safe projection for the current internal user's read-only personal profile. */
export interface DashboardOwnProfileDto {
  name: string
  position: string
  role: string
  contacts: ContactInfoDto
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'پیش‌نویس',
  in_review: 'درحال بررسی',
  action_needed: 'نیازمند اقدام',
  approved: 'تایید شده',
  rejected: 'رد شده',
}

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  rejected: 'رد درخواست',
  approved: 'تایید درخواست',
  needs_fix: 'نیاز به اصلاح',
  official: 'نامه رسمی',
  notification: 'اطلاع رسانی',
}

/** Machine key → display name, for denormalizing a request's `serviceKey`. */
export const SERVICE_KEY_LABELS: Record<string, string> = {
  financing: 'تأمین مالی و سرمایه‌گذاری',
  events: 'رویدادها و رقابت‌ها',
  exhibitions: 'خدمات نمایشگاهی',
  knowledge: 'خدمات دانش‌بنیانی',
  commercialization: 'تجاری‌سازی و ورود به بازار',
}

const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Formats an ISO timestamp as a Jalali date (falls back to a raw slice). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return persianDate.format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

const persianWeekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' })
const persianTime = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })

export function formatWeekday(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return persianWeekday.format(new Date(iso))
  } catch {
    return ''
  }
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return persianTime.format(new Date(iso))
  } catch {
    return ''
  }
}

export function serviceNameFor(serviceKey: string): string {
  return SERVICE_KEY_LABELS[serviceKey] ?? serviceKey
}

export class DashboardApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    /** Field names a validation refusal reported (e.g. `invalid_answers`); empty otherwise. */
    public missingFields: string[] = [],
  ) {
    super(code)
  }
}

/**
 * What a failed write means to the person, with the input they typed still on screen.
 * Session, permission and stale-version failures each ask for a different next step,
 * and a dropped connection is not the server's refusal.
 */
export function describeMutationFailure(cause: unknown, fallback: string): string {
  if (cause instanceof TypeError) return 'ارتباط با سرور برقرار نشد. اطلاعات این صفحه حفظ شده است؛ اتصال را بررسی کنید و دوباره تلاش کنید.'
  if (!(cause instanceof DashboardApiError)) return fallback
  if (cause.status === 401) return 'نشست شما پایان یافته است. در برگه‌ای دیگر دوباره وارد شوید و سپس همین‌جا ادامه دهید؛ اطلاعات این صفحه حفظ شده است.'
  if (cause.status === 403) return 'اجازه انجام این کار را ندارید یا دسترسی شما تغییر کرده است.'
  if (cause.status === 409) return 'این مورد پس از باز شدن صفحه تغییر کرده است. صفحه را تازه کنید و وضعیت را دوباره بررسی کنید.'
  return fallback
}

export async function dashboardFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/dashboard${path}`, { cache: 'no-store', ...init })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; missingFields?: unknown } | null
    throw new DashboardApiError(
      res.status,
      typeof body?.error === 'string' ? body.error : 'request_failed',
      Array.isArray(body?.missingFields)
        ? body.missingFields.filter((field): field is string => typeof field === 'string')
        : [],
    )
  }
  return res.json() as Promise<T>
}

/* ── Secretariat follow-up and published result (T33) ─────────────────── */

export const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
