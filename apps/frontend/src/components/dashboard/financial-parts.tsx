import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Typography } from '@/components/ui/typography'

type BannerTone = 'info' | 'success' | 'warning' | 'error'

const BANNER_TONES: Record<BannerTone, { box: string; color: 'brand-600' | 'success' | 'warning' | 'error' }> = {
  info: { box: 'bg-brand-50', color: 'brand-600' },
  success: { box: 'bg-success-50', color: 'success' },
  warning: { box: 'bg-warning-50', color: 'warning' },
  error: { box: 'bg-error-50', color: 'error' },
}

/** The title-and-line banner the financial frames (Figma 13–25) open with. */
export function FinancialBanner({
  tone,
  title,
  children,
  testId,
  role,
}: {
  tone: BannerTone
  title: string
  children?: ReactNode
  testId?: string
  role?: 'status' | 'alert'
}) {
  const { box, color } = BANNER_TONES[tone]
  return (
    <div data-testid={testId} role={role} className={`flex min-w-0 flex-col gap-2 rounded-xl p-4 sm:px-5 ${box}`}>
      <Typography variant="14/semibold" color={color}>{title}</Typography>
      {children ? (
        <Typography as="div" variant="12/regular" color={color} className="break-words">{children}</Typography>
      ) : null}
    </div>
  )
}

/** A white card with a heading, as every financial frame lays out its content. */
export function FinancialCard({
  title,
  children,
  testId,
  headingId,
}: {
  title: string
  children: ReactNode
  testId?: string
  headingId?: string
}) {
  return (
    <section
      data-testid={testId}
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-5 rounded-2xl border border-neutral-200 bg-background p-4 sm:p-6"
    >
      <Typography as="h2" id={headingId} variant="20/bold" color="neutral-900">{title}</Typography>
      {children}
    </section>
  )
}

/** Label over value pairs, two columns from the small breakpoint up. */
export function FinancialFacts({ items }: { items: { label: string; value: ReactNode; testId?: string }[] }) {
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-1">
          <dt>
            <Typography as="span" variant="12/regular" color="neutral-500">{item.label}</Typography>
          </dt>
          <dd data-testid={item.testId}>
            <Typography as="span" variant="14/semibold" color="neutral-900" className="block break-words">{item.value}</Typography>
          </dd>
        </div>
      ))}
    </dl>
  )
}

export type StepState = 'done' | 'current' | 'pending'

const STEP_BADGES: Record<StepState, { label: string; variant: 'success' | 'primary' | 'gray' }> = {
  done: { label: 'انجام شده', variant: 'success' },
  current: { label: 'در حال بررسی', variant: 'primary' },
  pending: { label: 'در انتظار', variant: 'gray' },
}

/** The case's steps with a state badge each; the state always comes from what the server returned. */
export function FinancialSteps({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="flex flex-col gap-3" aria-label="مراحل پرونده">
      {steps.map((step) => {
        const badge = STEP_BADGES[step.state]
        return (
          <li
            key={step.label}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className="flex min-w-0 items-center justify-between gap-3"
          >
            <Typography variant="14/regular" color="neutral-800" className="min-w-0">{step.label}</Typography>
            <Badge variant={badge.variant} size="md" className="shrink-0">{badge.label}</Badge>
          </li>
        )
      })}
    </ol>
  )
}

export const faNumber = (value: number) => value.toLocaleString('fa-IR')
export const faYear = (year: number) => year.toLocaleString('fa-IR', { useGrouping: false })
