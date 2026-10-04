import React from 'react'
import { RequestsTableHeader } from './requests-table-header'
import { RequestsListRow } from './requests-list-row'
import { RequestsLoadingSkeleton } from './requests-loading-skeleton'
import { RequestsEmptyState } from './requests-empty-state'
import type { RequestItem } from './types'

export interface RequestsListTableProps {
  data: RequestItem[]
  isLoading?: boolean
  isEmpty?: boolean
  onView?: (id?: string) => void
  onEdit?: (id?: string) => void
  onCancel?: (id?: string) => void
  className?: string
}

export function RequestsListTable({
  data,
  isLoading = false,
  isEmpty = false,
  onView,
  onEdit,
  onCancel,
  className = '',
}: RequestsListTableProps) {
  const showEmpty = !isLoading && (isEmpty || data.length === 0)

  return (
    <div
      className={`mt-4 flex min-h-100 w-full flex-1 flex-col rounded-2xl border border-neutral-200 bg-white p-4 ${className}`}
    >
      <div className="relative flex min-w-0 w-full flex-1 flex-col overflow-x-auto">
        {/* Loading Skeleton State (Figma Screen 13) - no table headers */}
        {isLoading && <RequestsLoadingSkeleton />}

        {/* Default + Empty states show table */}
        {!isLoading && (
          <table className="w-full min-w-175 table-fixed border-collapse text-right">
            <colgroup>
              <col />
              <col className="w-50" />
              <col className="w-40" />
              <col className="w-40" />
              <col className="w-13" />
            </colgroup>
            <RequestsTableHeader />

            {/* Table Body (default data state) */}
            {data.length > 0 && (
              <tbody>
                {data.map((item) => (
                  <RequestsListRow
                    key={item.id}
                    item={item}
                    onView={onView}
                    onEdit={onEdit}
                    onCancel={onCancel}
                  />
                ))}
              </tbody>
            )}
          </table>
        )}

        {/* Empty State (Figma node 50:9422) */}
        {showEmpty && <RequestsEmptyState />}
      </div>
    </div>
  )
}
