import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'
import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
import { DashboardCloseCircle, EditIcon, RequestsIcon, TickCircleIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Typography } from '@/components/ui/typography'
import { formatDate, type ActivityDto } from '@/utilities/dashboard-api'
import { cn } from '@/utilities/ui'
import { TONE_CHIP, activityTone, type OverviewTone } from './tone'

const TONE_ICON: Record<OverviewTone, ComponentType<SVGProps<SVGSVGElement>>> = {
  brand: RequestsIcon,
  success: TickCircleIcon,
  warning: EditIcon,
  error: DashboardCloseCircle,
}

export function ActivityCard({
  items,
  notice,
}: {
  items?: ActivityDto[]
  notice?: UnavailableReason
}) {
  return (
    <Card className="rounded-[10px] border-neutral-200 bg-background px-6 py-5 shadow-none">
      <Typography as="h2" variant="title" color="neutral-800" className="mb-4">
        اعلان‌ها
      </Typography>
      {notice ? (
        <OfflineNotice reason={notice} retryHref="/dashboard" />
      ) : !items?.length ? (
        <Typography as="p" variant="14/regular" color="neutral-500">
          اعلان تازه‌ای ثبت نشده است.
        </Typography>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => {
            const tone = activityTone(item.action)
            const Icon = TONE_ICON[tone]
            const body = (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-5',
                    TONE_CHIP[tone],
                  )}
                >
                  <Icon />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <Typography as="span" variant="14/semibold" color="neutral-800">
                    {item.title}
                  </Typography>
                  {item.description ? (
                    <Typography
                      as="span"
                      variant="12/regular"
                      color="neutral-500"
                      className="line-clamp-2"
                    >
                      {item.description}
                    </Typography>
                  ) : null}
                </span>
                <Typography
                  as="time"
                  variant="12/regular"
                  color="neutral-500"
                  className="shrink-0 whitespace-nowrap"
                  dateTime={item.at}
                >
                  {formatDate(item.at)}
                </Typography>
              </>
            )
            const row =
              'flex items-start gap-3 border-t border-neutral-100 py-3 first:border-t-0 first:pt-0'
            return (
              <li key={item.id}>
                {item.requestId ? (
                  <Link
                    href={`/dashboard/requests/${encodeURIComponent(item.requestId)}`}
                    className={cn(
                      row,
                      'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                    )}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={row}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-3 flex justify-center border-t border-neutral-100 pt-3">
        <Button size="32" variant="text" asChild>
          <Link href="/dashboard/letters">مشاهده همه اعلان‌ها</Link>
        </Button>
      </div>
    </Card>
  )
}
