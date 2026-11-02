import Link from 'next/link'
import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
import { requestQueueHref } from '@/components/dashboard/requests/types'
import { workQueueLabel } from '@/components/dashboard/work-queue-overview'
import { EventsIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import type { WorkQueueCountDto } from '@/utilities/dashboard-api'

/** Work the owner can act on today, as one banner per queue (the owner has "reopen rejected"). */
export function QueueNotices({
  queues,
  notice,
}: {
  queues?: WorkQueueCountDto[]
  notice?: UnavailableReason
}) {
  if (notice) return <OfflineNotice reason={notice} retryHref="/dashboard" />
  const pending = (queues ?? []).filter((queue) => queue.count > 0 && workQueueLabel(queue.key))
  if (!pending.length) return null
  return (
    <section aria-label="کارهای نیازمند اقدام" className="flex flex-col gap-3">
      {pending.map((queue) => (
        <div
          key={queue.key}
          className="flex flex-wrap items-center gap-3 rounded-[10px] border border-brand-100 bg-brand-50 px-4 py-3"
        >
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-brand-600 [&_svg]:size-5"
          >
            <EventsIcon />
          </span>
          <Typography
            as="p"
            variant="14/regular"
            color="neutral-700"
            className="min-w-0 flex-1 basis-72"
          >
            <Typography as="strong" variant="14/semibold" color="neutral-800">
              {queue.count.toLocaleString('fa-IR')}
            </Typography>{' '}
            {workQueueLabel(queue.key)}
          </Typography>
          <Button size="32" variant="outline" asChild>
            <Link
              href={requestQueueHref('/dashboard/requests', undefined, 1, { queue: queue.key })}
            >
              بررسی صف
            </Link>
          </Button>
        </div>
      ))}
    </section>
  )
}
