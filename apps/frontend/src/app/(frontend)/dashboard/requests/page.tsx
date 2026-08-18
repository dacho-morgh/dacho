import type { Metadata } from 'next'
import React from 'react'
import { RequestsListView } from '@/components/dashboard/requests'

export const metadata: Metadata = {
  title: 'لیست درخواست‌ها | کارخانه نوآوری',
  description: 'مشاهده، جستجو و پیگیری وضعیت درخواست‌های ثبت شده در سامانه کارخانه نوآوری',
}

export default function RequestsPage() {
  return (
    <div className="flex flex-1 flex-col bg-neutral-50 px-4 pt-6 pb-4 sm:pt-10">
      <RequestsListView />
    </div>
  )
}
