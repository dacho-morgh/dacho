import React from 'react'
import { ListTableFrame } from '@/components/dashboard/list-table'
import { RequestsTableHeader } from './requests-table-header'
import { RequestsListCard } from './requests-list-card'
import { RequestsListRow } from './requests-list-row'
import { RequestsLoadingSkeleton } from './requests-loading-skeleton'
import { RequestsEmptyState } from './requests-empty-state'
import type { RequestItem } from './types'

export interface RequestsListTableProps {
  data: RequestItem[]
  isLoading?: boolean
  isEmpty?: boolean
  className?: string
}

/** The company's request table in the shared frame: it fills the page height and its rows open the dossier. */
export function RequestsListTable({
  data,
  isLoading = false,
  isEmpty = false,
  className = '',
}: RequestsListTableProps) {
  const showEmpty = !isLoading && (isEmpty || data.length === 0)

  return (
    <ListTableFrame className={`mt-4 p-4 ${className}`}>
      {/* Loading Skeleton State (Figma Screen 13) - no table headers */}
      {isLoading && <RequestsLoadingSkeleton />}

      {/* Default + Empty states show table */}
      {!isLoading && (
        <table className="hidden w-full min-w-175 table-fixed border-collapse text-right md:table">
          <colgroup>
            <col />
            <col className="w-50" />
            <col className="w-40" />
            <col className="w-40" />
            <col className="w-32" />
          </colgroup>
          <RequestsTableHeader />

          {/* Table Body (default data state) */}
          {data.length > 0 && (
            <tbody>
              {data.map((item) => (
                <RequestsListRow key={item.id} item={item} />
              ))}
            </tbody>
          )}
        </table>
      )}

      {/* Phone layout: below md each request is a card, never a table in a scroller. */}
      {!isLoading && data.length > 0 && (
        <ul className="flex flex-col gap-3 md:hidden" aria-label="درخواست‌ها">
          {data.map((item) => (
            <li key={item.id}>
              <RequestsListCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {/* Empty State (Figma node 50:9422) */}
      {showEmpty && <RequestsEmptyState />}
    </ListTableFrame>
  )
}
