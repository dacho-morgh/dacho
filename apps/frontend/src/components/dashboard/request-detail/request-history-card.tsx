import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Typography } from '@/components/ui/typography'
import type { ActivityDto } from '@/utilities/dashboard-api'
import { cn } from '@/utilities/ui'

/**
 * «تاریخچه درخواست» (Figma 31885:6726 and its sibling frames): the case's recorded
 * events, newest first as the server returns them, with the status tag opposite the
 * title; under each one the person who made the change and its date (Figma 31929:54577).
 */
export function RequestHistoryCard({
  timeline,
  statusLabel,
  statusVariant = 'primary',
  className,
}: {
  timeline: readonly (ActivityDto & { actorName?: string | null })[]
  statusLabel?: string
  statusVariant?: 'gray' | 'primary' | 'success' | 'warning' | 'error'
  className?: string
}) {
  return (
    <section
      aria-label="تاریخچه درخواست"
      data-testid="request-history"
      className={cn('flex min-w-0 flex-col gap-4 rounded-2xl border border-neutral-200 bg-background p-4', className)}
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <Typography as="h2" variant="20/extrabold" color="neutral-800">
          تاریخچه درخواست
        </Typography>
        {statusLabel ? (
          <Badge variant={statusVariant} size="lg">
            <Typography as="span" variant="16/regular" className="text-inherit">
              {statusLabel}
            </Typography>
          </Badge>
        ) : null}
      </div>
      {timeline.length ? (
        <ol className="flex flex-col divide-y divide-neutral-200">
          {timeline.map((event) => (
            <li key={event.id} className="flex min-w-0 flex-col gap-1 py-4 first:pt-0 last:pb-0">
              <Typography variant="16/semibold" color="neutral-600" className="break-words">
                {event.title}
              </Typography>
              <div className="flex items-start gap-2">
                {event.actorName ? (
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600"
                  >
                    <Typography as="span" variant="12/semibold" className="text-inherit">
                      {event.actorName.trim().charAt(0)}
                    </Typography>
                  </span>
                ) : null}
                <div className="flex min-w-0 flex-col">
                  {event.actorName ? (
                    <Typography as="span" variant="12/regular" color="neutral-500">
                      توسط {event.actorName}
                    </Typography>
                  ) : null}
                  <Typography as="span" variant="12/regular" color="neutral-400">
                    {formatPersianDate(event.at)}
                  </Typography>
                </div>
              </div>
              {event.description ? (
                <Typography variant="14/regular" color="neutral-500" className="whitespace-pre-wrap break-words">
                  {event.description}
                </Typography>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <Typography variant="14/regular" color="neutral-500">
          هنوز رویدادی ثبت نشده است.
        </Typography>
      )}
    </section>
  )
}

/** «۱۲ آبان ۱۴۰۴»: the Persian date with the month spelled out, as the design writes it. */
function formatPersianDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/** Two cards side by side on wide screens, as the history and the people list sit in the design. */
export function RequestCardRow({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:[&>*:only-child]:col-span-2">{children}</div>
}
