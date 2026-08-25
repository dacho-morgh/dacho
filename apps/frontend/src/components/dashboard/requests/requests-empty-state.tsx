import React from 'react'
import Link from 'next/link'
import { EmptyInboxIllustration } from '@/components/icons'
import { Typography } from '@/components/ui/typography'

export interface RequestsEmptyStateProps {
  title?: string
  description?: string
  actionHref?: string
  actionLabel?: string
  className?: string
}

/**
 * Empty State for Requests (Figma node 50:9422 / 53:10470)
 */
export function RequestsEmptyState({
  title = 'درخواستی در این صفحه موجود نیست',
  description = 'در رویداد جدید درخواست خود را ثبت کنید',
  actionHref = '/dashboard/events',
  actionLabel = 'ارسال درخواست',
  className = '',
}: RequestsEmptyStateProps) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center px-4 text-center ${className}`}
    >
      <div className="flex flex-col items-center">
        <EmptyInboxIllustration className="size-20" />

        <Typography variant="14/semibold" className="mt-1 text-neutral-600">
          {title}
        </Typography>

        <Typography variant="12/regular" className="text-neutral-500">
          {description}
        </Typography>

        <Link
          href={actionHref}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-[10px] px-2 text-brand-500 transition-colors hover:bg-[#eef2ff] hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <Typography as="span" variant="16/semibold" className="text-inherit">
            {actionLabel}
          </Typography>
        </Link>
      </div>
    </div>
  )
}
