'use client'

import React from 'react'
import { RowActions, type RowAction } from '@/components/dashboard/list-row-actions'
import { EyeIcon } from '@/components/icons'

export interface RequestRowActionsProps {
  requestId: string
  /** Where «مشاهده» goes when the row is not a request dossier. */
  href?: string
  /** Further actions after «مشاهده»; with any, the row gets the «more» menu. */
  extraActions?: RowAction[]
  className?: string
}

/**
 * A request row's actions (Figma Frame 81, node 53:10769). The shared RowActions shows a single
 * action directly and puts two or more in the «more» menu.
 */
export function RequestRowActions({ requestId, href, extraActions = [], className }: RequestRowActionsProps) {
  return (
    <RowActions
      className={className}
      menuLabel="عملیات بیشتر"
      actions={[
        {
          id: 'view',
          label: 'مشاهده',
          href: href ?? `/dashboard/requests/${encodeURIComponent(requestId)}`,
          icon: <EyeIcon aria-hidden="true" className="size-5" />,
        },
        ...extraActions,
      ]}
    />
  )
}
