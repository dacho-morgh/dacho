import type { Metadata } from 'next'
import React from 'react'
import { InboxListView } from '@/components/dashboard/inbox-list-view'

export const metadata: Metadata = {
  title: 'کارتابل نامه',
  description: 'مشاهده نامه‌ها، پیام‌ها و مکاتبات اداری در سامانه کارخانه نوآوری',
}

export default function InboxPage() {
  return (
    <div className="p-6 pb-12 sm:p-8">
      <InboxListView />
    </div>
  )
}
