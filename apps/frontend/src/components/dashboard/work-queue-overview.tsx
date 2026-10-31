import Link from 'next/link'
import React from 'react'

import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
import { requestQueueHref } from '@/components/dashboard/requests/types'
import { Typography } from '@/components/ui/typography'
import type { WorkQueueCountDto } from '@/utilities/dashboard-api'

/** Queues listed on the requests page. The others are counts whose own list lives elsewhere. */
const REQUEST_QUEUE_LABELS: Record<string, string> = {
  reopen_rejected: 'پرونده‌های ردشده قابل بازگشایی',
  follow_up_unpublished: 'پرونده‌های دارای یادداشت بدون نتیجه منتشرشده',
  supplementary_undelivered: 'مدارک تکمیلی در انتظار تحویل به مسئول سرمایه‌گذاری',
  chief_triage: 'در انتظار بررسی اولیه',
  chief_start_review: 'در انتظار تعیین داوران',
  chief_decide: 'داوری کامل‌شده در انتظار تصمیم',
  evaluation_pending: 'ارزیابی‌های در انتظار ثبت نهایی',
  memo_pending: 'پرونده‌های در انتظار یادداشت سرمایه‌گذاری',
  company_draft: 'پیش‌نویس‌های ارسال‌نشده',
  company_correction: 'درخواست‌های نیازمند اصلاح',
  company_financial_package: 'در انتظار ارسال مدارک مالی',
  company_supplementary: 'در انتظار ارسال مدارک تکمیلی',
}

const OTHER_QUEUES: Record<string, { label: string; href?: string }> = {
  verification_pending: { label: 'احراز هویت شرکت‌ها در انتظار بررسی' },
  support_open: { label: 'تیکت‌های پشتیبانی در انتظار پاسخ' },
  company_verification_returned: {
    label: 'احراز هویت شرکت نیازمند اصلاح',
    href: '/dashboard/profile/company',
  },
}

export function workQueueLabel(key: string): string | undefined {
  return REQUEST_QUEUE_LABELS[key] ?? OTHER_QUEUES[key]?.label
}

function hrefOf(key: string): string | undefined {
  if (REQUEST_QUEUE_LABELS[key]) return requestQueueHref('/dashboard/requests', undefined, 1, { queue: key })
  return OTHER_QUEUES[key]?.href
}

export function WorkQueueOverview({
  queues,
  notice,
  retryHref = '/dashboard',
}: {
  queues?: WorkQueueCountDto[]
  /** A failed read is not "nothing to do", so it never renders as an empty list. */
  notice?: UnavailableReason
  retryHref?: string
}) {
  if (notice) return <OfflineNotice reason={notice} retryHref={retryHref} />
  const known = (queues ?? []).filter((queue) => workQueueLabel(queue.key))
  const pending = known.filter((queue) => queue.count > 0)

  return (
    <section className="flex flex-col gap-3" aria-label="کارهای نیازمند اقدام" dir="rtl">
      <Typography as="h2" variant="16/semibold" color="neutral-900">
        کارهای نیازمند اقدام
      </Typography>
      {pending.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((queue) => {
            const href = hrefOf(queue.key)
            const content = (
              <>
                <Typography variant="14/regular" color="secondary">
                  {workQueueLabel(queue.key)}
                </Typography>
                <Typography variant="24/bold" color="neutral-900">
                  {queue.count.toLocaleString('fa-IR')}
                </Typography>
              </>
            )
            const box = 'flex h-full items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4'
            return (
              <li key={queue.key}>
                {href ? (
                  <Link href={href} className={`${box} hover:border-brand-600`}>
                    {content}
                  </Link>
                ) : (
                  <div className={box}>{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <Typography variant="14/regular" color="secondary" className="rounded-2xl border border-neutral-200 bg-white p-4">
          در حال حاضر کاری در انتظار اقدام شما نیست.
        </Typography>
      )}
    </section>
  )
}
