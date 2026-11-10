import Link from 'next/link'

import { CompanyBuildingIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

/**
 * The company strip that opens the oversight, reviewer and investment pages (Figma 31881:32837):
 * the mark and name on the reading side, the profile link opposite. The request payload
 * carries no logo, so the neutral company mark stands in for it.
 */
export function RequestCompanyCard({
  name,
  facts = [],
  profileHref,
}: {
  name: string
  /** What the page knows about the company (type, place…), joined with the design's bar. */
  facts?: string[]
  /** Only roles allowed on the company screens get the link. */
  profileHref?: string | null
}) {
  const shown = facts.filter(Boolean)
  return (
    <section
      aria-label="شرکت متقاضی"
      data-testid="request-company-card"
      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-background p-4"
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
          <CompanyBuildingIcon className="size-8" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <Typography as="h2" variant="16/bold" sm="20/bold" color="neutral-800" dir="auto" className="break-words">
            {name}
          </Typography>
          {shown.length ? (
            <Typography as="p" variant="14/regular" sm="16/regular" color="neutral-600" className="break-words">
              {shown.join(' | ')}
            </Typography>
          ) : null}
        </div>
      </div>
      {profileHref ? (
        <Button asChild variant="outline" size="40">
          <Link href={profileHref}>
            <Typography as="span" variant="14/regular" className="text-inherit">
              مشاهده پروفایل شرکت
            </Typography>
          </Link>
        </Button>
      ) : null}
    </section>
  )
}
