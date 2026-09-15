import React from 'react'
import Link from 'next/link'
import { Typography } from '@/components/ui/typography'
import { RequestStatusBadge } from './request-status-badge'
import { RequestRowActions } from './request-row-actions'
import type { RequestItem } from './types'

export interface RequestsListRowProps {
  item: RequestItem
  onView?: (id?: string) => void
  onEdit?: (id?: string) => void
  onCancel?: (id?: string) => void
}

export function RequestsListRow({
  item,
  onView,
  onEdit,
  onCancel,
}: RequestsListRowProps) {
  return (
    <tr className="h-18 border-b border-neutral-100 transition-colors hover:bg-neutral-50">
      {/* Column 1: Title (16/regular #525252) */}
      <td className="h-18 px-4">
        <Typography variant="16/regular" className="truncate text-neutral-600">
          <Link href={`/dashboard/requests/${encodeURIComponent(item.id)}`} className="hover:text-brand-600">
            {item.title}
          </Link>
        </Typography>
      </td>

      {/* Column 2: Status Badge */}
      <td className="h-18 px-4">
        <RequestStatusBadge status={item.status} label={item.statusLabel} />
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

      {/* Column 5: Actions (32x32 button → Dropdown Frame 81) */}
      <td className="h-18 px-2 text-center">
        <RequestRowActions
          requestId={item.id}
          onView={onView}
          onEdit={onEdit}
          onCancel={onCancel}
        />
      </td>
    </tr>
  )
}
