import type { Metadata } from 'next'
import React from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { RequestsListView } from '@/components/dashboard/requests-list-view'

export const metadata: Metadata = {
  title: 'لیست درخواست‌ها | کارخانه نوآوری',
  description: 'مشاهده، جستجو و پیگیری وضعیت درخواست‌های ثبت شده در سامانه کارخانه نوآوری',
}

export default function RequestsPage() {
  return (
    <DashboardLayout>
      <div className="pb-12">
        <RequestsListView />
      </div>
    </DashboardLayout>
  )
}
