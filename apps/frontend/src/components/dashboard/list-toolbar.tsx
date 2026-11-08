import React from 'react'

import { cn } from '@/utilities/ui'

/**
 * The one toolbar of every dashboard list (design QA #276, Figma 30852:17808 and 56:13205):
 * search and the filter button sit together on the right (the RTL start), the page's own
 * actions (create, bulk actions, box tabs) on the left. The filter button is the one
 * ListFilterButton template; callers pass the search field and the button, never their own.
 * On a phone the groups stack, search and filter first.
 */
export function ListToolbar({
  search,
  filter,
  actions,
  className,
}: {
  search?: React.ReactNode
  filter?: React.ReactNode
  /** Page-level actions, at the end (left) of the bar. */
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      dir="rtl"
      data-slot="list-toolbar"
      className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between', className)}
    >
      {(search || filter) && (
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          {search}
          {filter}
        </div>
      )}
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  )
}
