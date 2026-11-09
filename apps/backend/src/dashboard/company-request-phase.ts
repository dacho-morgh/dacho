/**
 * The company-facing phase of a request (design QA #280). A company reads its requests in three
 * phases only; the secretariat's and the reviewers' internal stages fold into them here, in one
 * place. The list filter (`GET /requests?phase=`), the counts (`GET /stats`) and the frontend's
 * `companyRequestStage` all use this one table; `tests/company-request-phase.spec.ts` asserts the
 * frontend's copy names the same phase for every status × review stage.
 *
 * | status                     | review stage              | phase          |
 * | -------------------------- | ------------------------- | -------------- |
 * | `draft`                    | any                       | `verification` |
 * | `in_review`, `action_needed` | `chief_triage`          | `verification` |
 * | `in_review`, `action_needed` | `triaged`, `advanced`   | `reviewing`    |
 * | `in_review`, `action_needed` | none                    | `reviewing`    |
 * | `approved`, `rejected`     | any                       | `finished`     |
 * | anything else              | any                       | `reviewing`    |
 *
 * It only names what the server already recorded; it never decides a transition. An unknown value
 * reads as `reviewing`, never as finished.
 */
import type { RequestStatus, ReviewStage } from './request-repo.js'

export const COMPANY_REQUEST_PHASES = ['verification', 'reviewing', 'finished'] as const
export type CompanyRequestPhase = (typeof COMPANY_REQUEST_PHASES)[number]

/** Where a status or review stage the table does not name reads. */
export const FALLBACK_COMPANY_REQUEST_PHASE: CompanyRequestPhase = 'reviewing'

/**
 * Typed records, so a status or review stage added to the unions fails the type check until it is
 * mapped. `null` means "decided by the review stage".
 */
export const PHASE_BY_STATUS: Readonly<Record<RequestStatus, CompanyRequestPhase | null>> = {
  draft: 'verification',
  in_review: null,
  action_needed: null,
  approved: 'finished',
  rejected: 'finished',
}

export const PHASE_BY_REVIEW_STAGE: Readonly<Record<ReviewStage, CompanyRequestPhase>> = {
  chief_triage: 'verification',
  triaged: 'reviewing',
  advanced: 'reviewing',
}

export function isCompanyRequestPhase(value: unknown): value is CompanyRequestPhase {
  return typeof value === 'string' && (COMPANY_REQUEST_PHASES as readonly string[]).includes(value)
}

/** The phase of one request, from its stored status and review stage. */
export function companyRequestPhase(request: { status: string; reviewStage?: string | null }): CompanyRequestPhase {
  if (!Object.hasOwn(PHASE_BY_STATUS, request.status)) return FALLBACK_COMPANY_REQUEST_PHASE
  const fixed = PHASE_BY_STATUS[request.status as RequestStatus]
  if (fixed) return fixed
  const stage = request.reviewStage
  return typeof stage === 'string' && Object.hasOwn(PHASE_BY_REVIEW_STAGE, stage)
    ? PHASE_BY_REVIEW_STAGE[stage as ReviewStage]
    : FALLBACK_COMPANY_REQUEST_PHASE
}

/** The table's values are fixed identifiers, inlined into SQL; refuse anything that is not one. */
function literal(value: string): string {
  if (!/^[a-z_]+$/.test(value)) throw new Error(`Unsafe phase mapping value: ${value}`)
  return `'${value}'`
}

/**
 * The same table as a SQL expression over a `dashboard.requests` row, built from the records
 * above so the two cannot drift.
 */
export function companyRequestPhaseSql(alias = 'r'): string {
  const entries = Object.entries(PHASE_BY_STATUS) as [RequestStatus, CompanyRequestPhase | null][]
  const fixed = entries.filter(([, phase]) => phase !== null)
  const byStage = entries.filter(([, phase]) => phase === null).map(([status]) => literal(status))
  const branches = fixed.map(([status, phase]) => `WHEN ${alias}.status = ${literal(status)} THEN ${literal(phase!)}`)
  if (byStage.length) {
    for (const [stage, phase] of Object.entries(PHASE_BY_REVIEW_STAGE)) {
      branches.push(
        `WHEN ${alias}.status IN (${byStage.join(', ')}) AND ${alias}.review_stage = ${literal(stage)} THEN ${literal(phase)}`,
      )
    }
  }
  return `(CASE ${branches.join(' ')} ELSE ${literal(FALLBACK_COMPANY_REQUEST_PHASE)} END)`
}
