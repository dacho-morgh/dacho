import type { Metadata } from 'next'
import Link from 'next/link'

import { OfflineNotice } from '@/components/dashboard/offline-notice'
import { Typography } from '@/components/ui/typography'
import { formatDate, type FollowUpQueueDto } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پیگیری سرمایه‌گذاری',
}

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: rawPage } = await searchParams
  const parsed = Number(rawPage)
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
  const result = await serverDashboardFetchResult<FollowUpQueueDto>(`/investment/follow-ups?page=${page}`)

  if (result.kind !== 'ok') {
    return (
      <main className="mx-auto w-full max-w-4xl p-6 sm:p-10" dir="rtl">
        <OfflineNotice reason={unavailableReasonFor(result) ?? 'unavailable'} retryHref="/dashboard/follow-ups" />
      </main>
    )
  }

  const { items, totalPages } = result.data
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-10" dir="rtl">
      <div className="flex flex-col gap-1">
        <Typography as="h1" variant="24/bold" className="text-neutral-900">پیگیری سرمایه‌گذاری</Typography>
        <Typography variant="14/regular" className="text-neutral-500">
          پرونده‌هایی که یادداشت سرمایه‌گذاری آن‌ها به دبیرخانه رسیده است؛ پرونده‌های بدون نتیجه منتشرشده در ابتدا می‌آیند.
        </Typography>
      </div>
      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.requestId}>
              <Link
                href={`/dashboard/requests/${encodeURIComponent(item.requestId)}`}
                className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-white p-4 hover:border-brand-600"
              >
                <Typography variant="16/semibold" className="text-neutral-900">{item.title}</Typography>
                <Typography variant="14/regular" className="text-neutral-500">
                  {item.companyName ?? 'شرکت نامشخص'} · <span className="font-mono">{item.trackingCode}</span>
                </Typography>
                <Typography variant="12/regular" className="text-neutral-500">
                  یادداشت نسخه {item.latestMemoVersion} · {formatDate(item.latestMemoSentAt)} ·{' '}
                  {item.publishedAt ? `نتیجه منتشرشده ${formatDate(item.publishedAt)}` : 'نتیجه منتشر نشده'}
                </Typography>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Typography variant="14/regular" className="rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-500">
          هنوز یادداشتی به دبیرخانه نرسیده است.
        </Typography>
      )}
      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="صفحه‌بندی">
          {page > 1 ? (
            <Link href={`/dashboard/follow-ups?page=${page - 1}`}>
              <Typography as="span" variant="14/regular" color="brand-600">صفحه قبل</Typography>
            </Link>
          ) : <span />}
          <Typography variant="12/regular" className="text-neutral-500">صفحه {page} از {totalPages}</Typography>
          {page < totalPages ? (
            <Link href={`/dashboard/follow-ups?page=${page + 1}`}>
              <Typography as="span" variant="14/regular" color="brand-600">صفحه بعد</Typography>
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </main>
  )
}
