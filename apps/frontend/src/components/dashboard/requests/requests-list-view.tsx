import React from 'react'
import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
import { Typography } from '@/components/ui/typography'
import { RequestsListTable } from './requests-list-table'
import { RequestsToolbar } from './requests-toolbar'
import type { RequestItem } from './types'

export interface RequestsListViewProps {
  state?: 'default' | 'loading' | 'empty'
  /** Set when the queue could not be read; never rendered as an empty list. */
  notice?: UnavailableReason
  items?: RequestItem[]
  basePath?: string
  retryHref?: string
  /** Search and the shared filter button (status, event and stage with counts). */
  filterForm?: React.ReactNode
  onFilterClick?: () => void
  searchValue?: string
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onViewRequest?: (id?: string) => void
  onEditRequest?: (id?: string) => void
  onCancelRequest?: (id?: string) => void
}

export function RequestsListView({
  state = 'default',
  notice,
  items,
  basePath = '/dashboard/requests',
  retryHref = basePath,
  filterForm,
  onFilterClick,
  searchValue,
  onSearchChange,
  onViewRequest,
  onEditRequest,
  onCancelRequest,
}: RequestsListViewProps) {
  const data = items ?? []
  const isLoading = state === 'loading'
  const isEmpty = state === 'empty' || (state === 'default' && data.length === 0)

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col text-right" dir="rtl">
      <Typography as="h1" variant="24/bold" className="text-neutral-700">
        لیست درخواست ها
      </Typography>

      {filterForm && <div className="mt-5">{filterForm}</div>}

      {(onSearchChange || onFilterClick) && (
        <RequestsToolbar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          onFilterClick={onFilterClick}
        />
      )}

      {notice ? (
        <OfflineNotice reason={notice} retryHref={retryHref} className="mt-4" />
      ) : (
        <RequestsListTable
          data={data}
          isLoading={isLoading}
          isEmpty={isEmpty}
          onView={onViewRequest}
          onEdit={onEditRequest}
          onCancel={onCancelRequest}
        />
      )}
    </div>
  )
}
