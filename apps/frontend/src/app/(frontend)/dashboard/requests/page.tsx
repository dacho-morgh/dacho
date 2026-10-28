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
import { RequestsPagination } from '@/components/dashboard/requests/requests-pagination'
import { parseRequestPage, requestQueueHref } from '@/components/dashboard/requests/types'
import { mapRequestItem, type Paginated, type RequestDto } from '@/utilities/dashboard-api'
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
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>
}) {
  const query = await searchParams
  const status = parseRequestStatus(query.status)
  const page = parseRequestPage(query.page)

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const isInternal = isInternalDashboardUser(user)

  if (isInternal) {
    return <AdminRequestList />
  }

  // The queue scope is server-side: `status` narrows an already authorized list
  // and a failed read stays distinguishable from an empty one.
  const result = await serverDashboardFetchResult<Paginated<RequestDto>>(
    `/requests?limit=50&page=${page}${status ? `&status=${status}` : ''}`,
  )
  const notice = unavailableReasonFor(result)
  const items: RequestItem[] = result.kind === 'ok' ? result.data.items.map(mapRequestItem) : []

  return (
    <div className="flex flex-1 flex-col bg-neutral-50 px-4 pt-6 pb-4 sm:pt-10">
      <RequestsListView
        items={items}
        notice={notice}
        activeStatus={status ?? 'all'}
        retryHref={requestQueueHref('/dashboard/requests', status, page)}
        state={result.kind === 'ok' && items.length === 0 ? 'empty' : 'default'}
      />
      {result.kind === 'ok' && (
        <RequestsPagination
          page={result.data.page}
          totalPages={result.data.totalPages}
          status={status}
        />
      )}
    </div>
  )
}
