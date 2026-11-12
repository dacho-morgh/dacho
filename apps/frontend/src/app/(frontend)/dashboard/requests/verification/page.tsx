import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DashboardReadNotice } from '@/components/dashboard/dashboard-read-notice'
import { VerificationProgress } from '@/components/dashboard/verification-progress'
import { Typography } from '@/components/ui/typography'
import type { CompanyVerificationDto } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پیگیری احراز هویت شرکت',
  description: 'روند بررسی درخواست احراز هویت شرکت در سامانه کارخانه نوآوری صنایع انرژی بوشهر',
}

/** The company's own verification case: its place in the process and what happened to each submission. */
export default async function VerificationRequestPage() {
  const result = await serverDashboardFetchResult<CompanyVerificationDto>('/profile/verification')
  // Only a company representative has a verification; every other role has no such page.
  if (result.kind === 'denied' || (result.kind === 'unavailable' && result.status === 404)) notFound()
  const failure = unavailableReasonFor(result)

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-50 px-4 pb-4 pt-10 sm:px-6 lg:px-4" dir="rtl">
      <nav aria-label="مسیر صفحه" className="mb-6 flex flex-wrap items-center gap-2">
        <Typography asChild variant="16/regular" className="shrink-0 text-neutral-500 hover:text-brand-600">
          <Link href="/dashboard/requests">لیست درخواست‌ها</Link>
        </Typography>
        <Typography as="span" variant="16/regular" className="text-neutral-500" aria-hidden="true">/</Typography>
        <Typography as="h1" variant="24/bold" className="text-neutral-700">درخواست احراز هویت شرکت</Typography>
      </nav>
      {failure || result.kind !== 'ok' ? (
        <DashboardReadNotice reason={failure ?? 'unavailable'} retryHref="/dashboard/requests/verification" />
      ) : (
        <VerificationProgress verification={result.data} />
      )}
    </div>
  )
}
