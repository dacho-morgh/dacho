import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { OfflineNotice } from '@/components/dashboard/offline-notice'
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
  type ReviewRoundDto,
} from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { dashboardOperationalRole, serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

/** A section's read: a failure stays distinct from "this role has no such section". */
async function readPart<T>(path: string): Promise<DossierPart<T>> {
  const result = await serverDashboardFetchResult<T>(path)
  return result.kind === 'ok' ? result.data : 'failed'
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
  const [proposal, round, evaluations, publishedResult, supplementary] = await Promise.all([
    readPart<RequestProposalDetail>(`${path}/proposal`),
    oversees ? readPart<{ round: ReviewRoundDto | null }>(`${path}/review-round`) : null,
    oversees ? readPart<EvaluationListDto>(`${path}/evaluations`) : null,
    isCompany ? readPart<{ result: PublishedResultDto | null }>(`${path}/result`) : null,
    isCompany ? readPart<{ items: CompanySupplementaryRequestDto[] }>(`${path}/supplementary-requests`) : null,
  ])

  return (
    <RequestDossier
      role={role}
      detail={result.data}
      proposal={proposal}
      round={round}
      evaluations={evaluations}
      companySections={
        isCompany ? (
          <CompanySections
            requestId={result.data.request.id}
            publishedResult={publishedResult}
            supplementary={supplementary}
          />
        ) : null
      }
    />
  )
}

/** What the company receives from the Secretariat: the published result and document requests. */
function CompanySections({
  requestId,
  publishedResult,
  supplementary,
}: {
  requestId: string
  publishedResult: DossierPart<{ result: PublishedResultDto | null }>
  supplementary: DossierPart<{ items: CompanySupplementaryRequestDto[] }>
}) {
  return (
    <>
      {publishedResult === 'failed' ? (
        <Typography role="alert" variant="14/regular" color="error">
          دریافت نتیجه پرونده انجام نشد. صفحه را دوباره بارگذاری کنید.
        </Typography>
      ) : publishedResult?.result ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-brand-600 bg-white p-6">
          <Typography as="h2" variant="20/bold" className="text-neutral-900">
            نتیجه پرونده
          </Typography>
          <Typography variant="12/regular" className="text-neutral-500">
            تاریخ انتشار: {formatDate(publishedResult.result.publishedAt)}
          </Typography>
          <Typography variant="16/regular" className="whitespace-pre-wrap text-neutral-800">
            {publishedResult.result.body}
          </Typography>
        </section>
      ) : null}
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
