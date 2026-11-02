import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Typography } from '@/components/ui/typography'
import { REQUEST_STATUS_LABELS, type RequestStats } from '@/utilities/dashboard-api'

const ROWS: {
  key: keyof Omit<RequestStats, 'total'> | 'draft'
  variant: BadgeProps['variant']
  bar: string
}[] = [
  { key: 'in_review', variant: 'primary', bar: 'bg-brand-600' },
  { key: 'approved', variant: 'green', bar: 'bg-success-500' },
  { key: 'action_needed', variant: 'yellow', bar: 'bg-warning-400' },
  { key: 'rejected', variant: 'red', bar: 'bg-error-500' },
  { key: 'draft', variant: 'gray', bar: 'bg-neutral-400' },
]

const fa = (value: number) => value.toLocaleString('fa-IR')

export function StatusBreakdown({ counts }: { counts: RequestStats }) {
  // The stats row counts four statuses; whatever is left of the total has not been sent yet.
  const sent = counts.in_review + counts.approved + counts.action_needed + counts.rejected
  const values: Record<(typeof ROWS)[number]['key'], number> = {
    in_review: counts.in_review,
    approved: counts.approved,
    action_needed: counts.action_needed,
    rejected: counts.rejected,
    draft: Math.max(0, counts.total - sent),
  }

  return (
    <Card className="rounded-[10px] border-neutral-200 bg-white px-6 py-5 shadow-none">
      <Typography as="h2" variant="title" color="neutral-800">
        وضعیت درخواست‌ها
      </Typography>
      <Typography as="p" variant="12/regular" color="neutral-500" className="mb-4">
        {fa(counts.total)} درخواست در همه رویدادها
      </Typography>
      <ul className="flex flex-col gap-4">
        {ROWS.map((row) => {
          const value = values[row.key]
          const percent = counts.total > 0 ? Math.round((value / counts.total) * 100) : 0
          return (
            <li
              key={row.key}
              className="grid grid-cols-[minmax(96px,128px)_minmax(0,1fr)_40px] items-center gap-3"
            >
              <Badge variant={row.variant} size="sm" dot>
                {REQUEST_STATUS_LABELS[row.key]}
              </Badge>
              <Progress
                value={percent}
                indicatorClassName={row.bar}
                aria-label={`${REQUEST_STATUS_LABELS[row.key]}: ${fa(value)} از ${fa(counts.total)}`}
              />
              <Typography variant="14/semibold" color="neutral-800" className="text-end">
                {fa(value)}
              </Typography>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
