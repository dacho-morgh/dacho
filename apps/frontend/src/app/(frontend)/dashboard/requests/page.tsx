import type { Metadata } from 'next'
import React from 'react'
import { RequestsListView } from '@/components/dashboard/requests-list-view'

export const metadata: Metadata = {
  title: 'لیست درخواست‌ها | کارخانه نوآوری',
  description: 'مشاهده، جستجو و پیگیری وضعیت درخواست‌های ثبت شده در سامانه کارخانه نوآوری',
}

export default function RequestsPage() {
  return (
    <div className="p-6 sm:p-8 pb-12">
      <RequestsListView />
    </div>
  )
}
