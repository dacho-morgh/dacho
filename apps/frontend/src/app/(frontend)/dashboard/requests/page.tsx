import type { Metadata } from 'next'
import React from 'react'

import { RequestsListView, type RequestItem } from '@/components/dashboard/requests'
import { mapRequestItem, type Paginated, type RequestDto } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'

export const metadata: Metadata = {
  title: 'لیست درخواست‌ها',
  description: 'مشاهده، جستجو و پیگیری وضعیت درخواست‌های ثبت شده در سامانه کارخانه نوآوری',
}

export default async function RequestsPage() {
  const res = await serverDashboardFetch<Paginated<RequestDto>>('/requests?limit=100')
  const items: RequestItem[] = (res?.items ?? []).map(mapRequestItem)

  return (
    <div className="flex flex-1 flex-col bg-neutral-50 px-4 pt-6 pb-4 sm:pt-10">
      <RequestsListView items={items} />
    </div>
  )
}