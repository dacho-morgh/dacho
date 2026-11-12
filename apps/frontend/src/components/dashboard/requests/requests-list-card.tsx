'use client'

import Link from 'next/link'
import React from 'react'
import { useRowLink } from '@/components/dashboard/list-table'
import { Typography } from '@/components/ui/typography'
import { RequestRowActions } from './request-row-actions'
import { RequestStatusBadge } from './request-status-badge'
import type { RequestItem } from './types'

/**
 * The phone layout of a company request (below `md`): the table needs more width than a phone has,
 * so each request is a card with the same facts. Like the table row, a click anywhere on the card
 * opens the dossier; the title link and the action keep their own.
 */
export function RequestsListCard({ item }: { item: RequestItem }) {
  const href = item.href ?? `/dashboard/requests/${encodeURIComponent(item.id)}`
  const link = useRowLink(href)
  return (
    <div
      data-testid="request-card"
      className="cursor-pointer rounded-xl border border-neutral-100 p-4 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-500"
      {...link}
    >
      <div className="flex items-center justify-between gap-3">
        <RequestStatusBadge stage={item.stage ?? 'reviewing'} label={item.statusLabel} />
        <RequestRowActions requestId={item.id} href={item.href} />
      </div>
      <Typography variant="16/regular" className="mt-3 break-words text-neutral-600">
        <Link href={href} className="hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500">
          {item.title}
        </Link>
      </Typography>
      {item.trackingCode ? (
        <Typography variant="12/regular" className="mt-1 font-mono text-neutral-400">
          کد پیگیری: {item.trackingCode}
        </Typography>
      ) : null}
      {item.nextAction ? (
        <Typography variant="12/regular" className="mt-1 break-words text-neutral-500">
          اقدام شما: {item.nextAction}
        </Typography>
      ) : null}
      {item.revision ? (
        <Typography variant="12/regular" className="mt-1 text-neutral-500">
          نسخه {item.revision.toLocaleString('fa-IR')}
        </Typography>
      ) : null}
      <dl className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
        <div className="min-w-0">
          <dt><Typography as="span" variant="12/regular" className="text-neutral-400">تاریخ سررسید</Typography></dt>
          <dd><Typography as="span" variant="14/regular" className="whitespace-nowrap text-neutral-600">{item.dueDate || '—'}</Typography></dd>
        </div>
        <div className="min-w-0">
          <dt><Typography as="span" variant="12/regular" className="text-neutral-400">تاریخ ثبت</Typography></dt>
          <dd><Typography as="span" variant="14/regular" className="whitespace-nowrap text-neutral-600">{item.createdDate || '—'}</Typography></dd>
        </div>
      </dl>
    </div>
  )
}
