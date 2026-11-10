import type { ReactNode } from 'react'
import Link from 'next/link'

import { Typography } from '@/components/ui/typography'

/**
 * The frame every role's request page shares (Figma «صفحه درخواست», e.g. 31881:32837):
 * the «درخواست‌ها / title» breadcrumb with the page's main action opposite it, then the
 * cards. The parent comes first so the right-to-left trail reads correctly whatever
 * language the title is in.
 */
export function RequestDetailShell({
  title,
  actions,
  notices,
  children,
}: {
  title: string
  /** The page's main action, drawn at the far side of the title row. */
  actions?: ReactNode
  /** Banners that belong above the cards. */
  notices?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pt-6 md:pt-10" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 pe-12 md:pe-0">
        <nav aria-label="مسیر صفحه" className="flex min-h-10 min-w-0 flex-wrap items-center gap-2">
          <Link href="/dashboard/requests">
            <Typography as="span" variant="14/regular" sm="16/regular" color="muted">
              درخواست‌ها
            </Typography>
          </Link>
          <Typography as="span" variant="14/regular" sm="16/regular" color="muted" aria-hidden="true">
            /
          </Typography>
          <Typography as="h1" variant="20/bold" sm="24/bold" color="neutral-700" dir="auto" className="min-w-0 break-words">
            {title}
          </Typography>
        </nav>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {notices}
      {children}
    </main>
  )
}
