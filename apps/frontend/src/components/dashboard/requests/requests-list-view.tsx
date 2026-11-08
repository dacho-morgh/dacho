import React from 'react'
import { ListToolbar } from '@/components/dashboard/list-toolbar'
import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
import { Typography } from '@/components/ui/typography'
import { RequestsListTable } from './requests-list-table'
import type { RequestItem } from './types'

export interface RequestsListViewProps {
  state?: 'default' | 'loading' | 'empty'
  /** Set when the queue could not be read; never rendered as an empty list. */
  notice?: UnavailableReason
  items?: RequestItem[]
  basePath?: string
  retryHref?: string
  /** The search field and the shared filter button (RequestsFilters), shown on the right of the toolbar. */
  filterForm?: React.ReactNode
  /** A line under the title, such as the work queue the list is narrowed to. */
  queueNote?: React.ReactNode
}

export function RequestsListView({
  state = 'default',
  notice,
  items,
  basePath = '/dashboard/requests',
  retryHref = basePath,
  filterForm,
  queueNote,
}: RequestsListViewProps) {
  const data = items ?? []
  const isLoading = state === 'loading'
  const isEmpty = state === 'empty' || (state === 'default' && data.length === 0)

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col text-right" dir="rtl">
      <Typography as="h1" variant="24/bold" className="text-neutral-700">
        لیست درخواست ها
      </Typography>

      {queueNote}

      {filterForm && <ListToolbar search={filterForm} className="mt-5" />}

      {notice ? (
        <OfflineNotice reason={notice} retryHref={retryHref} className="mt-4" />
      ) : (
        <RequestsListTable data={data} isLoading={isLoading} isEmpty={isEmpty} />
      )}
    </div>
  )
}
