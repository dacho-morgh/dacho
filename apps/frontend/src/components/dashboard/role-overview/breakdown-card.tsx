import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'
import { CARD_BODY, fa } from './shared'

export interface BreakdownRow {
  key: string
  label: string
  variant: BadgeProps['variant']
  /** Bar colour, a theme token class. */
  bar: string
}

/**
 * A role's chart: how many items sit in each state now, as bars against the total. The bars
 * carry their own text for screen readers; a failed read shows the notice, never empty bars.
 */
export function BreakdownCard({
  title,
  subtitle,
  rows,
  values,
  notice,
  emptyText,
  className,
}: {
  title: string
  subtitle: string
  rows: BreakdownRow[]
  values?: Record<string, number>
  notice?: UnavailableReason
  emptyText: string
  /** A fixed height from the board; the rows then scroll inside the card. */
  className?: string
}) {
  const total = values ? rows.reduce((sum, row) => sum + (values[row.key] ?? 0), 0) : 0
  return (
    <Card
      className={cn(
        'flex flex-col rounded-[10px] border-neutral-200 bg-background px-6 py-5 shadow-none',
        className,
      )}
    >
      <Typography as="h2" variant="title" color="neutral-800">
        {title}
      </Typography>
      <Typography as="p" variant="12/regular" color="neutral-500" className="mb-4">
        {subtitle}
      </Typography>
      <div className={CARD_BODY}>
        {notice || !values ? (
          <OfflineNotice reason={notice ?? 'unavailable'} retryHref="/dashboard" />
        ) : total === 0 ? (
          <Typography as="p" variant="14/regular" color="neutral-500">
            {emptyText}
          </Typography>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((row) => {
              const value = values[row.key] ?? 0
              const percent = Math.round((value / total) * 100)
              return (
                <li
                  key={row.key}
                  className="grid grid-cols-[minmax(96px,136px)_minmax(0,1fr)_40px] items-center gap-3"
                >
                  <Badge variant={row.variant} size="sm" dot>
                    {row.label}
                  </Badge>
                  <Progress
                    value={percent}
                    indicatorClassName={row.bar}
                    aria-label={`${row.label}: ${fa(value)} از ${fa(total)}`}
                  />
                  <Typography variant="14/semibold" color="neutral-800" className="text-end">
                    {fa(value)}
                  </Typography>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}
