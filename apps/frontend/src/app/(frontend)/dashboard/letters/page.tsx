import type { Metadata } from 'next'
import React from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { InboxListView } from '@/components/dashboard/inbox-list-view'

export const metadata: Metadata = {
  title: 'کارتابل نامه | کارخانه نوآوری',
  description: 'مشاهده نامه‌ها، پیام‌ها و مکاتبات اداری در سامانه کارخانه نوآوری',
}

export default function LettersPage() {
  return (
    <DashboardLayout>
      <div className="pb-12">
        <InboxListView />
      </div>
    </DashboardLayout>
  )
}
