import type { Metadata } from 'next'
import React from 'react'
import { MailDetailView } from '@/components/dashboard/mail-detail-view'

export const metadata: Metadata = {
  title: 'مشاهده نامه',
  description: 'مشاهده جزئیات نامه و مکاتبات اداری',
}

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function LetterDetailPage({ params }: PageProps) {
  const { id: _id } = await params

  return (
    <div className="p-6 pb-12 sm:p-8">
      <MailDetailView />
    </div>
  )
}
