import React from 'react'

import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import { SearchField } from '@/components/dashboard/search-field'
import { workQueueLabel } from '@/components/dashboard/work-queue-overview'
import { Typography } from '@/components/ui/typography'
import { COMPANY_REQUEST_STAGE_FILTER_OPTIONS, type CompanyRequestStage } from '@/utilities/company-request-stage'
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
  audience = 'staff',
  stageCounts,
}: {
  basePath?: string
  status?: RequestStatus
  filters: RequestQueueFilters
  events: { id: string; title: string }[]
  /** From `GET /stats` with the same filters, so each number is the size of the list it opens. */
  counts?: Partial<Record<RequestStatus | 'all', number>>
  /**
   * `company` filters by the three company stages only (design QA #280); `staff` keeps the real
   * status and review-stage filters.
   */
  audience?: 'company' | 'staff'
  /** Company only: the size of each stage's list. */
  stageCounts?: Partial<Record<CompanyRequestStage | 'all', number>>
}) {
  const eventGroup = {
    key: 'eventId',
    label: 'رویداد',
    value: filters.eventId,
    options: [{ value: '', label: 'همه رویدادها' }, ...events.map((event) => ({ value: event.id, label: event.title }))],
  }
  const groups =
    audience === 'company'
      ? [
          {
            key: 'phase',
            label: 'مرحله درخواست',
            value: filters.phase,
            options: COMPANY_REQUEST_STAGE_FILTER_OPTIONS.map((option) => ({
              value: option.value === 'all' ? '' : option.value,
              label: option.label,
              count: stageCounts?.[option.value],
            })),
          },
          eventGroup,
        ]
      : [
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
          eventGroup,
          {
            key: 'stage',
            label: 'مرحله',
            value: filters.stage,
            options: [{ value: '', label: 'همه مرحله‌ها' }, ...REVIEW_STAGE_OPTIONS],
          },
        ]
  return (
    <>
      <form method="get" action={basePath} className="w-full min-w-0 sm:w-auto" role="search">
        {status && <input type="hidden" name="status" value={status} />}
        {filters.phase && <input type="hidden" name="phase" value={filters.phase} />}
        {filters.eventId && <input type="hidden" name="eventId" value={filters.eventId} />}
        {filters.stage && <input type="hidden" name="stage" value={filters.stage} />}
        {filters.queue && <input type="hidden" name="queue" value={filters.queue} />}
        <SearchField
          name="search"
          defaultValue={filters.search ?? ''}
          maxLength={100}
          placeholder="درخواست خود را جست و جو کنید"
          aria-label="جستجوی عنوان یا کد پیگیری"
        />
      </form>
      <ListFilterButton label="فیلتر درخواست‌ها" groups={groups} />
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
