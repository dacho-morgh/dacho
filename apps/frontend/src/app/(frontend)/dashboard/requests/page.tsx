import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'

import { AdminRequestList } from '@/components/dashboard/admin-request-list'
import { RequestsListView, type RequestItem } from '@/components/dashboard/requests'
import { mapRequestItem, type Paginated, type RequestDto } from '@/utilities/dashboard-api'
import { isSeniorManagerUser, serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'لیست درخواست‌ها',
  description: 'مشاهده، جستجو و پیگیری وضعیت درخواست‌های ثبت شده در سامانه کارخانه نوآوری',
}

export default async function RequestsPage() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSeniorManager = await isSeniorManagerUser(payload, user)

  if (isSeniorManager) {
    return <AdminRequestList />
  }

  const res = await serverDashboardFetch<Paginated<RequestDto>>('/requests?limit=100')
  const items: RequestItem[] = (res?.items ?? []).map(mapRequestItem)

  return (
    <div className="flex flex-1 flex-col bg-neutral-50 px-4 pt-6 pb-4 sm:pt-10">
      <RequestsListView items={items} />
    </div>
  )
}
