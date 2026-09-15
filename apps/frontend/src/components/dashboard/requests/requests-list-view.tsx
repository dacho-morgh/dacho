import React from 'react'
import { Typography } from '@/components/ui/typography'
import { RequestsToolbar } from './requests-toolbar'
import { RequestsListTable } from './requests-list-table'
import type { RequestItem } from './types'

export interface RequestsListViewProps {
  state?: 'default' | 'loading' | 'empty'
  items?: RequestItem[]
  onFilterClick?: () => void
  searchValue?: string
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onViewRequest?: (id?: string) => void
  onEditRequest?: (id?: string) => void
  onCancelRequest?: (id?: string) => void
}

export function RequestsListView({
  state = 'default',
  items,
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
    <div className="flex w-full flex-1 flex-col text-right" dir="rtl">
      <Typography as="h1" variant="24/bold" className="text-neutral-700">
        لیست درخواست ها
      </Typography>

      <RequestsToolbar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onFilterClick={onFilterClick}
      />

      <RequestsListTable
        data={data}
        isLoading={isLoading}
        isEmpty={isEmpty}
        onView={onViewRequest}
        onEdit={onEditRequest}
        onCancel={onCancelRequest}
      />
    </div>
  )
}
