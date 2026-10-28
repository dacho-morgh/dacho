import React from 'react'
import Link from 'next/link'

import { Typography } from '@/components/ui/typography'

/**
 * A failed request is not an empty list. Every dashboard surface renders this
 * notice for `unavailable`/`denied`/`expired` results so a network or session
 * fault never looks like "no records".
 */
import type { UnavailableReason } from '@/utilities/dashboard-fetch-result'

export type { UnavailableReason }

const COPY: Record<UnavailableReason, { title: string; description: string }> = {
  unavailable: {
    title: 'دریافت اطلاعات انجام نشد',
    description: 'ارتباط با سرویس برقرار نشد یا پاسخ نامعتبر بود. داده‌ها ممکن است ناقص باشند.',
  },
  denied: {
    title: 'دسترسی به این بخش مجاز نیست',
    description: 'نقش فعلی شما اجازه مشاهده این اطلاعات را ندارد.',
  },
  expired: {
    title: 'نشست شما منقضی شده است',
    description: 'برای ادامه کار دوباره وارد حساب خود شوید.',
  },
}

export interface OfflineNoticeProps {
  reason: UnavailableReason
  retryHref?: string
  className?: string
}

export function OfflineNotice({ reason, retryHref, className = '' }: OfflineNoticeProps) {
  const copy = COPY[reason]
  return (
    <section
      role="alert"
      data-state={reason}
      className={`rounded-2xl border border-warning-500 bg-warning-50 p-4 ${className}`}
    >
      <Typography as="h2" variant="14/semibold" color="neutral-700">
        {copy.title}
      </Typography>
      <Typography as="p" variant="12/regular" color="neutral-600" className="mt-1">
        {copy.description}
      </Typography>
      {retryHref && (
        <Link
          href={retryHref}
          className="mt-2 inline-flex h-8 items-center rounded-[10px] bg-white px-3 text-brand-600 hover:bg-neutral-100"
        >
          <Typography as="span" variant="14/regular" className="text-inherit">
            تلاش دوباره
          </Typography>
        </Link>
      )}
    </section>
  )
}
