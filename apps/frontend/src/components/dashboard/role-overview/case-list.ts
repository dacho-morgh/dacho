import type { BadgeProps } from '@/components/ui/badge'
import type { RequestAction, RequestStatus } from '@/utilities/dashboard-api'

/** A row of GET /admin/requests, as much as the role boards read. */
export interface CaseListItem {
  id: string
  title: string
  trackingCode: string
  status: RequestStatus
  reviewStage?: string | null
  allowedActions?: RequestAction[]
  createdAt: string
  submissionDate?: string | null
  owner?: { companyName?: string; name?: string }
}

export const STAGE_LABELS: Record<string, string> = {
  chief_triage: 'بررسی اولیه سردبیر',
  triaged: 'داوری',
  advanced: 'مالی و سرمایه‌گذاری',
}

export const STATUS_VARIANT: Record<RequestStatus, BadgeProps['variant']> = {
  draft: 'gray',
  in_review: 'primary',
  action_needed: 'yellow',
  approved: 'green',
  rejected: 'red',
}
