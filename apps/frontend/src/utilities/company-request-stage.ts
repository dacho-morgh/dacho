/**
 * The company-facing stage of a request (design QA #280). A company sees three
 * stages only; the secretariat's and the reviewers' internal stages are folded
 * into them here, in one place. Staff views never call this: they keep the real
 * status and review stage.
 *
 * It is a pure naming of what the server already recorded (status + review
 * stage); it never decides a transition.
 *
 * The API filters and counts by the same table (`phase` on `GET /requests` and `GET /stats`,
 * `apps/backend/src/dashboard/company-request-phase.ts`). The backend test
 * `company-request-phase.spec.ts` imports this file and fails when the two disagree: change both.
 */

/** The request statuses the server knows (`dashboard.requests.status`). */
export const INTERNAL_REQUEST_STATUSES = ['draft', 'in_review', 'action_needed', 'approved', 'rejected'] as const
export type InternalRequestStatus = (typeof INTERNAL_REQUEST_STATUSES)[number]

/** The review stages the server knows (`dashboard.requests.review_stage`). */
export const INTERNAL_REVIEW_STAGES = ['chief_triage', 'triaged', 'advanced'] as const
export type InternalReviewStage = (typeof INTERNAL_REVIEW_STAGES)[number]

export const COMPANY_REQUEST_STAGES = ['verification', 'reviewing', 'finished'] as const
export type CompanyRequestStage = (typeof COMPANY_REQUEST_STAGES)[number]

export const COMPANY_REQUEST_STAGE_LABELS: Record<CompanyRequestStage, string> = {
  verification: 'احراز هویت',
  reviewing: 'در حال داوری',
  finished: 'تمام‌شده (نتیجهٔ نهایی)',
}

/**
 * Typed records, so a status or review stage added to the unions above fails the
 * type check until it is mapped. `null` means "decided by the review stage".
 */
const STAGE_BY_STATUS: Record<InternalRequestStatus, CompanyRequestStage | null> = {
  draft: 'verification',
  in_review: null,
  action_needed: null,
  approved: 'finished',
  rejected: 'finished',
}

const STAGE_BY_REVIEW_STAGE: Record<InternalReviewStage, CompanyRequestStage> = {
  chief_triage: 'verification',
  triaged: 'reviewing',
  advanced: 'reviewing',
}

const isStatus = (value: unknown): value is InternalRequestStatus =>
  typeof value === 'string' && Object.hasOwn(STAGE_BY_STATUS, value)
const isReviewStage = (value: unknown): value is InternalReviewStage =>
  typeof value === 'string' && Object.hasOwn(STAGE_BY_REVIEW_STAGE, value)

/**
 * Where the company should read its request. A value this client does not know
 * (a stage added by a newer server) reads as «در حال داوری»: it is never shown
 * as finished or as a missing label.
 */
export function companyRequestStage(request: { status: string; reviewStage?: string | null }): CompanyRequestStage {
  if (!isStatus(request.status)) return 'reviewing'
  const fixed = STAGE_BY_STATUS[request.status]
  if (fixed) return fixed
  return isReviewStage(request.reviewStage) ? STAGE_BY_REVIEW_STAGE[request.reviewStage] : 'reviewing'
}

export function companyRequestStageLabel(request: { status: string; reviewStage?: string | null }): string {
  return COMPANY_REQUEST_STAGE_LABELS[companyRequestStage(request)]
}

/** The `phase` value of a company filter URL, or nothing for anything else. */
export function parseCompanyRequestStage(value?: string | string[]): CompanyRequestStage | undefined {
  return typeof value === 'string' && (COMPANY_REQUEST_STAGES as readonly string[]).includes(value)
    ? (value as CompanyRequestStage)
    : undefined
}

/** The choices of the company's stage filter. */
export const COMPANY_REQUEST_STAGE_FILTER_OPTIONS: { value: CompanyRequestStage | 'all'; label: string }[] = [
  { value: 'all', label: 'همه' },
  ...COMPANY_REQUEST_STAGES.map((value) => ({ value, label: COMPANY_REQUEST_STAGE_LABELS[value] })),
]
