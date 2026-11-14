import Image from 'next/image'
import Link from 'next/link'

import { CompanyBuildingIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

/**
 * The company strip that opens the oversight, reviewer and investment pages (Figma 31885:6786): the 80px mark
 * and the name over the facts («فعال | سهامی عام | ۵ سال») on the reading side, the profile link opposite.
 */
export function RequestCompanyCard({
  name,
  facts = [],
  profileHref,
  logoUrl = null,
}: {
  name: string
  /** What the page knows about the company (status, type, age…), set apart by the design's bar. */
  facts?: string[]
  /** Only roles allowed on the company screens get the link. */
  profileHref?: string | null
  /** The company's picture (its access-checked file route), when it has one. */
  logoUrl?: string | null
}) {
  const shown = facts.filter(Boolean)
  return (
    <section
      aria-label="شرکت متقاضی"
      data-testid="request-company-card"
      className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-neutral-200 bg-background p-4"
    >
      <div className="flex min-w-0 items-start gap-4">
        {logoUrl ? (
          // The file route is access-checked by the session cookie, which the image optimizer would not send.
          <Image src={logoUrl} alt="" width={80} height={80} unoptimized className="size-20 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
            <CompanyBuildingIcon className="size-8" aria-hidden="true" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-4">
          <Typography as="h2" variant="20/bold" color="neutral-700" dir="auto" className="break-words">
            {name}
          </Typography>
          {shown.length ? (
            <ul className="flex min-w-0 flex-wrap items-center gap-x-3">
              {shown.map((fact, index) => (
                <li key={`${index}-${fact}`} className="flex items-center gap-3">
                  {index > 0 ? (
                    <Typography as="span" variant="16/semibold" color="neutral-600" aria-hidden="true">
                      |
                    </Typography>
                  ) : null}
                  <Typography as="span" variant="16/semibold" color="neutral-600" className="break-words">
                    {fact}
                  </Typography>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {profileHref ? (
        <Button asChild variant="text-primary" size="40">
          <Link href={profileHref}>
            <Typography as="span" variant="16/semibold" className="text-inherit">
              مشاهده پروفایل شرکت
            </Typography>
          </Link>
        </Button>
      ) : null}
    </section>
  )
}
