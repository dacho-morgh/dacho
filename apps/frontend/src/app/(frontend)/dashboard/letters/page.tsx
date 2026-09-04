import type { Metadata } from 'next'
import React from 'react'

import { InboxListView, type LetterItem } from '@/components/dashboard/inbox-list-view'
import { mapLetterItem, type LetterDto, type Paginated } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'کارتابل نامه',
  description: 'مشاهده نامه‌ها، پیام‌ها و مکاتبات اداری در سامانه کارخانه نوآوری صنایع انرژی بوشهر',
}

interface PageProps {
  searchParams?: Promise<{ state?: 'default' | 'loading' | 'empty' }>
}

export default async function LettersPage(props: PageProps) {
  const searchParams = await props.searchParams
  const state = searchParams?.state ?? 'default'

  const res = await serverDashboardFetch<Paginated<LetterDto>>('/letters?limit=100')
  const fetchedLetters: LetterItem[] = (res?.items ?? []).map(mapLetterItem)

  // Use fetched letters if any exist in the database; otherwise fallback to Figma mock data for 1:1 parity
  const initialLetters = fetchedLetters.length > 0 ? fetchedLetters : undefined

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#fafafa] px-4 pt-6 pb-12 sm:px-6 sm:pt-10 lg:px-8">
      <InboxListView initialLetters={initialLetters} state={state} />
    </div>
  )
}