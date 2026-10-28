export const REQUEST_STATUS_VALUES: RequestStatus[] = [
  'draft',
  'in_review',
  'action_needed',
  'approved',
  'rejected',
]

/** Only server-known statuses reach the queue query; anything else is ignored. */
export function parseRequestStatus(value?: string | string[]): RequestStatus | undefined {
  return typeof value === 'string' && (REQUEST_STATUS_VALUES as string[]).includes(value)
    ? (value as RequestStatus)
    : undefined
}

/** Invalid or repeated page parameters return to the first page. */
export function parseRequestPage(value?: string | string[]): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) && Number.isSafeInteger((page - 1) * 50) ? page : 1
}

export function requestQueueHref(basePath: string, status?: RequestStatus, page = 1): string {
  const query = new URLSearchParams()
  if (status) query.set('status', status)
  if (page > 1) query.set('page', String(page))
  return query.size ? `${basePath}?${query}` : basePath
}

export type RequestStatus = 'in_review' | 'action_needed' | 'rejected' | 'draft' | 'approved'

export type RequestAllowedAction =
  | 'read'
  | 'submit'
  | 'assign'
  | 'uploadDocument'
  | 'deleteDocument'

export interface RequestItem {
  id: string
  trackingCode: string
  title: string
  status: RequestStatus
  statusLabel: string
  currentStep: string
  allowedActions: RequestAllowedAction[]
  dueDate: string
  createdDate: string
}

export type RecentRequestStatus = 'draft' | 'in_review' | 'action_needed' | 'approved' | 'rejected'

export type RecentRequestServiceType =
  | 'financing'
  | 'events'
  | 'exhibitions'
  | 'knowledge'
  | 'commercialization'

export interface RecentRequestItem {
  id: string
  trackingCode: string
  title: string
  serviceName: string
  serviceType: RecentRequestServiceType
  currentStep: string
  assignedRole: string
  status: RecentRequestStatus
  submissionDate: string
  updatedAt: string
}
