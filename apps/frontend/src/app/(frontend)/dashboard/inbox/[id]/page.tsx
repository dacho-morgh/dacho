import type { Metadata } from 'next'
import React from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { MailDetailView } from '@/components/dashboard/mail-detail-view'

export const metadata: Metadata = {
  title: 'مشاهده نامه | کارخانه نوآوری',
  description: 'مشاهده جزئیات نامه و مکاتبات اداری',
}

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function InboxDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <DashboardLayout>
      <div className="pb-12">
        <MailDetailView />
      </div>
    </DashboardLayout>
  )
}
