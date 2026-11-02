import type { ReactNode } from 'react'
import { TickCircleIcon } from '@/components/icons'
import { Card } from '@/components/ui/card'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'
import { fa } from './shared'

export interface StepperStep {
  title: string
  description: string
}

/** Steps before `current` are done, `current` is highlighted, the rest wait. */
export function StepperCard({
  title,
  subtitle,
  badge,
  steps,
  current,
}: {
  title: string
  subtitle: string
  badge?: ReactNode
  steps: StepperStep[]
  current: number
}) {
  return (
    <Card className="rounded-[10px] border-neutral-200 bg-white px-6 py-5 shadow-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography as="h2" variant="title" color="neutral-800">
            {title}
          </Typography>
          <Typography as="p" variant="12/regular" color="neutral-500">
            {subtitle}
          </Typography>
        </div>
        {badge}
      </div>
      <ol className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'next'
          return (
            <li
              key={step.title}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex items-start gap-3"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full border text-sm',
                  state === 'done' &&
                    'border-success-50 bg-success-50 text-success-700 [&_svg]:size-5',
                  state === 'current' && 'border-brand-600 bg-brand-50 text-brand-600',
                  state === 'next' && 'border-neutral-200 bg-white text-neutral-400',
                )}
              >
                {state === 'done' ? <TickCircleIcon /> : fa(index + 1)}
              </span>
              <span className="flex flex-col">
                <Typography
                  as="span"
                  variant="14/semibold"
                  color={state === 'next' ? 'neutral-500' : 'neutral-800'}
                >
                  {step.title}
                </Typography>
                <Typography as="span" variant="12/regular" color="neutral-500">
                  {step.description}
                </Typography>
              </span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
