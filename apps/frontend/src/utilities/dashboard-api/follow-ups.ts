import { type Paginated, dashboardFetch, postJson } from './core'

export interface PublishedResultDto {
  body: string
  publishedAt: string
}

export interface CompanySupplementaryRequestDto {
  id: string
  body: string
  createdAt: string
}

export interface FollowUpQueueItemDto {
  requestId: string
  trackingCode: string
  title: string
  companyName: string | null
  latestMemoVersion: number
  latestMemoSentAt: string
  publishedAt: string | null
}

export type FollowUpQueueDto = Paginated<FollowUpQueueItemDto>

export interface ResultVersionDto {
  id: string
  version: number
  body: string
  authorName: string | null
  createdAt: string
  publishedByName: string | null
  publishedAt: string | null
}

export interface CaseFollowUpDto {
  stageOpen: boolean
  canAct: boolean
  /** The company as pinned at submission; null when the case has no pinned profile. */
  companyName?: string | null
  memos: {
    id: string
    version: number
    body: string
    authorName: string | null
    sentAt: string | null
  }[]
  supplementaryRequests: CompanySupplementaryRequestDto[]
  files: {
    id: string
    filename: string
    createdAt: string
    deliveredAt: string | null
    downloadUrl: string
  }[]
  results: ResultVersionDto[]
  published: PublishedResultDto | null
}

export function getCaseFollowUp(id: string): Promise<CaseFollowUpDto> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/follow-up`)
}

export function requestSupplementaryDocuments(id: string, body: string): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/supplementary-requests`, postJson({ body }))
}

export function deliverSupplementaryFile(id: string, documentId: string): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/supplementary-files`, postJson({ documentId }))
}

export function saveResult(id: string, body: string): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/result`, postJson({ body }))
}

export function publishResult(id: string, version: number): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/result/publish`, postJson({ version }))
}

/* ── Role actions on the shared dossier (T21, T22, T28, T32) ──────────── */
