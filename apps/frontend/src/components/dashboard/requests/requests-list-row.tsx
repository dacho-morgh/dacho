import React from 'react'
import Link from 'next/link'
import { ListRow } from '@/components/dashboard/list-table'
import { Typography } from '@/components/ui/typography'
import { RequestStatusBadge } from './request-status-badge'
import { RequestRowActions } from './request-row-actions'
import type { RequestItem } from './types'

export interface RequestsListRowProps {
  item: RequestItem
}

/** One request; a click (or Enter) anywhere on the row opens its dossier, the link and the action keep their own. */
export function RequestsListRow({ item }: RequestsListRowProps) {
  const href = `/dashboard/requests/${encodeURIComponent(item.id)}`
  return (
    <ListRow href={href}>
      {/* Column 1: Title (16/regular #525252) + tracking code */}
      <td className="h-18 px-4">
        <Typography variant="16/regular" className="truncate text-neutral-600">
          <Link href={href} className="hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500">
            {item.title}
          </Link>
        </Typography>
        <Typography variant="12/regular" className="mt-1 font-mono text-neutral-400">
          کد پیگیری: {item.trackingCode}
        </Typography>
        {item.nextAction ? (
          <Typography variant="12/regular" className="mt-1 truncate text-neutral-500" data-testid="row-next-action">
            اقدام شما: {item.nextAction}
          </Typography>
        ) : null}
      </td>

      {/* Column 2: Status Badge */}
      <td className="h-18 px-4">
        <RequestStatusBadge status={item.status} label={item.statusLabel} />
        {item.stageLabel ? (
          <Typography variant="12/regular" className="mt-1 truncate text-neutral-500" data-testid="row-stage">
            {item.stageLabel}
            {item.revision ? ` · نسخه ${item.revision.toLocaleString('fa-IR')}` : ''}
          </Typography>
        ) : null}
      </td>

      {/* Column 3: Due Date (16/regular #525252) */}
      <td className="h-18 px-4">
        <Typography variant="16/regular" className="whitespace-nowrap text-neutral-600">
          {item.dueDate}
        </Typography>
      </td>

      {/* Column 4: Created Date (16/regular #525252) */}
      <td className="h-18 px-4">
        <Typography variant="16/regular" className="whitespace-nowrap text-neutral-600">
          {item.createdDate}
        </Typography>
      </td>

      {/* Column 5: Actions */}
      <td className="h-18 px-2 text-end">
        <RequestRowActions requestId={item.id} />
      </td>
    </ListRow>
  )
}
