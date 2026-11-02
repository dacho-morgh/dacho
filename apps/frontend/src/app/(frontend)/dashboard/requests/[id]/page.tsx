import type { ReactNode } from 'react'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { OfflineNotice } from '@/components/dashboard/offline-notice'
import { CompanyCorrectionPanel } from '@/components/dashboard/company-correction-panel'
import { CompanyRequestTracking } from '@/components/dashboard/company-request-tracking'
import { RequestDossier, type DossierPart } from '@/components/dashboard/request-dossier'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Typography } from '@/components/ui/typography'
import {
  formatDate,
  type CompanySupplementaryRequestDto,
  type EvaluationListDto,
  type PublishedResultDto,
  type RequestDetail,
  type RequestProposalDetail,
  type RequestVerificationDto,
  type ReviewRoundDto,
} from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { dashboardOperationalRole, serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'
import { trackingOutcome } from '@/utilities/request-tracking'
import { serviceFormFields } from '@/utilities/service-form-fields'
import type { RequestFormField } from '@/components/dashboard/request-form-field'

export const dynamic = 'force-dynamic'

/** The service's fixed form, read from the CMS; a failed read offers no answer fields rather than failing the page. */
async function serviceFields(payload: Awaited<ReturnType<typeof getPayload>>, serviceId: string): Promise<RequestFormField[]> {
  try {
    const service = await payload.findByID({ collection: 'services', id: serviceId, depth: 2 })
    return serviceFormFields(service)
  } catch {
    return []
  }
}

/** A section's read: a failure stays distinct from "this role has no such section". */
async function readPart<T>(path: string): Promise<DossierPart<T>> {
  const result = await serverDashboardFetchResult<T>(path)
  return result.kind === 'ok' ? result.data : 'failed'
}

/** The pinned profile: a 404 means the case has none, which is not a failed read. */
async function readProfile(path: string): Promise<DossierPart<RequestVerificationDto>> {
  const result = await serverDashboardFetchResult<RequestVerificationDto>(path)
  if (result.kind === 'ok') return result.data
  return result.kind === 'unavailable' && result.status === 404 ? { verification: null } : 'failed'
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const role = dashboardOperationalRole(user) ?? 'representative'
  const path = `/requests/${encodeURIComponent(id)}`

  const result = await serverDashboardFetchResult<RequestDetail>(path)
  if (result.kind !== 'ok') {
    const notice = unavailableReasonFor(result)
    // A failed read is not a missing case: only a genuine 404 renders notFound.
    if (result.kind === 'unavailable' && result.status === 404) notFound()
    return (
      <main className="mx-auto w-full max-w-4xl p-6 sm:p-10" dir="rtl">
        <OfflineNotice
          reason={notice ?? 'unavailable'}
          retryHref={`/dashboard/requests/${encodeURIComponent(id)}`}
        />
      </main>
    )
  }

  // Reviewers and employers see only their own work, and investment people have no part
  // in the round: these reads are for the chief, the Secretariat and the owner.
  const oversees = role === 'system-owner' || role === 'central-secretariat' || role === 'chief-reviewer'
  const isCompany = role === 'representative'
  const [proposal, round, evaluations, publishedResult, supplementary, profile] = await Promise.all([
    readPart<RequestProposalDetail>(`${path}/proposal`),
    oversees ? readPart<{ round: ReviewRoundDto | null }>(`${path}/review-round`) : null,
    oversees ? readPart<EvaluationListDto>(`${path}/evaluations`) : null,
    isCompany ? readPart<{ result: PublishedResultDto | null }>(`${path}/result`) : null,
    isCompany ? readPart<{ items: CompanySupplementaryRequestDto[] }>(`${path}/supplementary-requests`) : null,
    // The chief triages the profile as submitted, not the live one the company may have edited since.
    oversees ? readProfile(`${path}/verification`) : null,
  ])

  // The correction form edits the service's fixed answers; an unreadable form leaves the team and files editable.
  const correcting = isCompany && (result.data.request.allowedActions ?? []).includes('correct')
  const correctionFields = correcting ? await serviceFields(payload, result.data.request.serviceId) : []
  const outcome = isCompany ? trackingOutcome(result.data.request, result.data.timeline) : null

  return (
    <RequestDossier
      role={role}
      correctionHandled={correcting}
      detail={result.data}
      proposal={proposal}
      round={round}
      evaluations={evaluations}
      profile={profile}
      companySections={
        isCompany ? (
          <CompanySections
            request={result.data.request}
            timeline={result.data.timeline}
            proposalRevision={proposal === 'failed' ? 'failed' : (proposal?.proposal?.revision ?? null)}
            publishedResult={publishedResult}
            supplementary={supplementary}
            correction={
              correcting ? (
                <CompanyCorrectionPanel
                  request={result.data.request}
                  fields={correctionFields}
                  after={outcome?.kind === 'correction' ? outcome.after : null}
                />
              ) : null
            }
          />
        ) : null
      }
    />
  )
}

/** The company's tracking, correction and result, then the Secretariat's document requests. */
function CompanySections({
  request,
  timeline,
  proposalRevision,
  publishedResult,
  supplementary,
  correction,
}: {
  request: RequestDetail['request']
  timeline: RequestDetail['timeline']
  proposalRevision: DossierPart<number>
  publishedResult: DossierPart<{ result: PublishedResultDto | null }>
  supplementary: DossierPart<{ items: CompanySupplementaryRequestDto[] }>
  correction: ReactNode
}) {
  const requestId = request.id
  return (
    <>
      <CompanyRequestTracking
        request={request}
        timeline={timeline}
        proposalRevision={proposalRevision}
        publishedResult={publishedResult}
        correction={correction}
      />
      {supplementary === 'failed' ? (
        <Typography role="alert" variant="14/regular" color="error">
          دریافت درخواست‌های دبیرخانه انجام نشد. صفحه را دوباره بارگذاری کنید.
        </Typography>
      ) : supplementary?.items.length ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
          <Typography as="h2" variant="20/bold" className="text-neutral-900">
            مدارک تکمیلی درخواست‌شده
          </Typography>
          <ul className="flex flex-col gap-2">
            {supplementary.items.map((item) => (
              <li key={item.id} className="rounded-lg bg-neutral-50 p-3">
                <Typography variant="12/regular" className="text-neutral-500">
                  {formatDate(item.createdAt)}
                </Typography>
                <Typography variant="14/regular" className="mt-1 whitespace-pre-wrap text-neutral-800">
                  {item.body}
                </Typography>
              </li>
            ))}
          </ul>
          <PrivateDocumentField
            category="correspondenceAttachment"
            label="ارسال مدارک تکمیلی به دبیرخانه"
            requestId={requestId}
            canUpload
          />
        </section>
      ) : null}
    </>
  )
}
