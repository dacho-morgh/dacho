import { dashboardFetch, postJson } from './core'

export type TriageAction = 'accept' | 'return' | 'reject'
export type ReviewDecisionAction = 'advance' | 'return' | 'reject'

const decisionBody = (action: string, reason: string, expectedRevision?: number) => ({
  action,
  ...(reason ? { reason } : {}),
  ...(expectedRevision ? { expectedRevision } : {}),
})

export function decideTriage(id: string, action: TriageAction, reason: string, expectedRevision?: number): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/triage`, postJson(decisionBody(action, reason, expectedRevision)))
}

export function decideReview(id: string, action: ReviewDecisionAction, reason: string, expectedRevision?: number): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/review-decision`, postJson(decisionBody(action, reason, expectedRevision)))
}

export function reopenRequest(id: string, reason: string, expectedRevision?: number): Promise<unknown> {
  return dashboardFetch(
    `/admin/requests/${encodeURIComponent(id)}/reopen`,
    postJson({ reason, ...(expectedRevision ? { expectedRevision } : {}) }),
  )
}

export interface ReviewCandidatesDto {
  items: { id: string; name: string | null }[]
  employerId: string | null
}

export function getReviewCandidates(id: string): Promise<ReviewCandidatesDto> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/review-round/candidates`)
}

export function startReviewRound(id: string, reviewerIds: string[], expectedRevision?: number): Promise<unknown> {
  return dashboardFetch(
    `/requests/${encodeURIComponent(id)}/review-round`,
    postJson({ reviewerIds, ...(expectedRevision ? { expectedRevision } : {}) }),
  )
}

/** Ordinary reviewers the chief may pick, or employers the owner may substitute (T22, T26). */
export function getEmployerCandidates(id: string): Promise<ReviewCandidatesDto> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/review-round/employer-candidates`)
}

const replaceBody = (fields: Record<string, string>, reason: string, expectedRevision?: number) => ({
  ...fields,
  ...(reason ? { reason } : {}),
  ...(expectedRevision ? { expectedRevision } : {}),
})

/** The responsible chief replaces one unfinished ordinary reviewer; the reason is optional. */
export function replaceReviewer(
  id: string,
  outgoingUserId: string,
  replacementId: string,
  reason: string,
  expectedRevision?: number,
): Promise<{ round: ReviewRoundDto }> {
  return dashboardFetch(
    `/requests/${encodeURIComponent(id)}/review-round/reviewers/${encodeURIComponent(outgoingUserId)}/replace`,
    postJson(replaceBody({ replacementId }, reason, expectedRevision)),
  )
}

/** Only the System Owner replaces the case's employer, always with a reason. */
export function replaceEmployer(
  id: string,
  employerId: string,
  reason: string,
  expectedRevision?: number,
): Promise<{ round: ReviewRoundDto }> {
  return dashboardFetch(
    `/requests/${encodeURIComponent(id)}/review-round/employer/replace`,
    postJson(replaceBody({ employerId }, reason, expectedRevision)),
  )
}

export type ReviewSlotKind = 'employer' | 'ordinary'

/** One assignment of a round; revoked ones stay as history. */
export interface ReviewRoundSlotDto {
  assignmentId: string
  userId: string
  role: 'employer-reviewer' | 'reviewer'
  slot: ReviewSlotKind
  active: boolean
  assignedAt: string
  revokedAt: string | null
  revokeReason: string | null
}

export interface ReviewReplacementDto {
  id: string
  slot: ReviewSlotKind
  oldUserId: string
  newUserId: string
  replacedBy: string
  reason: string | null
  replacedAt: string
}

/**
 * Oversight's view of the latest round. Slots and replacements are only sent to the
 * owner, the Secretariat and the case's chief; an older client may omit them.
 */
export interface ReviewRoundDto {
  id: string
  requestRevision: number
  proposalRevision: number
  employerId?: string
  startedAt: string
  supersededAt?: string | null
  completion: { required: number; finalized: number; ready: boolean; completedAt: string | null }
  decision: { action: ReviewDecisionAction; decidedAt: string; reason: string | null; decidedBy?: string } | null
  slots?: ReviewRoundSlotDto[]
  replacements?: ReviewReplacementDto[]
}

/** Unfinished evaluations reach oversight without scores or answers. */
export interface EvaluationSummaryDto {
  id: string
  /** Whose evaluation it is; lets oversight tell a finished slot from an unfinished one. */
  userId?: string
  variant: 'ordinary' | 'employer'
  state: 'draft' | 'final'
  scoreA?: number
  scoreB?: number
  scoreC?: number
  weightedHundredths?: number
  finalizedAt: string | null
}

export interface EvaluationListDto {
  items: EvaluationSummaryDto[]
  completedCount: number
  requiredCount: number
  /** The request revision these evaluations review (`?revision=` reads a past round). */
  revision?: number
  /** The server's readiness for the chief's decision; never a decision by itself. */
  readyForChiefDecision?: boolean
}

/** GET /requests/:id/review-rounds: every round of the case, newest first (oversight only). */
export interface ReviewRoundListDto {
  items: ReviewRoundDto[]
}

/** One earlier round with its own evaluations, read by its request revision. */
export interface ReviewRoundHistoryEntry {
  round: ReviewRoundDto
  evaluations: EvaluationListDto | 'failed'
}
