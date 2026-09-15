import { notFound } from 'next/navigation'
import { serverDashboardFetch } from '@/utilities/dashboard-server'
import type { LetterDto } from '@/utilities/dashboard-api'
import { Typography } from '@/components/ui/typography'

export const dynamic = 'force-dynamic'
export default async function AdminLetterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await serverDashboardFetch<{ letter: LetterDto }>(`/admin/letters/${encodeURIComponent(id)}`)
  if (!result?.letter) notFound()
  return <main className="mx-auto w-full max-w-3xl p-6 sm:p-10" dir="rtl"><Typography as="h1" variant="24/bold" className="text-neutral-900">{result.letter.title}</Typography><Typography variant="14/regular" className="mt-2 text-neutral-500">فرستنده: {result.letter.senderName || '—'} · گیرنده: {result.letter.recipientId}</Typography><article className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6"><Typography variant="16/regular" className="whitespace-pre-wrap text-neutral-800">{result.letter.body}</Typography></article></main>
}
