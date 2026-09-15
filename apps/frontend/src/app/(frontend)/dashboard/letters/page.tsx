import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'

import { AdminLettersView } from '@/components/dashboard/admin-letters-view'
import { InboxListView, type LetterItem } from '@/components/dashboard/inbox-list-view'
import { mapLetterItem, type LetterDto, type Paginated } from '@/utilities/dashboard-api'
import { isSeniorManagerUser, serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'کارتابل نامه',
  description: 'مشاهده نامه‌ها، پیام‌ها و مکاتبات اداری در سامانه کارخانه نوآوری صنایع انرژی بوشهر',
}

interface PageProps {
  searchParams?: Promise<{ state?: 'default' | 'loading' | 'empty' }>
}

export default async function LettersPage(props: PageProps) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSeniorManager = await isSeniorManagerUser(payload, user)

  if (isSeniorManager) {
    const result = await serverDashboardFetch<Paginated<LetterDto>>('/admin/letters?limit=100')
    const letters: LetterItem[] = (result?.items ?? []).map(mapLetterItem)
    return (
      <div className="flex min-h-screen w-full flex-col bg-neutral-50 p-6" dir="rtl">
        <AdminLettersView initialLetters={letters} />
      </div>
    )
  }

  const searchParams = await props.searchParams
  const state = searchParams?.state ?? 'default'

  const res = await serverDashboardFetch<Paginated<LetterDto>>('/letters?limit=100')
  const fetchedLetters: LetterItem[] = (res?.items ?? []).map(mapLetterItem)

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#fafafa] px-4 pt-6 pb-12 sm:px-6 sm:pt-10 lg:px-8">
      <InboxListView initialLetters={fetchedLetters} state={state} />
    </div>
  )
}
