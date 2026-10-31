import type { CaseAssignmentRole, OperationalRole } from './roles.js'

/** Request actions that a response may advertise and an endpoint may perform. */
export const REQUEST_ACTIONS = [
  'read',
  'submit',
  'assign',
  'triage',
  'startReview',
  'replaceReviewer',
  'replaceEmployer',
  'decideReview',
  'correct',
  'reopen',
  'uploadDocument',
  'deleteDocument',
] as const

export type RequestAction = (typeof REQUEST_ACTIONS)[number]

export interface RequestForPolicy {
  ownerId: string
  companyId?: string | null
  status: string
  /** Set on event applications once submitted; null for drafts and other services. */
  reviewStage?: string | null
  /** True when the actor is the current responsible chief of the request's event. */
  actorIsResponsibleChief?: boolean
  /** True when a review round already exists for the request's current revision. */
  reviewRoundStarted?: boolean
  /** True when that round holds its four final evaluations and awaits the chief's decision. */
  reviewRoundComplete?: boolean
}

/** An event case the responsible chief returned at triage; it is resubmitted as a new revision. */
export function isChiefCorrectionStatus(status: string | null | undefined, reviewStage?: string | null): boolean {
  return status === 'action_needed' && reviewStage === 'chief_triage'
}

/** Company edits are open on drafts and on event cases the chief returned for correction. */
export function isCompanyEditableStatus(status: string | null | undefined, reviewStage?: string | null): boolean {
  return status === 'draft' || isChiefCorrectionStatus(status, reviewStage)
}

/** Only the chief's advancement opens the company's financial package (T29). */
export function isFinancialStageOpen(status: string | null | undefined, reviewStage?: string | null): boolean {
  return status === 'in_review' && reviewStage === 'advanced'
}

/**
 * Request-linked company files. A draft is fully editable; a chief correction
 * reopens the proposal only (UAT12), so files of other categories submitted with
 * the case stay as they were. Financial files change once that stage is open.
 */
function isCompanyChangeableRequestDocument(
  category: DocumentCategory | undefined,
  status: string | null | undefined,
  reviewStage?: string | null,
): boolean {
  if (status === 'draft') return true
  if (category && FINANCIAL_CATEGORIES.includes(category)) return isFinancialStageOpen(status, reviewStage)
  return category === 'proposal' && isChiefCorrectionStatus(status, reviewStage)
}

/**
 * The row scope used for lists, details, counts, search and relationship
 * population. Every one of those reads must pass through this same value.
 */
export type RequestScope =
  | { kind: 'all' }
  | { kind: 'owner'; userId: string }
  | { kind: 'company'; companyId: string; userId?: string }
  | { kind: 'assigned'; userId: string; role: CaseAssignmentRole }
  | { kind: 'none' }

export function requestScopeFor(role: OperationalRole): RequestScope {
  switch (role) {
    case 'system-owner':
    case 'central-secretariat':
      return { kind: 'all' }
    case 'representative':
      return { kind: 'company', companyId: '' }
    case 'chief-reviewer':
    case 'reviewer':
    case 'employer-reviewer':
    case 'investment-reviewer':
      return { kind: 'assigned', userId: '', role }
  }
}

/** Bind a role-only scope to the current actor id and optional company id. */
export function bindRequestScope(
  scope: RequestScope,
  userId: string,
  companyId?: string | null,
): RequestScope {
  if (scope.kind === 'owner') return { ...scope, userId }
  if (scope.kind === 'company') {
    return { ...scope, companyId: companyId ?? '', userId }
  }
  if (scope.kind === 'assigned') return { ...scope, userId }
  return scope
}

/**
 * Server-derived action list. The endpoint authorization checks call this same
 * function, so `allowedActions` cannot drift from what the API will actually
 * permit for the current role, owner and state.
 */
export function allowedRequestActions(
  role: OperationalRole,
  request: RequestForPolicy,
  actorId: string,
  actorCompanyId?: string | null,
): RequestAction[] {
  switch (role) {
    case 'system-owner':
      return [
        'read',
        'assign',
        ...(request.status === 'rejected' && request.reviewStage === 'chief_triage' ? (['reopen'] as const) : []),
        // Only the owner may change a case's employer, and only inside a started round.
        ...(request.status === 'in_review' && request.reviewStage === 'triaged' && request.reviewRoundStarted
          ? (['replaceEmployer'] as const)
          : []),
        'uploadDocument',
        'deleteDocument',
      ]
    case 'central-secretariat':
      return ['read', 'uploadDocument']
    case 'chief-reviewer':
      // Triage and the review round belong to the event's current responsible chief.
      if (!request.actorIsResponsibleChief || request.status !== 'in_review') return ['read']
      if (request.reviewStage === 'chief_triage') return ['read', 'triage']
      if (request.reviewStage === 'triaged') {
        if (!request.reviewRoundStarted) return ['read', 'startReview']
        // Every slot of a complete round is final, so nobody is left to replace.
        return request.reviewRoundComplete ? ['read', 'decideReview'] : ['read', 'replaceReviewer']
      }
      return ['read']
    case 'reviewer':
    case 'employer-reviewer':
    case 'investment-reviewer':
      // Future evaluation/memo actions are not implemented; do not
      // advertise routes that do not exist yet.
      return ['read']
    case 'representative': {
      const belongsToCompany = Boolean(
        request.companyId && actorCompanyId && request.companyId === actorCompanyId,
      ) || (!request.companyId && request.ownerId === actorId)
      if (!belongsToCompany) return []
      const actions: RequestAction[] = ['read']
      if (request.status === 'draft') actions.push('submit', 'uploadDocument', 'deleteDocument')
      else if (isCompanyEditableStatus(request.status, request.reviewStage)) {
        actions.push('correct', 'uploadDocument', 'deleteDocument')
      } else if (isFinancialStageOpen(request.status, request.reviewStage)) {
        actions.push('uploadDocument', 'deleteDocument')
      }
      return actions
    }
  }
}

export function canRequestAction(
  role: OperationalRole,
  request: RequestForPolicy,
  actorId: string,
  action: RequestAction,
  actorCompanyId?: string | null,
): boolean {
  return allowedRequestActions(role, request, actorId, actorCompanyId).includes(action)
}

/* ── Private document policy (docs/system/document-policy.json) ─────────── */

export const DOCUMENT_POLICY_VERSION = 'private-documents-2026-10-23-v1'
export const MAX_DOCUMENT_BYTES = 10_000_000
export const DOCUMENT_SIZE_DISPLAY = '10 MB per file'

export const DOCUMENT_CATEGORIES = [
  'rfp',
  'proposal',
  'articlesOfAssociation',
  'establishmentNotices',
  'amendmentNotices',
  'catalogues',
  'certificatesLicenses',
  'financialStatements',
  'debtFacilityEvidence',
  'taxInsuranceRecords',
  'contractsOrdersMousCommitments',
  'projectEstimateUseOfFunds',
  'guaranteeCollateral',
  'supplementaryCaseFiles',
  'boothPaymentReceipt',
  'correspondenceAttachment',
] as const

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

export function isDocumentCategory(value: unknown): value is DocumentCategory {
  return typeof value === 'string' && (DOCUMENT_CATEGORIES as readonly string[]).includes(value)
}

export interface DocumentTypeRule {
  format: 'PDF' | 'Word'
  extension: '.pdf' | '.doc' | '.docx'
  mimeType: string
}

export const ALLOWED_DOCUMENT_TYPES: readonly DocumentTypeRule[] = [
  { format: 'PDF', extension: '.pdf', mimeType: 'application/pdf' },
  { format: 'Word', extension: '.doc', mimeType: 'application/msword' },
  {
    format: 'Word',
    extension: '.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
]

export type DocumentAudience = 'company' | 'case' | 'financial' | 'unsupported'

/**
 * Categories whose prerequisite workflow does not exist yet stay denied rather
 * than becoming permissive stubs: RFP/versioning is T18, supplementary files T33,
 * and booth receipts T50. T35 supports request-linked correspondence.
 */
export const UNSUPPORTED_DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  'rfp',
  'supplementaryCaseFiles',
  'boothPaymentReceipt',
]

const COMPANY_CATEGORIES: readonly DocumentCategory[] = [
  'articlesOfAssociation',
  'establishmentNotices',
  'amendmentNotices',
  'catalogues',
  'certificatesLicenses',
]

export const FINANCIAL_CATEGORIES: readonly DocumentCategory[] = [
  'financialStatements',
  'debtFacilityEvidence',
  'taxInsuranceRecords',
  'contractsOrdersMousCommitments',
  'projectEstimateUseOfFunds',
  'guaranteeCollateral',
]

export function documentAudience(category: DocumentCategory): DocumentAudience {
  if (UNSUPPORTED_DOCUMENT_CATEGORIES.includes(category)) return 'unsupported'
  if (COMPANY_CATEGORIES.includes(category)) return 'company'
  if (FINANCIAL_CATEGORIES.includes(category)) return 'financial'
  return 'case'
}

export interface DocumentParent {
  /** The acting company, when the document belongs to a company dossier. */
  companyId?: string | null
  /** The owning representative of the request, when request-scoped. */
  requestOwnerId?: string | null
  /** The company that owns the request. */
  requestCompanyId?: string | null
  requestStatus?: string | null
  requestReviewStage?: string | null
  /** True when the current actor holds an active assignment on the request. */
  assigned?: boolean
}

/**
 * Upload authority. Company dossier categories require a company parent;
 * proposal/financial categories require a request parent. A representative may
 * only add files to its own company/request. Chief/reviewer/employer/investment
 * roles never upload here; their future workflow actions create records through
 * separate commands.
 */
export function canUploadOwnedDocument(
  role: OperationalRole,
  category: DocumentCategory,
  parent: DocumentParent,
  actorId: string,
  actorCompanyId: string | null,
): boolean {
  const audience = documentAudience(category)
  if (audience === 'unsupported') return false
  if (audience === 'company' && !parent.companyId) return false
  if (audience !== 'company' && !parent.requestOwnerId && !parent.requestCompanyId) return false
  if (role === 'system-owner' || role === 'central-secretariat') return true
  if (role !== 'representative') return false
  if (audience === 'company') {
    return Boolean(parent.companyId && parent.companyId === actorCompanyId)
  }
  const ownsRequest = Boolean(
    (parent.requestCompanyId && actorCompanyId && parent.requestCompanyId === actorCompanyId) ||
    (!parent.requestCompanyId && parent.requestOwnerId === actorId)
  )
  if (!ownsRequest) return false
  // Draft-only company editing keeps submitted/financial snapshots immutable
  // until T30 introduces versioned package submissions.
  // Supplementary correspondence is additive and does not edit submitted files.
  if (category === 'correspondenceAttachment') {
    return true
  }
  if (audience === 'financial') return isFinancialStageOpen(parent.requestStatus, parent.requestReviewStage)
  return (
    parent.requestStatus === undefined ||
    parent.requestStatus === null ||
    isCompanyChangeableRequestDocument(category, parent.requestStatus, parent.requestReviewStage)
  )
}

export interface DocumentForPolicy {
  category: DocumentCategory
  companyId: string | null
  requestId: string | null
  requestOwnerId: string | null
  requestCompanyId: string | null
  assigned: boolean
}

/**
 * Download/list authority, re-evaluated on every request. A document id or URL
 * is never authority. Financial categories are excluded for chief, ordinary and
 * employer reviewers even when those people are assigned to the case.
 */
export function canReadDocument(
  role: OperationalRole,
  document: DocumentForPolicy,
  actorId: string,
  actorCompanyId: string | null,
): boolean {
  const audience = documentAudience(document.category)
  if (audience === 'unsupported') return false

  switch (role) {
    case 'system-owner':
    case 'central-secretariat':
      return true
    case 'representative': {
      if (document.requestId) {
        if (document.requestCompanyId) {
          return Boolean(actorCompanyId && document.requestCompanyId === actorCompanyId)
        }
        // Legacy unmigrated request without companyId: fallback to creator
        return document.requestOwnerId === actorId
      }
      // Standalone dossier document:
      if (audience === 'company') {
        return Boolean(document.companyId && actorCompanyId && document.companyId === actorCompanyId)
      }
      return false
    }
    case 'chief-reviewer':
    case 'reviewer':
    case 'employer-reviewer':
      if (document.category === 'correspondenceAttachment') return false
      return document.assigned && audience === 'case'
    case 'investment-reviewer':
      // Supplementary financial replies need the same persisted handoff as the
      // financial package. Generic assignment must not bypass that boundary.
      if (document.category === 'correspondenceAttachment') return false
      return document.assigned && audience === 'case'
  }
}

export function canDeleteDocument(
  role: OperationalRole,
  document: {
    requestOwnerId: string | null
    requestCompanyId?: string | null
    requestStatus: string | null
    requestReviewStage?: string | null
    /** Needed outside drafts: a chief correction only reopens proposal files. */
    category?: DocumentCategory
  },
  actorId: string,
  actorCompanyId?: string | null,
): boolean {
  if (role === 'system-owner') return true
  if (role !== 'representative') return false
  if (!isCompanyChangeableRequestDocument(document.category, document.requestStatus, document.requestReviewStage)) {
    return false
  }
  if (document.requestCompanyId) {
    return Boolean(actorCompanyId && document.requestCompanyId === actorCompanyId)
  }
  return document.requestOwnerId === actorId
}
