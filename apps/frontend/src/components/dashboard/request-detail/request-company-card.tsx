import Image from 'next/image'
import Link from 'next/link'

import { CompanyBuildingIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

/**
 * The company strip that opens the oversight, reviewer and investment pages (Figma 31881:32837, 49:7968):
 * the logo and name on the reading side with the «فعال | نوع | سن» line under it, the profile link opposite.
 * The logo comes from the access-checked case route; without one the neutral company mark stands in.
 */
export function RequestCompanyCard({
  name,
  logoUrl,
  facts = [],
  profileHref,
}: {
  name: string
  /** `/api/dashboard/requests/:id/company/logo`; only roles allowed to read the case's logo get one. */
  logoUrl?: string | null
  /** What the page knows about the company (status, type, age…), joined with the design's bar. */
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
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={`لوگوی ${name}`}
            width={80}
            height={80}
            // The route is access-checked by the session cookie, which the image optimizer would not send.
            unoptimized
            className="size-20 shrink-0 rounded-2xl bg-neutral-100 object-cover"
          />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
            <CompanyBuildingIcon className="size-8" aria-hidden="true" />
          </span>
        )}
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
