import type { RequestItem } from '@/components/dashboard/requests/types'
import { companyRequestStage, companyRequestStageLabel } from '../company-request-stage'
import { companyNextAction } from '../request-tracking'
import { type RequestStatus, type RequestDto, type ActivityDto, type Paginated, formatDate, dashboardFetch } from './core'

export function listRequests(params?: {
  status?: RequestStatus
  /** Only requests bound to this event's subtopics (server-side filter). */
  eventId?: string
  page?: number
  limit?: number
}): Promise<Paginated<RequestDto>> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.eventId) qs.set('eventId', params.eventId)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return dashboardFetch<Paginated<RequestDto>>(`/requests${suffix}`)
}

export interface RequestDetail {
  request: RequestDto
  timeline: ActivityDto[]
  workflow: { title: string; role: string; roleName: string; order: number }[]
  /** Absent for reviewers and employers, who are not told whose case it is. */
  owner?: { id: string; name: string | null } | null
}

export function getRequest(id: string): Promise<RequestDetail> {
  return dashboardFetch<RequestDetail>(`/requests/${encodeURIComponent(id)}`)
}

export function createRequest(input: {
  serviceId: string
  title: string
  answers?: Record<string, unknown>
  /** Event applications: the server binds one draft to this subtopic and the RFP version read. */
  eventId?: string
  subtopicId?: string
  rfpVersionId?: string
}): Promise<{ request: RequestDto }> {
  return dashboardFetch<{ request: RequestDto }>('/requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateRequest(
  id: string,
  input: { title?: string; answers?: Record<string, unknown> },
): Promise<{ request: RequestDto }> {
  return dashboardFetch<{ request: RequestDto }>(`/requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function submitRequest(
  id: string,
  body?: {
    nonCompeteAcceptance?: { accepted: boolean; textVersionId: string }
    eventRulesAcceptance?: { accepted: boolean; textVersionId: string }
  },
): Promise<{ request: RequestDto }> {
  return dashboardFetch<{ request: RequestDto }>(`/requests/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Resubmits a case the chief returned for correction: the same application and
 * tracking code receive a new proposal revision. The server re-checks ownership,
 * the correction state, verification, required fields and the agreement versions.
 */
export function resubmitCorrection(
  id: string,
  body: {
    nonCompeteAcceptance: { accepted: boolean; textVersionId: string }
    eventRulesAcceptance: { accepted: boolean; textVersionId: string }
  },
): Promise<{ request: RequestDto }> {
  return dashboardFetch<{ request: RequestDto }>(`/requests/${encodeURIComponent(id)}/resubmit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export interface AgreementDefinition {
  type: 'non_compete' | 'event_rules'
  version: string
  title: string
  /** False while the text is unapproved: acceptance must not be presented as final. */
  approved: boolean
}

export function listAgreements(): Promise<{ agreements: AgreementDefinition[] }> {
  return dashboardFetch<{ agreements: AgreementDefinition[] }>('/agreements')
}

export interface RequestProposalDetail {
  proposal: {
    requestId: string
    revision: number
    formVersion: string
    applicationTeam: Array<{ name: string; role: string; relation?: string }>
    proposalDocuments: Array<{
      id: string
      filename: string
      mimeType: string
      sizeBytes: number
      logicalVersion: number
      createdAt: string
    }>
    createdAt: string
  } | null
  agreements: Array<{
    id: string
    requestId: string
    revision: number
    agreementType: 'non_compete' | 'event_rules'
    textVersionId: string
    acceptedBy: string
    acceptedAt: string
  }>
  /** Every proposal revision of the case the reader may see, oldest first. */
  revisions?: number[]
}

/**
 * The company profile pinned when the request was submitted (T21). Oversight gets the
 * whole snapshot; the dossier only reads the fields every reviewing role may see.
 * `null` when the case has no pinned profile (the route answers 404).
 */
export interface RequestVerificationDto {
  verification: {
    requestId: string
    revision: number
    snapshot: {
      company?: Record<string, unknown>
      dossier?: Record<string, unknown>
    }
    createdAt: string
  } | null
}

export function getRequestProposal(id: string, revision?: number): Promise<RequestProposalDetail> {
  const qs = revision ? `?revision=${revision}` : ''
  return dashboardFetch<RequestProposalDetail>(`/requests/${encodeURIComponent(id)}/proposal${qs}`)
}

export function canUploadDocuments(request: Pick<RequestDto, 'allowedActions'>): boolean {
  return request.allowedActions?.includes('uploadDocument') === true
}

export function canDeleteDocuments(request: Pick<RequestDto, 'allowedActions'>): boolean {
  return request.allowedActions?.includes('deleteDocument') === true
}

export function mapRequestItem(dto: RequestDto): RequestItem {
  return {
    id: dto.id,
    trackingCode: dto.trackingCode,
    title: dto.title,
    status: dto.status as RequestItem['status'],
    statusLabel: companyRequestStageLabel(dto),
    stage: companyRequestStage(dto),
    currentStep: dto.currentStep ?? '',
    nextAction: companyNextAction(dto),
    revision: dto.revision ?? null,
    allowedActions: dto.allowedActions ?? [],
    dueDate: formatDate(dto.dueDate),
    createdDate: formatDate(dto.createdAt),
  }
}
