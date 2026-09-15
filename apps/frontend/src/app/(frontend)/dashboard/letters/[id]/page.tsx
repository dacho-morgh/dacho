import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { MailDetailView } from '@/components/dashboard/mail-detail-view'
import { Typography } from '@/components/ui/typography'
import { mapMailData, type LetterDto } from '@/utilities/dashboard-api'
import { isSeniorManagerUser, serverDashboardFetch } from '@/utilities/dashboard-server'

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
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSeniorManager = await isSeniorManagerUser(payload, user)

  if (isSeniorManager) {
    const result = await serverDashboardFetch<{ letter: LetterDto }>(
      `/admin/letters/${encodeURIComponent(id)}`,
    )
    if (!result?.letter) notFound()
    return (
      <main className="mx-auto w-full max-w-3xl p-6 sm:p-10" dir="rtl">
        <Typography as="h1" variant="24/bold" className="text-neutral-900">
          {result.letter.title}
        </Typography>
        <Typography variant="14/regular" className="mt-2 text-neutral-500">
          فرستنده: {result.letter.senderName || '—'} · گیرنده: {result.letter.recipientId}
        </Typography>
        <article className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <Typography variant="16/regular" className="whitespace-pre-wrap text-neutral-800">
            {result.letter.body}
          </Typography>
        </article>
      </main>
    )
  }

  const res = await serverDashboardFetch<{ letter: LetterDto }>(`/letters/${id}`)
  if (!res?.letter) notFound()
  const mail = mapMailData(res.letter)

  return (
    <div className="p-6 pb-12 sm:p-8">
      <MailDetailView mail={mail} />
    </div>
  )
}
