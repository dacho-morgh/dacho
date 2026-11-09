import type { ReactNode } from 'react'

import { OPERATIONAL_ROLE_LABELS, type OperationalRole } from '@cms-core/access/roles'

import { Badge } from '@/components/ui/badge'
import { Typography } from '@/components/ui/typography'
import { formatDate, type ActivityDto } from '@/utilities/dashboard-api'
import { cn } from '@/utilities/ui'

/**
 * «تاریخچه درخواست» (Figma 31885:6726 and its sibling frames): the case's recorded
 * events, newest first as the server returns them, with the status tag opposite the
 * title. Under each title: «توسط …» with the actor the server named (#288), the date and the
 * description. Reviewers and employers get no actor at all, and the company gets a name only
 * for its own steps, so a row with a role and no name is drawn with `staffLabel` for the
 * company and with the role's own label for staff.
 */
export type HistoryEvent = ActivityDto & { actorName?: string | null; actorRole?: string | null }

/** Who took a step, as the line «توسط …»; null when the server told this reader nothing. */
function actorLine(event: HistoryEvent, staffLabel: string | null): string | null {
  const name = event.actorName?.trim()
  if (name) return name
  if (!event.actorRole) return null
  if (staffLabel) return staffLabel
  return OPERATIONAL_ROLE_LABELS[event.actorRole as OperationalRole] ?? null
}

export function RequestHistoryCard({
  timeline,
  statusLabel,
  statusVariant = 'primary',
  staffLabel = null,
  className,
}: {
  timeline: readonly HistoryEvent[]
  /** Replaces the role label of a step whose actor is unnamed, for readers who must not learn who it was. */
  staffLabel?: string | null
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
        <Typography as="h2" variant="16/bold" sm="20/bold" color="neutral-800">
          تاریخچه درخواست
        </Typography>
        {statusLabel ? (
          <Badge variant={statusVariant} size="md">
            <Typography as="span" variant="14/regular" className="text-inherit">
              {statusLabel}
            </Typography>
          </Badge>
        ) : null}
      </div>
      {timeline.length ? (
        <ol className="flex flex-col divide-y divide-neutral-100">
          {timeline.map((event) => {
            const actor = actorLine(event, staffLabel)
            return (
            <li key={event.id} className="flex min-w-0 flex-col gap-1 py-3 first:pt-0">
              <Typography variant="14/semibold" sm="16/semibold" color="neutral-800" className="break-words">
                {event.title}
              </Typography>
              {actor ? (
                <Typography variant="12/regular" sm="14/regular" color="neutral-600" className="break-words" data-testid="history-actor">
                  توسط {actor}
                </Typography>
              ) : null}
              <Typography variant="12/regular" color="neutral-400" className="font-mono">
                {formatDate(event.at)}
              </Typography>
              {event.description ? (
                <Typography variant="12/regular" sm="14/regular" color="neutral-600" className="whitespace-pre-wrap break-words">
                  {event.description}
                </Typography>
              ) : null}
            </li>
            )
          })}
        </ol>
      ) : (
        <Typography variant="14/regular" color="neutral-500">
          هنوز رویدادی ثبت نشده است.
        </Typography>
      )}
    </section>
  )
}

/** Two cards side by side on wide screens, as the history and the people list sit in the design. */
export function RequestCardRow({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:[&>*:only-child]:col-span-2">{children}</div>
}
