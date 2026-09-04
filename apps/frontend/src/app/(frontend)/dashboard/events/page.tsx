import type { Metadata } from 'next'
import React from 'react'
import { EventsView } from '@/components/dashboard/events-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'رویدادها و نمایشگاه‌ها',
  description: 'مشاهده، ثبت‌نام و رزرو پاویون‌های اختصاصی در رویدادها و نمایشگاه‌های صنعتی و نوآوری',
}

interface PageProps {
  searchParams?: Promise<{ state?: 'default' | 'loading' | 'empty' }>
}

export default async function EventsPage(props: PageProps) {
  const searchParams = await props.searchParams
  const state = searchParams?.state ?? 'default'

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#fafafa] px-4 pt-6 pb-12 sm:px-6 sm:pt-10 lg:px-8">
      <EventsView state={state} />
    </div>
  )
}
