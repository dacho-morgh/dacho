import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { MailDetailView } from '@/components/dashboard/mail-detail-view'
import { mapMailData, type LetterDto } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'مشاهده نامه',
  description: 'مشاهده جزئیات نامه و مکاتبات اداری',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function LetterDetailPage({ params }: PageProps) {
  const { id } = await params

  const res = await serverDashboardFetch<{ letter: LetterDto }>(`/letters/${id}`)
  if (!res?.letter) notFound()
  const mail = mapMailData(res.letter)

  return (
    <div className="p-6 pb-12 sm:p-8">
      <MailDetailView mail={mail} />
    </div>
  )
}