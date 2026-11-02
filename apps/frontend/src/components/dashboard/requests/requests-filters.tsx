import Link from 'next/link'
import { SearchField } from '@/components/dashboard/search-field'
import React from 'react'

import { workQueueLabel } from '@/components/dashboard/work-queue-overview'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { REVIEW_STAGE_OPTIONS, requestQueueHref, type RequestQueueFilters, type RequestStatus } from './types'
import { NativeSelect } from '@/components/ui/native-select'

/**
 * Plain GET form: the filters live in the URL, so back navigation, refresh and
 * sharing keep them, and the API narrows the list inside the actor's own scope.
 */
export function RequestsFilters({
  basePath = '/dashboard/requests',
  status,
  filters,
  events,
}: {
  basePath?: string
  status?: RequestStatus
  filters: RequestQueueFilters
  events: { id: string; title: string }[]
}) {
  const queueLabel = filters.queue ? workQueueLabel(filters.queue) : undefined
  const active = Boolean(filters.search || filters.eventId || filters.stage || filters.queue)
  return (
    <form method="get" action={basePath} className="flex flex-wrap items-center gap-2" dir="rtl" role="search">
      {status && <input type="hidden" name="status" value={status} />}
      {filters.queue && <input type="hidden" name="queue" value={filters.queue} />}
      <SearchField
        className="sm:w-72"
        name="search"
        defaultValue={filters.search ?? ''}
        maxLength={100}
        placeholder="جستجوی عنوان یا کد پیگیری"
        aria-label="جستجوی عنوان یا کد پیگیری"
      />
      <NativeSelect name="eventId" defaultValue={filters.eventId ?? ''} aria-label="رویداد">
        <option value="">همه رویدادها</option>
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.title}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect name="stage" defaultValue={filters.stage ?? ''} aria-label="مرحله">
        <option value="">همه مرحله‌ها</option>
        {REVIEW_STAGE_OPTIONS.map((stage) => (
          <option key={stage.value} value={stage.value}>
            {stage.label}
          </option>
        ))}
      </NativeSelect>
      <Button size="40" type="submit" variant="outline-gray">
        <Typography>اعمال فیلتر</Typography>
      </Button>
      {active && (
        <Button size="40" asChild variant="text-gray">
          <Link href={requestQueueHref(basePath, status)}>
            <Typography>حذف فیلترها</Typography>
          </Link>
        </Button>
      )}
      {queueLabel && (
        <Typography variant="14/regular" color="secondary" className="w-full">
          صف: {queueLabel}
        </Typography>
      )}
    </form>
  )
}
