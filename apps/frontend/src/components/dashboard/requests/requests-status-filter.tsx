import React from 'react'
import Link from 'next/link'

import { Typography } from '@/components/ui/typography'
import type { RequestStatus } from './types'

type StatusFilterValue = RequestStatus | 'all'

const OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: 'all', label: 'همه' },
  { value: 'in_review', label: 'در حال بررسی' },
  { value: 'action_needed', label: 'نیازمند اقدام' },
  { value: 'approved', label: 'تایید شده' },
  { value: 'rejected', label: 'رد شده' },
  { value: 'draft', label: 'پیش‌نویس' },
]

export interface RequestsStatusFilterProps {
  basePath: string
  active?: StatusFilterValue
  /** Counts come from `GET /stats`; omit when the caller has no aggregate. */
  counts?: Partial<Record<StatusFilterValue, number>>
  className?: string
}

/**
 * Server-driven status filter. Filter state lives in the URL (`?status=`), so
 * it survives back navigation, refresh and sharing; the scope itself is still
 * enforced by the API, not by the link.
 */
export function RequestsStatusFilter({
  basePath,
  active = 'all',
  counts,
  className = '',
}: RequestsStatusFilterProps) {
  return (
    <nav aria-label="فیلتر وضعیت درخواست‌ها" className={`flex flex-wrap items-center gap-2 ${className}`}>
      {OPTIONS.map((option) => {
        const isActive = option.value === active
        const count = counts?.[option.value]
        return (
          <Link
            key={option.value}
            href={option.value === 'all' ? basePath : `${basePath}?status=${option.value}`}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex h-10 items-center rounded-[10px] px-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
              isActive
                ? 'bg-brand-600 text-white hover:bg-brand-700'
                : 'bg-white text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Typography as="span" variant="14/regular" className="text-inherit">
              {typeof count === 'number' ? `${option.label} (${count.toLocaleString('fa-IR')})` : option.label}
            </Typography>
          </Link>
        )
      })}
    </nav>
  )
}
