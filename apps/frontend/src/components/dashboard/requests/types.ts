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
