import type { ReactNode } from 'react'
import { Typography } from '@/components/ui/typography'

/** The frame every role overview shares: title, greeting, an optional action, then its sections. */
export function OverviewShell({
  greeting,
  action,
  children,
}: {
  greeting: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6 p-4 pb-10 sm:px-8 sm:pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3 ps-14 md:ps-0">
        <div className="flex flex-col gap-1">
          <Typography as="h1" variant="24/bold" color="neutral-800">
            داشبورد
          </Typography>
          <Typography as="p" variant="14/regular" color="neutral-500">
            {greeting}
          </Typography>
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

/** Four KPI cards in a row that wraps down to one column on a phone. */
export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label="شاخص‌های کلیدی"
      className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4"
    >
      {children}
    </section>
  )
}
