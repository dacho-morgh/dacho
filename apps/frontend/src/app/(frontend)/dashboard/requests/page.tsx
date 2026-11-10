import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'
import { AdminRequestList } from '@/components/dashboard/admin-request-list'
import {
  adminRequestsQuery,
  toAdminRequestsPage,
  type AdminRequestsApiResponse,
} from '@/components/dashboard/admin-request-list-data'
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
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import {
  canReadCompanyDossiers,
  canReadFollowUps,
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
    page?: string | string[]
    search?: string | string[]
    eventId?: string | string[]
    stage?: string | string[]
    queue?: string | string[]
    followUp?: string | string[]
    view?: string | string[]
  }>
}) {
  const query = await searchParams
  const status = parseRequestStatus(query.status)
  const page = parseRequestPage(query.page)
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const isInternal = isInternalDashboardUser(user)
  const canFollowUp = canReadFollowUps(user)
  // Only the Secretariat and the owner may ask for the follow-up cases; anyone else gets the whole list.
  const { followUp, ...otherFilters } = parseRequestFilters(query)
  const filters = canFollowUp && followUp ? { ...otherFilters, followUp } : otherFilters
  const filterQuery = requestFiltersQuery(filters)

  // Reviewers and employers work from their own assignment queue (T23), not the generic list.
  if (isReviewerRole(dashboardOperationalRole(user))) {
    const view = parseReviewQueueView(query.view)
    const reviewPage = parseReviewQueuePage(query.page)
    return <ReviewerQueue key={`${view}-${reviewPage}`} view={view} page={reviewPage} />
  }

  // Counts come from the same filters as the list, so a tab's number is the size of its list.
  const [statsResult, overviewResult] = await Promise.all([
    serverDashboardFetchResult<RequestStats>(`/stats${filterQuery.replace('&', '?')}`),
    serverDashboardFetchResult<DashboardOverviewDto>('/stats/overview'),
  ])
  const stats = statsResult.kind === 'ok' ? statsResult.data : undefined
  const counts = stats && {
    all: stats.total,
    in_review: stats.in_review,
    action_needed: stats.action_needed,
    approved: stats.approved,
    rejected: stats.rejected,
  }
  const filterForm = (
    <RequestsFilters
      status={status}
      filters={filters}
      events={overviewResult.kind === 'ok' ? (overviewResult.data.events ?? []) : []}
      counts={counts}
    />
  )

  const queueNote = <RequestsQueueNote filters={filters} />

  if (isInternal) {
    // The page is read here, so the table opens with its rows instead of a skeleton and a loading line.
    const adminQuery = adminRequestsQuery(status, page, filters)
    const firstPage = await serverDashboardFetchResult<AdminRequestsApiResponse>(`/admin/requests?${adminQuery}`)
    const initial = firstPage.kind === 'ok' ? toAdminRequestsPage(firstPage.data, page) : null
    return (
      <AdminRequestList
        status={status}
        page={page}
        filters={filters}
        counts={counts}
        events={overviewResult.kind === 'ok' ? (overviewResult.data.events ?? []) : []}
        canViewCompany={canReadCompanyDossiers(user)}
        canFollowUp={canFollowUp}
        initial={initial ? { ...initial, key: adminQuery } : undefined}
      />
    )
  }

  // The queue scope is server-side: `status` narrows an already authorized list
  // and a failed read stays distinguishable from an empty one.
  const result = await serverDashboardFetchResult<Paginated<RequestDto>>(
    `/requests?limit=50&page=${page}${status ? `&status=${status}` : ''}${filterQuery}`,
  )
  const notice = unavailableReasonFor(result)
  const items: RequestItem[] = result.kind === 'ok' ? result.data.items.map(mapRequestItem) : []

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-50 px-4 pt-6 pb-4 sm:pt-10">
      <RequestsListView
        items={items}
        notice={notice}
        retryHref={requestQueueHref('/dashboard/requests', status, page, filters)}
        state={result.kind === 'ok' && items.length === 0 ? 'empty' : 'default'}
        filterForm={filterForm}
        queueNote={queueNote}
      />
      {result.kind === 'ok' && (
        <RequestsPagination
          page={result.data.page}
          totalPages={result.data.totalPages}
          status={status}
          filters={filters}
        />
      )}
    </div>
  )
}
