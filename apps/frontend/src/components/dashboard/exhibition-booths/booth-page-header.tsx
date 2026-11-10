import Link from 'next/link'
import type { ReactNode } from 'react'
import { Typography } from '@/components/ui/typography'

/** Title, breadcrumb and summary banner, following the queue pattern in Figma 31650:6. */
export function BoothPageHeader({
  title,
  crumb,
  summaryTitle,
  summary,
}: {
  title: string
  crumb: string
  summaryTitle: string
  summary: ReactNode
}) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <Typography as="h1" variant="24/bold" color="neutral-700">
          {title}
        </Typography>
        <nav aria-label="مسیر صفحه">
          <Typography variant="12/regular" color="neutral-500">
            <Link href="/dashboard/exhibitions" className="hover:text-brand-500">
              نمایشگاه‌ها
            </Link>{' '}
            / {crumb}
          </Typography>
        </nav>
      </header>
      <div className="flex flex-col gap-2 rounded-xl bg-brand-50 p-4">
        <Typography variant="14/semibold" color="brand-600">
          {summaryTitle}
        </Typography>
        <Typography variant="12/regular" color="brand-600">
          {summary}
        </Typography>
      </div>
    </>
  )
}
