import { OfflineNotice } from '@/components/dashboard/offline-notice'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Typography } from '@/components/ui/typography'
import { fa } from './shared'

export interface FunnelStep {
  label: string
  value: number
}

/** Cumulative stage counts, each bar sized against the first step. Without steps the read failed. */
export function FunnelCard({
  title,
  subtitle,
  steps,
}: {
  title: string
  subtitle: string
  steps?: FunnelStep[]
}) {
  if (!steps) {
    return (
      <Card className="rounded-[10px] border-neutral-200 bg-background px-6 py-5 shadow-none">
        <Typography as="h2" variant="title" color="neutral-800">
          {title}
        </Typography>
        <Typography as="p" variant="12/regular" color="neutral-500" className="mb-4">
          {subtitle}
        </Typography>
        <OfflineNotice reason="unavailable" retryHref="/dashboard" />
      </Card>
    )
  }
  const base = Math.max(steps[0]?.value ?? 0, 1)
  return (
    <Card className="rounded-[10px] border-neutral-200 bg-background px-6 py-5 shadow-none">
      <Typography as="h2" variant="title" color="neutral-800">
        {title}
      </Typography>
      <Typography as="p" variant="12/regular" color="neutral-500" className="mb-4">
        {subtitle}
      </Typography>
      <ul className="flex flex-col gap-4">
        {steps.map((step, index) => {
          const percent = Math.round((step.value / base) * 100)
          return (
            <li
              key={step.label}
              className="grid grid-cols-[minmax(110px,180px)_minmax(0,1fr)_72px] items-center gap-3"
            >
              <Typography variant="14/regular" color="neutral-700">
                {step.label}
              </Typography>
              <Progress
                value={percent}
                className="h-5 rounded-[4px]"
                indicatorClassName="rounded-[4px]"
                aria-label={`${step.label}: ${fa(step.value)} از ${fa(steps[0]?.value ?? 0)}`}
              />
              <Typography variant="14/semibold" color="neutral-800" className="text-end">
                {fa(step.value)}
                {index > 0 ? (
                  <Typography
                    as="span"
                    variant="12/regular"
                    color="neutral-500"
                    className="ms-2 inline-block"
                  >
                    {fa(percent)}٪
                  </Typography>
                ) : null}
              </Typography>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
