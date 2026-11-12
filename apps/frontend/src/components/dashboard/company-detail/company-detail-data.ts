import type {
  CompanyDetailResponse,
  VerificationHistoryItem,
} from '@/components/dashboard/company-detail-view'

/** What `GET /admin/verifications/:id` adds to the company response: the full snapshot, history and actions. */
export interface VerificationDetailResponse {
  verification?: CompanyDetailResponse['verification']
  history?: VerificationHistoryItem[]
  allowedActions?: ('read' | 'approve' | 'return' | 'reject' | 'reopen')[]
}

/**
 * The id the verification read is addressed by. A company that never submitted has no verification,
 * so there is nothing to read: asking for it would only cost a round trip that ends in a 404.
 */
export function verificationTargetId(company: CompanyDetailResponse): string | undefined {
  return company.verification?.id || undefined
}

/** Lays the detailed verification read over the company response; a missing read keeps the base projection. */
export function mergeVerification(
  company: CompanyDetailResponse,
  detail: VerificationDetailResponse | null | undefined,
): CompanyDetailResponse {
  if (!detail) return company
  return {
    ...company,
    ...(detail.verification ? { verification: detail.verification } : {}),
    ...(detail.history ? { history: detail.history } : {}),
    ...(detail.allowedActions ? { allowedActions: detail.allowedActions } : {}),
  }
}
