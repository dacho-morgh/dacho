import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'
import { AdminRequestList } from '@/components/dashboard/admin-request-list'
import {
  parseRequestStatus,
  RequestsListView,
  RequestsStatusFilter,
  type RequestItem,
} from '@/components/dashboard/requests'
import { RequestsFilters } from '@/components/dashboard/requests/requests-filters'
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
import { isInternalDashboardUser, serverDashboardFetchResult } from '@/utilities/dashboard-server'
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
  }>
}) {
  const query = await searchParams
  const status = parseRequestStatus(query.status)
  const page = parseRequestPage(query.page)
  const filters = parseRequestFilters(query)
  const filterQuery = requestFiltersQuery(filters)

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const isInternal = isInternalDashboardUser(user)

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
    />
  )

  if (isInternal) {
    return (
      <>
        <div className="flex flex-col gap-3 px-4 pt-6 lg:pt-10">
          <RequestsStatusFilter
            basePath="/dashboard/requests"
            active={status ?? 'all'}
            counts={counts}
            filters={filters}
          />
          {filterForm}
        </div>
        <AdminRequestList status={status} page={page} filters={filters} />
      </>
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
    <div className="flex flex-1 flex-col bg-neutral-50 px-4 pt-6 pb-4 sm:pt-10">
      <RequestsListView
        items={items}
        notice={notice}
        activeStatus={status ?? 'all'}
        retryHref={requestQueueHref('/dashboard/requests', status, page, filters)}
        state={result.kind === 'ok' && items.length === 0 ? 'empty' : 'default'}
        counts={counts}
        filters={filters}
        filterForm={filterForm}
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
