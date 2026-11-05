import type { CompanyDetailResponse } from '@/components/dashboard/company-detail-view'
import { unavailableReasonFor, type UnavailableReason } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import {
  mergeVerification,
  verificationTargetId,
  type VerificationDetailResponse,
} from './company-detail-data'

export type CompanyDetailPageData =
  | { kind: 'ok'; data: CompanyDetailResponse }
  | { kind: 'missing' }
  | { kind: 'unavailable'; reason: UnavailableReason }

/**
 * The company and its verification dossier, read on the server so the page opens with its
 * content instead of a skeleton followed by two browser round trips.
 */
export async function loadCompanyDetail(id: string): Promise<CompanyDetailPageData> {
  const company = await serverDashboardFetchResult<CompanyDetailResponse>(
    `/admin/companies/${encodeURIComponent(id)}`,
  )
  if (company.kind === 'unavailable' && company.status === 404) return { kind: 'missing' }
  const reason = unavailableReasonFor(company)
  if (reason) return { kind: 'unavailable', reason }
  if (company.kind !== 'ok') return { kind: 'unavailable', reason: 'unavailable' }

  const targetId = verificationTargetId(company.data)
  if (!targetId) return { kind: 'ok', data: company.data }
  // A failed detail read keeps the base projection, as the browser load does.
  const detail = await serverDashboardFetchResult<VerificationDetailResponse>(
    `/admin/verifications/${encodeURIComponent(targetId)}`,
  )
  return { kind: 'ok', data: mergeVerification(company.data, detail.kind === 'ok' ? detail.data : null) }
}
