import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'
import { TONE_CHIP, type OverviewTone } from './tone'

export interface KpiCardProps {
  label: string
  value: string
  /** Quiet unit after the value, e.g. "از ۱۰۳". */
  unit?: string
  meta: ReactNode
  icon: ReactNode
  tone?: OverviewTone
  /** Decoration beside the value, e.g. a sparkline. */
  accessory?: ReactNode
}

export function KpiCard({
  label,
  value,
  unit,
  meta,
  icon,
  tone = 'brand',
  accessory,
}: KpiCardProps) {
  return (
    <Card className="flex flex-col gap-2 rounded-[10px] border-neutral-200 bg-background px-6 py-5 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <Typography variant="14/light" color="neutral-500">
          {label}
        </Typography>
        <span
          aria-hidden="true"
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-[10px] [&_svg]:size-[22px]',
            TONE_CHIP[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <Typography as="p" variant="32/bold" color="neutral-800">
          {value}
          {unit ? (
            <Typography as="span" variant="14/light" color="neutral-500" className="ms-1">
              {unit}
            </Typography>
          ) : null}
        </Typography>
        {accessory}
      </div>
      <Typography as="p" variant="12/regular" color="neutral-500">
        {meta}
      </Typography>
    </Card>
  )
}

/** Oldest value sits on the right, matching the right-to-left reading order. */
export function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return null
  const width = 96
  const height = 32
  const max = Math.max(...values, 1)
  const step = width / (values.length - 1)
  const points = values.map((value, index) => ({
    x: width - index * step,
    y: height - 6 - (value / max) * (height - 12),
  }))
  const last = points[points.length - 1]
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-brand-600"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={3}
        strokeWidth={2}
        className="fill-brand-600 stroke-white"
      />
    </svg>
  )
}
