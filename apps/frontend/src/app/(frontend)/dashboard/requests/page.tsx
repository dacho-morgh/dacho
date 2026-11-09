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
import { companyRequestStage, type CompanyRequestStage } from '@/utilities/company-request-stage'
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

const COMPANY_PAGE_SIZE = 50
/** A company's own requests are few; the stage filter and its counts are computed over all of them. */
const COMPANY_FETCH_LIMIT = 500

/**
 * The company's list (a plain async function, so the page resolves it like any other branch). The company filters by its three stages (design QA #280), which fold the
 * internal status and review stage; the API filters by the real ones, so the company's own scoped
 * list is read once and filtered, counted and paged here.
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
  // `page` is applied here, so the API is always asked for the first (and only) page.
  const result = await serverDashboardFetchResult<Paginated<RequestDto>>(`/requests?limit=${COMPANY_FETCH_LIMIT}&page=1${filterQuery}`)
  const notice = unavailableReasonFor(result)
  const all = result.kind === 'ok' ? result.data.items : []
  const stageCounts: Record<CompanyRequestStage | 'all', number> = { all: all.length, verification: 0, reviewing: 0, finished: 0 }
  for (const dto of all) stageCounts[companyRequestStage(dto)] += 1
  const matching = filters.phase ? all.filter((dto) => companyRequestStage(dto) === filters.phase) : all
  const totalPages = Math.max(1, Math.ceil(matching.length / COMPANY_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const items: RequestItem[] = matching.slice((currentPage - 1) * COMPANY_PAGE_SIZE, currentPage * COMPANY_PAGE_SIZE).map(mapRequestItem)
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
      {result.kind === 'ok' && <RequestsPagination page={currentPage} totalPages={totalPages} filters={filters} />}
    </div>
  )
}
