import type { Metadata } from 'next'
import React from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { EventsView } from '@/components/dashboard/events-view'

export const metadata: Metadata = {
  title: 'رویدادها و نمایشگاه‌ها | کارخانه نوآوری',
  description: 'مشاهده، ثبت‌نام و رزرو پاویون‌های اختصاصی در رویدادها و نمایشگاه‌های صنعتی و نوآوری',
}

export default function EventsPage() {
  return (
    <DashboardLayout>
      <div className="pb-12">
        <EventsView />
      </div>
    </DashboardLayout>
  )
}
