import Link from 'next/link'
import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
import { workQueueHref, workQueueLabel } from '@/components/dashboard/work-queue-overview'
import { ArrowLeftIcon } from '@/components/icons'
import { Card } from '@/components/ui/card'
import { Typography } from '@/components/ui/typography'
import type { WorkQueueCountDto } from '@/utilities/dashboard-api'
import { cn } from '@/utilities/ui'
import { CARD_BODY, fa } from './shared'

/**
 * The role's next tasks: each queue with work in it, linked to the list behind it. Queues are
 * listed in the order the server sends them, so the role's own first step comes first.
 */
export function NextTasksCard({
  queues,
  notice,
  failed = [],
  className,
}: {
  queues?: WorkQueueCountDto[]
  notice?: UnavailableReason
  /** Sections the server could not read; their work is unknown, so the card says so. */
  failed?: string[]
  /** A fixed height from the board; the tasks then scroll inside the card. */
  className?: string
}) {
  const pending = (queues ?? []).filter((queue) => queue.count > 0 && workQueueLabel(queue.key))
  return (
    <Card
      className={cn(
        'flex flex-col rounded-[10px] border-neutral-200 bg-background px-6 py-5 shadow-none',
        className,
      )}
    >
      <Typography as="h2" variant="title" color="neutral-800" className="mb-4">
        کارهای بعدی
      </Typography>
      <div className={CARD_BODY}>
        {notice || !queues ? (
          <OfflineNotice reason={notice ?? 'unavailable'} retryHref="/dashboard" />
        ) : (
          <>
            {pending.length ? (
              <ul className="flex flex-col divide-y divide-neutral-100">
                {pending.map((queue) => {
                  const href = workQueueHref(queue.key)
                  const body = (
                    <>
                      <Typography
                        as="span"
                        variant="14/regular"
                        color="neutral-700"
                        className="min-w-0 flex-1"
                      >
                        {workQueueLabel(queue.key)}
                      </Typography>
                      <Typography as="span" variant="16/semibold" color="neutral-800">
                        {fa(queue.count)}
                      </Typography>
                      {href ? (
                        <ArrowLeftIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-neutral-400"
                        />
                      ) : null}
                    </>
                  )
                  const row = 'flex items-center gap-3 py-3'
                  return (
                    <li key={queue.key}>
                      {href ? (
                        <Link
                          href={href}
                          className={`${row} rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-600 [@media(hover:hover)]:hover:text-brand-700`}
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className={row}>{body}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Typography as="p" variant="14/regular" color="neutral-500">
                در حال حاضر کاری در انتظار اقدام شما نیست.
              </Typography>
            )}
            {failed.length ? (
              <OfflineNotice reason="unavailable" retryHref="/dashboard" className="mt-4" />
            ) : null}
          </>
        )}
      </div>
    </Card>
  )
}
