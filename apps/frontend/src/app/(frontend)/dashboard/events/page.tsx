import type { Metadata } from 'next'
import React from 'react'
import { EventsView } from '@/components/dashboard/events-view'

export const metadata: Metadata = {
  title: 'رویدادها و نمایشگاه‌ها',
  description: 'مشاهده، ثبت‌نام و رزرو پاویون‌های اختصاصی در رویدادها و نمایشگاه‌های صنعتی و نوآوری',
}

export default function EventsPage() {
  return (
    <div className="p-6 pb-12 sm:p-8">
      <EventsView />
    </div>
  )
}
