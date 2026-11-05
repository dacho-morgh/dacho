import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { CompanyDetailResponse } from '@/components/dashboard/company-detail-view'
import type { RequestFormField } from '@/components/dashboard/request-form-field'
import type { RequestDetail } from '@/utilities/dashboard-api'
import { unavailableReasonFor, type UnavailableReason } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { serviceFormFields } from '@/utilities/service-form-fields'

export type CompanyRequestPageData =
  | {
      kind: 'ok'
      company: CompanyDetailResponse
      detail: RequestDetail
      fields: RequestFormField[]
    }
  | { kind: 'unavailable'; reason: UnavailableReason }
  | { kind: 'missing' }

/** The service's fixed form from the CMS; a failed read offers no field labels rather than failing the page. */
async function serviceFields(serviceId: string): Promise<RequestFormField[]> {
  try {
    const payload = await getPayload({ config: configPromise })
    const service = await payload.findByID({ collection: 'services', id: serviceId, depth: 2 })
    return serviceFormFields(service)
  } catch {
    return []
  }
}

/**
 * One request of one company, read as the admin sees it. A request that belongs to a
 * different company is reported as missing, so the company URL never shows another's case.
 */
export async function loadCompanyRequestPage(
  companyId: string,
  requestId: string,
): Promise<CompanyRequestPageData> {
  const [company, detail] = await Promise.all([
    serverDashboardFetchResult<CompanyDetailResponse>(`/admin/companies/${encodeURIComponent(companyId)}`),
    serverDashboardFetchResult<RequestDetail>(`/admin/requests/${encodeURIComponent(requestId)}`),
  ])

  for (const result of [company, detail]) {
    if (result.kind === 'unavailable' && result.status === 404) return { kind: 'missing' }
    const reason = unavailableReasonFor(result)
    if (reason) return { kind: 'unavailable', reason }
  }
  if (company.kind !== 'ok' || detail.kind !== 'ok') return { kind: 'unavailable', reason: 'unavailable' }
  if (detail.data.request.ownerId !== companyId) return { kind: 'missing' }

  return {
    kind: 'ok',
    company: company.data,
    detail: detail.data,
    fields: await serviceFields(detail.data.request.serviceId),
  }
}
