import type { Metadata } from 'next'
import React from 'react'
import { InboxListView } from '@/components/dashboard/inbox-list-view'

export const metadata: Metadata = {
  title: 'کارتابل نامه | کارخانه نوآوری',
  description: 'مشاهده نامه‌ها، پیام‌ها و مکاتبات اداری در سامانه کارخانه نوآوری',
}

export default function LettersPage() {
  return (
    <div className="p-6 sm:p-8 pb-12">
      <InboxListView />
    </div>
  )
}
