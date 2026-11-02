// Types and pure helpers for the assigned reviewer/employer queue and case file
// (T23 `GET /review/queue`, `GET /review/cases/:id`). Every value here is what
// the server returned for this person: the browser derives labels only and never
// decides who may see a case.

import type { OperationalRole } from '@cms-core/access/roles'

export type ReviewerRole = 'reviewer' | 'employer-reviewer'
export type ReviewQueueView = 'open' | 'closed' | 'all'

export function isReviewerRole(role: OperationalRole | string | null | undefined): role is ReviewerRole {
  return role === 'reviewer' || role === 'employer-reviewer'
}

export function parseReviewQueueView(value: string | string[] | undefined): ReviewQueueView {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === 'closed' || raw === 'all' ? raw : 'open'
}

export function parseReviewQueuePage(value: string | string[] | undefined): number {
  const raw = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(raw) && raw > 0 ? Math.min(raw, 1_000_000) : 1
}

export function reviewQueueHref(view: ReviewQueueView, page = 1): string {
  const params = new URLSearchParams()
  if (view !== 'open') params.set('view', view)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return `/dashboard/requests${query ? `?${query}` : ''}`
}

export interface OwnEvaluationSummaryDto {
  state: 'draft' | 'final'
  revision: number
  updatedAt: string
  finalizedAt: string | null
}

export interface ReviewQueueItemDto {
  requestId: string
  trackingCode: string
  title: string
  revision: number
  status: string
  reviewStage: string | null
  submissionDate: string | null
  event: { id: string; title: string } | null
  subtopic: { id: string; title: string } | null
  companyName: string | null
  assignment: { role: ReviewerRole; slot: 'employer' | 'ordinary' | null; assignedAt: string }
  round: { id: string; requestRevision: number; proposalRevision: number; current: boolean } | null
  proposalRevision: number | null
  actionable: boolean
  /** The caller's own evaluation only; never answers, scores or anyone else's. */
  evaluation: OwnEvaluationSummaryDto | null
}

export interface ReviewQueueDto {
  items: ReviewQueueItemDto[]
  total: number
  page: number
  totalPages: number
  counts: { open: number; closed: number; all: number }
}

export interface ReviewCaseDocumentDto {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  logicalVersion?: number
  createdAt?: string
  downloadUrl?: string
}

export interface ReviewCaseFileDto {
  case: ReviewQueueItemDto
  proposal: {
    revision: number
    formVersion: string
    applicationTeam: { name: string; role: string; relation?: string }[]
    answers: Record<string, unknown> | null
    documents: ReviewCaseDocumentDto[]
    createdAt: string
  } | null
  rfp: { versionId: string; files: ReviewCaseDocumentDto[] } | null
  company: {
    company: Record<string, unknown>
    dossier: Record<string, unknown>
  } | null
}

export const REVIEW_QUEUE_VIEWS: { value: ReviewQueueView; label: string }[] = [
  { value: 'open', label: 'در انتظار ارزیابی' },
  { value: 'closed', label: 'بسته‌شده' },
  { value: 'all', label: 'همه' },
]

export function reviewerRoleLabel(item: Pick<ReviewQueueItemDto, 'assignment'>): string {
  return item.assignment.role === 'employer-reviewer' || item.assignment.slot === 'employer'
    ? 'کارفرما'
    : 'داور'
}

/** The caller's own evaluation state, never a score. */
export function ownEvaluationLabel(evaluation: OwnEvaluationSummaryDto | null): string {
  if (!evaluation) return 'شروع نشده'
  return evaluation.state === 'final' ? 'ارزیابی نهایی شده' : 'پیش‌نویس ذخیره شده'
}

export type ReviewWorkState = 'open' | 'superseded' | 'closed'

/**
 * Open while the server marks it actionable. A round that no longer covers the
 * request's revision is superseded: what is shown is the revision this person
 * reviewed, not a newer one.
 */
export function reviewWorkState(item: Pick<ReviewQueueItemDto, 'actionable' | 'round'>): ReviewWorkState {
  if (item.actionable) return 'open'
  if (item.round && !item.round.current) return 'superseded'
  return 'closed'
}

export const REVIEW_WORK_STATE_LABELS: Record<ReviewWorkState, string> = {
  open: 'در انتظار ارزیابی شما',
  superseded: 'نسخه جدیدتری از پرونده ثبت شده است',
  closed: 'ارزیابی این پرونده بسته شده است',
}

/**
 * Whether a refreshed case file is no longer the one on screen: another round,
 * another reviewed proposal revision or a newer case revision.
 */
export function caseFileChanged(previous: ReviewCaseFileDto, next: ReviewCaseFileDto): boolean {
  return (
    previous.case.round?.id !== next.case.round?.id ||
    previous.case.proposalRevision !== next.case.proposalRevision ||
    previous.case.revision !== next.case.revision ||
    previous.case.actionable !== next.case.actionable
  )
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('fa-IR')} کیلوبایت`
  return `${(bytes / (1024 * 1024)).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت`
}

/** Plain text for a submitted answer of any shape. */
export function answerText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر'
  if (Array.isArray(value) && value.every((item) => typeof item !== 'object')) return value.join('، ')
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
