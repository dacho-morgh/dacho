import Link from 'next/link'
import React from 'react'

import { workQueueLabel } from '@/components/dashboard/work-queue-overview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import { REVIEW_STAGE_OPTIONS, requestQueueHref, type RequestQueueFilters, type RequestStatus } from './types'

const selectClass = 'h-10 rounded-lg border border-neutral-100 bg-background px-2 text-sm text-neutral-700'

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
      <div className="w-full sm:w-72">
        <Input
          type="search"
          name="search"
          defaultValue={filters.search ?? ''}
          maxLength={100}
          placeholder="جستجوی عنوان یا کد پیگیری"
          aria-label="جستجوی عنوان یا کد پیگیری"
        />
      </div>
      <select name="eventId" defaultValue={filters.eventId ?? ''} aria-label="رویداد" className={selectClass}>
        <option value="">همه رویدادها</option>
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.title}
          </option>
        ))}
      </select>
      <select name="stage" defaultValue={filters.stage ?? ''} aria-label="مرحله" className={selectClass}>
        <option value="">همه مرحله‌ها</option>
        {REVIEW_STAGE_OPTIONS.map((stage) => (
          <option key={stage.value} value={stage.value}>
            {stage.label}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline-gray">
        <Typography>اعمال فیلتر</Typography>
      </Button>
      {active && (
        <Button asChild variant="text-gray">
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
