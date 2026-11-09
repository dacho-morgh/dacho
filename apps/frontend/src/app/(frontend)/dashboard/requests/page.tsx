import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'
import { AdminRequestList } from '@/components/dashboard/admin-request-list'
import {
  parseRequestStatus,
  RequestsListView,
  type RequestItem,
} from '@/components/dashboard/requests'
import { RequestsFilters, RequestsQueueNote } from '@/components/dashboard/requests/requests-filters'
import { RequestsPagination } from '@/components/dashboard/requests/requests-pagination'
import {
  parseRequestFilters,
  parseRequestPage,
  type RequestQueueFilters,
  requestFiltersQuery,
  requestQueueHref,
} from '@/components/dashboard/requests/types'
import {
  mapRequestItem,
  type DashboardOverviewDto,
  type Paginated,
  type RequestDto,
  type RequestStats,
} from '@/utilities/dashboard-api'
import type { CompanyRequestStage } from '@/utilities/company-request-stage'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import {
  dashboardOperationalRole,
  isInternalDashboardUser,
  serverDashboardFetchResult,
} from '@/utilities/dashboard-server'
import { ReviewerQueue } from '@/components/dashboard/reviewer/reviewer-queue'
import { isReviewerRole, parseReviewQueuePage, parseReviewQueueView } from '@/utilities/reviewer-case'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'لیست درخواست‌ها',
  description: 'مشاهده، جستجو و پیگیری وضعیت درخواست‌های ثبت شده در سامانه کارخانه نوآوری',
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[]
    phase?: string | string[]
    page?: string | string[]
    search?: string | string[]
    eventId?: string | string[]
    stage?: string | string[]
    queue?: string | string[]
    view?: string | string[]
  }>
}) {
  const query = await searchParams
  const status = parseRequestStatus(query.status)
  const page = parseRequestPage(query.page)
  // `phase` is the company's own stage filter; staff filter by the real status and stage.
  const parsedFilters = parseRequestFilters(query)

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const isInternal = isInternalDashboardUser(user)
  const filters: RequestQueueFilters = isInternal ? { ...parsedFilters, phase: undefined } : parsedFilters
  const filterQuery = requestFiltersQuery(filters)

  // Reviewers and employers work from their own assignment queue (T23), not the generic list.
  if (isReviewerRole(dashboardOperationalRole(user))) {
    const view = parseReviewQueueView(query.view)
    const reviewPage = parseReviewQueuePage(query.page)
    return <ReviewerQueue key={`${view}-${reviewPage}`} view={view} page={reviewPage} />
  }

  const overviewResult = await serverDashboardFetchResult<DashboardOverviewDto>('/stats/overview')
  const events = overviewResult.kind === 'ok' ? (overviewResult.data.events ?? []) : []
  const queueNote = <RequestsQueueNote filters={filters} />

  if (!isInternal) return companyRequestsList({ page, filters, filterQuery, events, queueNote })

  // Counts come from the same filters as the list, so a tab's number is the size of its list.
  const statsResult = await serverDashboardFetchResult<RequestStats>(`/stats${filterQuery.replace('&', '?')}`)
  const stats = statsResult.kind === 'ok' ? statsResult.data : undefined
  const counts = stats && {
    all: stats.total,
    in_review: stats.in_review,
    action_needed: stats.action_needed,
    approved: stats.approved,
    rejected: stats.rejected,
  }
  const filterForm = <RequestsFilters status={status} filters={filters} events={events} counts={counts} />

  return (
    <AdminRequestList
      status={status}
      page={page}
      filters={filters}
      toolbar={filterForm}
      notice={queueNote}
    />
  )
}

/**
 * The company's list (a plain async function, so the page resolves it like any other branch). The
 * company filters by its three stages (design QA #280); the API folds status and review stage into
 * the same `phase`, so the list, its pages and each stage's count all come from the server.
 */
async function companyRequestsList({
  page,
  filters,
  filterQuery,
  events,
  queueNote,
}: {
  page: number
  filters: RequestQueueFilters
  filterQuery: string
  events: { id: string; title: string }[]
  queueNote: React.ReactNode
}) {
  // The counts read every stage under the other filters, as the staff tabs read every status.
  const [result, statsResult] = await Promise.all([
    serverDashboardFetchResult<Paginated<RequestDto>>(`/requests?limit=50&page=${page}${filterQuery}`),
    serverDashboardFetchResult<RequestStats>(`/stats${requestFiltersQuery({ ...filters, phase: undefined }).replace('&', '?')}`),
  ])
  const notice = unavailableReasonFor(result)
  const items: RequestItem[] = result.kind === 'ok' ? result.data.items.map(mapRequestItem) : []
  const phases = statsResult.kind === 'ok' ? statsResult.data.phases : undefined
  const stageCounts: Partial<Record<CompanyRequestStage | 'all', number>> | undefined =
    statsResult.kind === 'ok' ? { all: statsResult.data.total, ...phases } : undefined
  const filterForm = <RequestsFilters audience="company" filters={filters} events={events} stageCounts={stageCounts} />

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-50 px-4 pt-6 pb-4 sm:pt-10">
      <RequestsListView
        items={items}
        notice={notice}
        retryHref={requestQueueHref('/dashboard/requests', undefined, page, filters)}
        state={result.kind === 'ok' && items.length === 0 ? 'empty' : 'default'}
        filterForm={filterForm}
        queueNote={queueNote}
      />
      {result.kind === 'ok' && (
        <RequestsPagination page={result.data.page} totalPages={result.data.totalPages} filters={filters} />
      )}
    </div>
  )
}
