import React from 'react'

import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import { SearchField } from '@/components/dashboard/search-field'
import { workQueueLabel } from '@/components/dashboard/work-queue-overview'
import { Typography } from '@/components/ui/typography'
import { REQUEST_STATUS_FILTER_OPTIONS, REVIEW_STAGE_OPTIONS, type RequestQueueFilters, type RequestStatus } from './types'

/**
 * Search is a plain GET form and the filter button writes the URL, so back
 * navigation, refresh and sharing keep both; the API narrows the list inside
 * the actor's own scope. It renders the two controls only: the list's ListToolbar
 * puts them on the right.
 */
export function RequestsFilters({
  basePath = '/dashboard/requests',
  status,
  filters,
  events,
  counts,
}: {
  basePath?: string
  status?: RequestStatus
  filters: RequestQueueFilters
  events: { id: string; title: string }[]
  /** From `GET /stats` with the same filters, so each number is the size of the list it opens. */
  counts?: Partial<Record<RequestStatus | 'all', number>>
}) {
  return (
    <>
      <form method="get" action={basePath} className="min-w-0 flex-1 sm:flex-none" role="search">
        {status && <input type="hidden" name="status" value={status} />}
        {filters.eventId && <input type="hidden" name="eventId" value={filters.eventId} />}
        {filters.stage && <input type="hidden" name="stage" value={filters.stage} />}
        {filters.queue && <input type="hidden" name="queue" value={filters.queue} />}
        <SearchField
          name="search"
          defaultValue={filters.search ?? ''}
          maxLength={100}
          placeholder="جستجوی عنوان یا کد پیگیری"
          aria-label="جستجوی عنوان یا کد پیگیری"
        />
      </form>
      <ListFilterButton
        label="فیلتر درخواست‌ها"
        groups={[
          {
            key: 'status',
            label: 'وضعیت درخواست',
            value: status,
            options: REQUEST_STATUS_FILTER_OPTIONS.map((option) => ({
              value: option.value === 'all' ? '' : option.value,
              label: option.label,
              count: counts?.[option.value],
            })),
          },
          {
            key: 'eventId',
            label: 'رویداد',
            value: filters.eventId,
            options: [{ value: '', label: 'همه رویدادها' }, ...events.map((event) => ({ value: event.id, label: event.title }))],
          },
          {
            key: 'stage',
            label: 'مرحله',
            value: filters.stage,
            options: [{ value: '', label: 'همه مرحله‌ها' }, ...REVIEW_STAGE_OPTIONS],
          },
        ]}
      />
    </>
  )
}

/** «صف: …» under the title when the list is narrowed to a work queue. */
export function RequestsQueueNote({ filters }: { filters: RequestQueueFilters }) {
  const queueLabel = filters.queue ? workQueueLabel(filters.queue) : undefined
  if (!queueLabel) return null
  return (
    <Typography variant="14/regular" color="secondary" className="mt-2">
      صف: {queueLabel}
    </Typography>
  )
}
