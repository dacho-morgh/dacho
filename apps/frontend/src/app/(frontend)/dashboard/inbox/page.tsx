import type { Metadata } from 'next'
import React from 'react'
import { InboxListView, type LetterItem } from '@/components/dashboard/inbox-list-view'
import { mapLetterItem, type LetterDto, type Paginated } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'کارتابل نامه',
  description: 'مشاهده نامه‌ها، پیام‌ها و مکاتبات اداری در سامانه کارخانه نوآوری',
}

export default async function InboxPage() {
  const res = await serverDashboardFetch<Paginated<LetterDto>>('/letters?limit=100')
  const letters: LetterItem[] = (res?.items ?? []).map(mapLetterItem)

  return (
    <div className="flex flex-1 flex-col bg-neutral-50 px-4 pt-6 pb-4 sm:pt-10">
      <InboxListView initialLetters={letters} />
    </div>
  )
}
