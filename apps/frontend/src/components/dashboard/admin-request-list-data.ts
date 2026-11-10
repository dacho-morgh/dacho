/**
 * What the internal requests table reads: shared by the server page (which fetches the page so the
 * table renders with its rows) and the client list (which fetches only when the server did not).
 */
import {
  requestFiltersQuery,
  type RequestQueueFilters,
  type RequestStatus,
} from '@/components/dashboard/requests/types'
import type { RequestAction } from '@/utilities/dashboard-api'

export const ADMIN_REQUESTS_PAGE_SIZE = 10

export type AdminRequestRow = {
  id: string
  /** The company's account id: the id of its dossier page. */
  companyId: string | null
  /** The company's name, or its representative's when the company has none. */
  company: string
  /** The company's picture (its access-checked file route); null when it has none. */
  logoUrl: string | null
  title: string
  status: RequestStatus
  stage: string
  /** The next step the server lists for this person, if any. */
  pending: string | null
  /** The case can be evaluated by this person (initial review or the review decision). */
  canEvaluate: boolean
  createdAt: string | null
  /**
   * A Secretariat follow-up case (its investment memo was sent): whether the result is published.
   * Null for every other case, and for readers who may not know about memos.
   */
  followUp: { published: boolean } | null
}

export type AdminRequestsPage = {
  requests: AdminRequestRow[]
  page: number
  totalPages: number
}

/** The first page as the server read it, with the query it answers. */
export type InitialAdminRequests = AdminRequestsPage & { key: string }

export type AdminRequestsApiResponse = {
  page?: number
  totalPages?: number
  items?: {
    id: string
    ownerId?: string
    title: string
    status: RequestStatus
    reviewStage?: string | null
    allowedActions?: RequestAction[]
    createdAt?: string | null
    /** Sent only to the Secretariat and the owner; null when no memo was sent. */
    followUp?: { latestMemoSentAt: string; publishedAt: string | null } | null
    owner?: {
      id?: string
      name?: string | null
      companyName?: string | null
      logo?: { id: string; url: string } | null
    } | null
  }[]
}

const STAGE_LABELS: Record<string, string> = {
  chief_triage: 'بررسی اولیه',
  triaged: 'داوری',
  advanced: 'مالی و سرمایه‌گذاری',
}

/** Most specific first; only commands with a control on the dossier. */
const PENDING_LABELS: [RequestAction, string][] = [
  ['triage', 'منتظر بررسی اولیه شما'],
  ['startReview', 'منتظر تعیین داوران'],
  ['decideReview', 'منتظر تصمیم شما'],
  ['reopen', 'قابل بازگشایی'],
]

export function adminRequestsQuery(status: RequestStatus | undefined, page: number, filters: RequestQueueFilters) {
  return `limit=${ADMIN_REQUESTS_PAGE_SIZE}&page=${page}${status ? `&status=${status}` : ''}${requestFiltersQuery(filters)}`
}

/** Null when the answer is not a list (the caller shows its error state). */
export function toAdminRequestsPage(data: AdminRequestsApiResponse, requestedPage: number): AdminRequestsPage | null {
  if (!Array.isArray(data.items)) return null
  return {
    requests: data.items.map((item) => ({
      id: item.id,
      companyId: item.owner?.id ?? item.ownerId ?? null,
      company: item.owner?.companyName || item.owner?.name || '—',
      logoUrl: item.owner?.logo?.url ?? null,
      title: item.title,
      status: item.status,
      stage: (item.reviewStage && STAGE_LABELS[item.reviewStage]) || '—',
      pending: PENDING_LABELS.find(([action]) => item.allowedActions?.includes(action))?.[1] ?? null,
      canEvaluate: item.allowedActions?.some((action) => action === 'triage' || action === 'decideReview') ?? false,
      createdAt: item.createdAt ?? null,
      followUp: item.followUp ? { published: Boolean(item.followUp.publishedAt) } : null,
    })),
    page: data.page ?? requestedPage,
    totalPages: data.totalPages ?? 1,
  }
}
