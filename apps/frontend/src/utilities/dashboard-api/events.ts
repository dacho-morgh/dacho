import { dashboardFetch } from './core'

export interface EventCategoryDto {
  id: string
  eventId: string
  title: string
  createdAt?: string
  updatedAt?: string
}

export interface EventSubtopicDto {
  id: string
  eventId: string
  categoryId: string
  categoryTitle?: string
  title: string
  employerId: string
  currentRfpVersionId: string | null
  createdAt?: string
  updatedAt?: string
}

export interface RfpFileDto {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  policyVersion?: string
}

export interface RfpVersionDto {
  id: string
  subtopicId: string
  createdBy: string
  createdAt: string
  reason: string
  files: RfpFileDto[]
}

export function getEventCategories(eventId: string): Promise<{ items: EventCategoryDto[] }> {
  return dashboardFetch<{ items: EventCategoryDto[] }>(`/events/${encodeURIComponent(eventId)}/categories`)
}

export function getEventSubtopics(eventId: string): Promise<{ items: EventSubtopicDto[] }> {
  return dashboardFetch<{ items: EventSubtopicDto[] }>(`/events/${encodeURIComponent(eventId)}/subtopics`)
}

export function getSubtopicRfp(
  eventId: string,
  subtopicId: string,
  versionId?: string,
): Promise<{ version: RfpVersionDto }> {
  const path = versionId
    ? `/events/${encodeURIComponent(eventId)}/subtopics/${encodeURIComponent(subtopicId)}/rfp/${encodeURIComponent(versionId)}`
    : `/events/${encodeURIComponent(eventId)}/subtopics/${encodeURIComponent(subtopicId)}/rfp`
  return dashboardFetch<{ version: RfpVersionDto }>(path)
}

/** The event/subtopic/RFP version pinned to an application; 404 when the request has none. */
export function getRequestRfp(requestId: string): Promise<{ version: RfpVersionDto }> {
  return dashboardFetch<{ version: RfpVersionDto }>(`/requests/${encodeURIComponent(requestId)}/rfp`)
}

export function getRfpDownloadUrl(
  eventId: string,
  subtopicId: string,
  versionId: string,
  fileId: string,
): string {
  return `/api/dashboard/events/${encodeURIComponent(eventId)}/subtopics/${encodeURIComponent(subtopicId)}/rfp/${encodeURIComponent(versionId)}/files/${encodeURIComponent(fileId)}`
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '۰ بایت'
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)
  const persianVal = val.replace(/\./g, '٫').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d)
  return `${persianVal} ${units[i]}`
}

/* ── Participation eligibility (FE06; T15/T19/T55) ─────────────────────── */

/** The event's sample proposal form (نمونه فرم پروپوزال): the bundled default until an owner replaces it. */
export interface ProposalTemplateDto {
  filename: string
  mimeType: string
  sizeBytes: number
  isDefault: boolean
  updatedAt: string | null
}

export function getProposalTemplate(eventId: string): Promise<{ template: ProposalTemplateDto }> {
  return dashboardFetch<{ template: ProposalTemplateDto }>(`/events/${encodeURIComponent(eventId)}/proposal-template`)
}

export function getProposalTemplateDownloadUrl(eventId: string): string {
  return `/api/dashboard/events/${encodeURIComponent(eventId)}/proposal-template/file`
}

/** A file of the RFP version a request is pinned to; the server resolves the version from the request. */
export function getRequestRfpFileUrl(requestId: string, fileId: string): string {
  return `/api/dashboard/requests/${encodeURIComponent(requestId)}/rfp/files/${encodeURIComponent(fileId)}`
}
