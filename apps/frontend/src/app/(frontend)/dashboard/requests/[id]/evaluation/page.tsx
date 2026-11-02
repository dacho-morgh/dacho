import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import {
  ReviewerCaseUnavailable,
  type ReviewerCaseUnavailableKind,
} from '@/components/dashboard/reviewer/reviewer-case-file'
import { ReviewEvaluationForm } from '@/components/dashboard/reviewer/review-evaluation-form'
import { dashboardOperationalRole, serverDashboardFetchResult, type DashboardFetchResult } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'
import type { OwnEvaluationResponse } from '@/utilities/review-evaluation'
import { isReviewerRole, type ReviewCaseFileDto } from '@/utilities/reviewer-case'

export const dynamic = 'force-dynamic'

function unavailable(result: DashboardFetchResult<unknown>): ReviewerCaseUnavailableKind {
  if (result.kind === 'unauthenticated') return 'expired'
  if (result.kind === 'denied') return 'denied'
  return result.kind === 'unavailable' && result.status === 404 ? 'not-assigned' : 'error'
}

/**
 * The assigned reviewer's or employer's own evaluation form. Both reads are the
 * server's: the case file says which assignment and whether it is still open,
 * the evaluation read returns only this person's evaluation and the revision
 * every write must name. Any other role returns to the dossier.
 */
export default async function ReviewEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const role = dashboardOperationalRole(user)
  const path = `/dashboard/requests/${encodeURIComponent(id)}/evaluation`
  if (!user) return <ReviewerCaseUnavailable kind="expired" path={path} />
  // Oversight roles read evaluations in the dossier; only an assigned reviewer has a form here.
  if (!isReviewerRole(role)) redirect(`/dashboard/requests/${encodeURIComponent(id)}`)

  const [caseFile, evaluation] = await Promise.all([
    serverDashboardFetchResult<ReviewCaseFileDto>(`/review/cases/${encodeURIComponent(id)}`),
    serverDashboardFetchResult<OwnEvaluationResponse>(`/requests/${encodeURIComponent(id)}/evaluation`),
  ])
  if (caseFile.kind !== 'ok') return <ReviewerCaseUnavailable kind={unavailable(caseFile)} path={path} />
  if (evaluation.kind !== 'ok') return <ReviewerCaseUnavailable kind={unavailable(evaluation)} path={path} />

  return <ReviewEvaluationForm key={id} requestId={id} caseItem={caseFile.data.case} initial={evaluation.data} />
}
