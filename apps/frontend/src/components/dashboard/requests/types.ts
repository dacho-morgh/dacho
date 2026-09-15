export type RequestStatus = 'in_review' | 'action_needed' | 'rejected' | 'draft' | 'approved'

export interface RequestItem {
  id: string
  title: string
  status: RequestStatus
  statusLabel: string
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
