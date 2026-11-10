/**
 * The company's view of its own application (FE13). Every value comes from the
 * server's case response: status, review stage, revision, `allowedActions` and
 * the transition rows of the history. Nothing here decides a transition; it only
 * names what the server already recorded, in Persian.
 */
import { companyRequestStageLabel } from './company-request-stage'
import type { ActivityDto, RequestAction, RequestDto } from './dashboard-api'

type TrackedRequest = Pick<RequestDto, 'status' | 'reviewStage' | 'currentStep'> & {
  allowedActions?: RequestAction[]
}

/**
 * Where the case is, as the company reads it: one of the three company stages
 * (design QA #280). Internal secretariat and review stages never reach the company.
 */
export function companyStageLabel(request: TrackedRequest): string {
  return companyRequestStageLabel(request)
}

/** The single next step the server leaves to the company, or that none is expected. */
export function companyNextAction(request: TrackedRequest): string {
  const actions = request.allowedActions ?? []
  if (actions.includes('submit')) return 'تکمیل و ارسال پیش‌نویس'
  if (actions.includes('correct')) return 'اصلاح پرونده و ارسال دوباره'
  if (actions.includes('submitFinancialPackage')) return 'بارگذاری و ارسال بسته مالی'
  if (request.status === 'rejected') return 'اقدامی از شما لازم نیست'
  return 'منتظر بررسی؛ اقدامی از شما لازم نیست'
}

const RETURN_ACTIONS = new Set(['chief_return', 'chief_review_return'])
const REJECT_ACTIONS = new Set(['chief_reject', 'chief_review_reject'])

export type TrackingOutcome =
  | {
      kind: 'correction'
      /** `review`: returned after the four evaluations, so a new review round follows the correction. */
      after: 'triage' | 'review'
      reason: string | null
      at: string
    }
  | { kind: 'rejected'; after: 'triage' | 'review'; reason: string | null; at: string }
  | { kind: 'reopened'; reason: string | null; at: string }
  | {
      kind: 'resubmitted'
      /** True when the correction answered a post-review return, so another round follows triage. */
      newRound: boolean
      revision: number | null
      at: string
    }
  | null

function newestFirst(timeline: readonly ActivityDto[]): ActivityDto[] {
  return [...timeline].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

function reasonOf(activity: ActivityDto): string | null {
  const reason = activity.reason ?? activity.description
  return typeof reason === 'string' && reason.trim() ? reason : null
}

/**
 * The outcome the company must see for the current state: a return with its
 * reason, a final rejection with its reason, an owner's reopen, or a
 * resubmitted correction. It reads the server's own transition rows and never
 * infers one the server did not record.
 */
export function trackingOutcome(request: TrackedRequest, timeline: readonly ActivityDto[]): TrackingOutcome {
  const rows = newestFirst(timeline).filter((row) => typeof row.action === 'string' && row.action)
  if (request.status === 'action_needed' && request.reviewStage === 'chief_triage') {
    const returned = rows.find((row) => RETURN_ACTIONS.has(row.action!))
    if (!returned) return null
    return {
      kind: 'correction',
      after: returned.action === 'chief_review_return' ? 'review' : 'triage',
      reason: reasonOf(returned),
      at: returned.at,
    }
  }
  if (request.status === 'rejected') {
    const rejected = rows.find((row) => REJECT_ACTIONS.has(row.action!))
    if (!rejected) return null
    return {
      kind: 'rejected',
      after: rejected.action === 'chief_review_reject' ? 'review' : 'triage',
      reason: reasonOf(rejected),
      at: rejected.at,
    }
  }
  const latest = rows[0]
  if (!latest || request.status !== 'in_review' || request.reviewStage !== 'chief_triage') return null
  if (latest.action === 'owner_reopen') return { kind: 'reopened', reason: reasonOf(latest), at: latest.at }
  if (latest.action === 'correction_submit') {
    const answered = rows.slice(1).find((row) => RETURN_ACTIONS.has(row.action!))
    return {
      kind: 'resubmitted',
      newRound: answered?.action === 'chief_review_return',
      revision: latest.revision ?? null,
      at: latest.at,
    }
  }
  return null
}

const CORRECTION_FIXED_LABELS: Record<string, string> = {
  applicationTeam: 'اعضای کلیدی تیم',
  proposalDocuments: 'فایل پروپوزال',
  nonCompeteAcceptance: 'پذیرش توافق‌نامه عدم رقابت',
  eventRulesAcceptance: 'پذیرش قوانین رویداد',
}

/** Persian names of fields a correction refusal reported missing. */
export function correctionMissingLabels(missing: readonly string[], fieldLabels: Record<string, string>): string[] {
  return missing.map((key) => CORRECTION_FIXED_LABELS[key] ?? fieldLabels[key] ?? key)
}

export type CorrectionFailure = {
  kind: 'stale' | 'not_verified' | 'missing' | 'denied' | 'session' | 'network' | 'other'
  message: string
}

interface ApiRefusal {
  status: number
  code: string
  missingFields: string[]
}

/** A `DashboardApiError` (checked by shape, so this module stays free of runtime imports). */
function isApiError(value: unknown): value is ApiRefusal {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ApiRefusal>
  return typeof candidate.status === 'number' && typeof candidate.code === 'string' && Array.isArray(candidate.missingFields)
}

/** What a refused correction means, with the typed input kept on screen. */
export function describeCorrectionFailure(
  cause: unknown,
  fieldLabels: Record<string, string>,
): CorrectionFailure {
  if (cause instanceof TypeError) {
    return { kind: 'network', message: 'ارتباط با سرور برقرار نشد. اطلاعات واردشده حفظ شده است؛ دوباره تلاش کنید.' }
  }
  if (!isApiError(cause)) {
    return { kind: 'other', message: 'ارسال اصلاحیه انجام نشد. اطلاعات واردشده حفظ شده است؛ دوباره تلاش کنید.' }
  }
  if (cause.code === 'not_correctable' || cause.code === 'request_not_draft' || cause.status === 409) {
    return {
      kind: 'stale',
      message:
        'این پرونده دیگر در وضعیت اصلاح نیست؛ ممکن است اصلاحیه پیش‌تر ارسال شده یا وضعیت آن تغییر کرده باشد. وضعیت تازه پرونده نمایش داده شد و متن واردشده حفظ شده است.',
    }
  }
  if (cause.code === 'company_not_verified') {
    return {
      kind: 'not_verified',
      message: 'احراز هویت شرکت شما دیگر تأییدشده نیست. اصلاحیه ارسال نشد؛ اطلاعات واردشده حفظ شده است.',
    }
  }
  if (cause.code === 'invalid_answers' && cause.missingFields.length > 0) {
    return {
      kind: 'missing',
      message: `موارد زیر هنوز کامل نشده است: ${correctionMissingLabels(cause.missingFields, fieldLabels).join('، ')}. اطلاعات واردشده حفظ شده است.`,
    }
  }
  if (cause.code === 'invalid_answers') {
    return { kind: 'missing', message: 'برخی از پاسخ‌ها معتبر نیست. موارد فرم را بررسی کنید؛ اطلاعات واردشده حفظ شده است.' }
  }
  if (cause.status === 401) {
    return { kind: 'session', message: 'نشست شما پایان یافته است. دوباره وارد شوید؛ اطلاعات این صفحه حفظ شده است.' }
  }
  if (cause.status === 403 || cause.status === 404) {
    return { kind: 'denied', message: 'اجازه اصلاح این پرونده را ندارید یا دسترسی شما تغییر کرده است.' }
  }
  return { kind: 'other', message: 'ارسال اصلاحیه انجام نشد. اطلاعات واردشده حفظ شده است؛ دوباره تلاش کنید.' }
}
