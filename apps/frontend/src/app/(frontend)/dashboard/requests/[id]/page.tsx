import type { ReactNode } from 'react'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import { OfflineNotice } from '@/components/dashboard/offline-notice'
import { CompanyCorrectionPanel } from '@/components/dashboard/company-correction-panel'
import { CompanyRequestTracking } from '@/components/dashboard/company-request-tracking'
import { FinancialOutcomeCard } from '@/components/dashboard/financial-outcome-card'
import { FinancialPackagePanel } from '@/components/dashboard/financial-package-panel'
import { RequestDossier, type DossierPart } from '@/components/dashboard/request-dossier'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  formatDate,
  type CompanySupplementaryRequestDto,
  type EvaluationListDto,
  type PublishedResultDto,
  type RequestDetail,
  type RequestProposalDetail,
  type RequestVerificationDto,
  type ReviewCandidatesDto,
  type ReviewRoundDto,
  type ReviewRoundHistoryEntry,
  type ReviewRoundListDto,
} from '@/utilities/dashboard-api'
import type { SummaryPart } from '@/components/dashboard/chief-review-summary'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import {
  dashboardOperationalRole,
  serverDashboardFetchResult,
  type DashboardFetchResult,
} from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'
import { trackingOutcome } from '@/utilities/request-tracking'
import { ReviewerCaseFile, type ReviewerCaseInitial } from '@/components/dashboard/reviewer/reviewer-case-file'
import { isReviewerRole, type ReviewCaseFileDto } from '@/utilities/reviewer-case'
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

function reviewerCaseInitial(result: DashboardFetchResult<ReviewCaseFileDto>): ReviewerCaseInitial {
  if (result.kind === 'ok') return { kind: 'ok', data: result.data }
  if (result.kind === 'unauthenticated') return { kind: 'expired' }
  if (result.kind === 'denied') return { kind: 'denied' }
  return result.status === 404 ? { kind: 'not-assigned' } : { kind: 'error' }
}

/** A section's read: a failure stays distinct from "this role has no such section". */
async function readPart<T>(path: string): Promise<DossierPart<T>> {
  const result = await serverDashboardFetchResult<T>(path)
  return result.kind === 'ok' ? result.data : 'failed'
}

/** Like readPart, but keeps a 403 apart from a failed read. */
async function readSummaryPart<T>(path: string): Promise<SummaryPart<T>> {
  const result = await serverDashboardFetchResult<T>(path)
  if (result.kind === 'ok') return result.data
  return result.kind === 'denied' ? 'denied' : 'failed'
}

const evaluationsPath = (path: string, revision: number | undefined) =>
  revision === undefined ? `${path}/evaluations` : `${path}/evaluations?revision=${encodeURIComponent(String(revision))}`

/** Every round but the latest, each with the evaluations of its own request revision. */
async function readHistory(
  path: string,
  rounds: SummaryPart<ReviewRoundListDto>,
  latestId: string | null,
): Promise<SummaryPart<ReviewRoundHistoryEntry[]>> {
  if (rounds === null || rounds === 'failed' || rounds === 'denied') return rounds
  const earlier = (rounds.items ?? []).filter((item) => item.id !== latestId)
  return Promise.all(
    earlier.map(async (item) => {
      const evaluations = await readPart<EvaluationListDto>(evaluationsPath(path, item.requestRevision))
      return { round: item, evaluations: evaluations && evaluations !== 'failed' ? evaluations : ('failed' as const) }
    }),
  )
}

/** Slot holders and deciders of earlier rounds, as the oversight response returned them. */
function historyPeople(history: SummaryPart<ReviewRoundHistoryEntry[]>): string[] {
  if (!history || typeof history !== 'object') return []
  return history.flatMap(({ round }) => [
    ...(round.slots ?? []).map((slot) => slot.userId),
    ...(round.decision?.decidedBy ? [round.decision.decidedBy] : []),
  ])
}

/** The pinned profile: a 404 means the case has none, which is not a failed read. */
async function readProfile(path: string): Promise<DossierPart<RequestVerificationDto>> {
  const result = await serverDashboardFetchResult<RequestVerificationDto>(path)
  if (result.kind === 'ok') return result.data
  return result.kind === 'unavailable' && result.status === 404 ? { verification: null } : 'failed'
}

/** Everyone the round response names: slot holders, replaced people and who replaced them. */
function roundPeople(round: DossierPart<{ round: ReviewRoundDto | null }>): string[] {
  const current = round && round !== 'failed' ? round.round : null
  if (!current) return []
  return [
    ...(current.employerId ? [current.employerId] : []),
    ...(current.slots ?? []).map((slot) => slot.userId),
    ...(current.replacements ?? []).flatMap((item) => [item.oldUserId, item.newUserId, item.replacedBy]),
    ...(current.decision?.decidedBy ? [current.decision.decidedBy] : []),
  ]
}

/**
 * Display names for ids the dashboard API already returned to this oversight reader.
 * Only names are read; a failed lookup leaves the generic slot labels.
 */
async function peopleNames(payload: Awaited<ReturnType<typeof getPayload>>, ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return {}
  try {
    const found = await payload.find({
      collection: 'users',
      where: { id: { in: unique } },
      depth: 0,
      limit: unique.length,
      pagination: false,
      select: { name: true },
    })
    const names: Record<string, string> = {}
    for (const user of found.docs) {
      const name = typeof user.name === 'string' ? user.name.trim() : ''
      if (name) names[String(user.id)] = name
    }
    return names
  } catch {
    return {}
  }
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const role = dashboardOperationalRole(user) ?? 'representative'
  const path = `/requests/${encodeURIComponent(id)}`

  // Reviewers and employers read only their assigned case file (T23). The server answers
  // 404 for an unassigned, foreign-event or guessed id, which is a denied state, not a missing page.
  if (isReviewerRole(role)) {
    const caseResult = await serverDashboardFetchResult<ReviewCaseFileDto>(`/review/cases/${encodeURIComponent(id)}`)
    return <ReviewerCaseFile key={id} requestId={id} initial={reviewerCaseInitial(caseResult)} />
  }

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
  const [proposal, round, rounds, publishedResult, supplementary, profile] = await Promise.all([
    readPart<RequestProposalDetail>(`${path}/proposal`),
    oversees ? readPart<{ round: ReviewRoundDto | null }>(`${path}/review-round`) : null,
    oversees ? readSummaryPart<ReviewRoundListDto>(`${path}/review-rounds`) : null,
    isCompany ? readPart<{ result: PublishedResultDto | null }>(`${path}/result`) : null,
    isCompany ? readPart<{ items: CompanySupplementaryRequestDto[] }>(`${path}/supplementary-requests`) : null,
    // The chief triages the profile as submitted, not the live one the company may have edited since.
    oversees ? readProfile(`${path}/verification`) : null,
  ])

  // The latest round's evaluations are read by that round's revision: a decision moves the
  // case revision on, and the decided round's four evaluations must stay readable.
  const latestRound = round && round !== 'failed' ? round.round : null
  const [evaluations, roundHistory] = oversees
    ? await Promise.all([
        readPart<EvaluationListDto>(evaluationsPath(path, latestRound?.requestRevision)),
        readHistory(path, rounds, latestRound?.id ?? null),
      ])
    : [null, null]

  // A new round's fixed employer comes from the chief's candidate read; the dialog reads the picks itself.
  const starts = role === 'chief-reviewer' && (result.data.request.allowedActions ?? []).includes('startReview')
  const startCandidates = starts ? await readPart<ReviewCandidatesDto>(`${path}/review-round/candidates`) : null
  const roundEmployerId = startCandidates && startCandidates !== 'failed' ? startCandidates.employerId : null
  const people = oversees
    ? await peopleNames(payload, [
        ...roundPeople(round),
        ...historyPeople(roundHistory),
        ...(roundEmployerId ? [roundEmployerId] : []),
      ])
    : {}

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
      roundHistory={roundHistory}
      profile={profile}
      people={people}
      roundEmployerId={roundEmployerId}
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
  const result = publishedResult === 'failed' ? null : (publishedResult?.result ?? null)
  return (
    <>
      <CompanyRequestTracking
        request={request}
        timeline={timeline}
        proposalRevision={proposalRevision}
        publishedResult={publishedResult}
        correction={correction}
        resultView={result ? <FinancialOutcomeCard result={result} /> : null}
      />
      {request.reviewStage === 'advanced' ? (
        <FinancialPackagePanel
          requestId={requestId}
          trackingCode={request.trackingCode ?? null}
          canSubmit={(request.allowedActions ?? []).includes('submitFinancialPackage')}
          resultPublished={Boolean(result)}
        />
      ) : null}
      <div className="flex justify-end">
        <Button asChild variant="outline-gray" size="40">
          <Link href={`/dashboard/letters/new?requestId=${encodeURIComponent(requestId)}`}>
            <Typography as="span" variant="16/semibold" className="text-inherit">نامه به دبیرخانه</Typography>
          </Link>
        </Button>
      </div>
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
