import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import { FIXED_CARD_HEIGHT } from './shared'

const shimmer = 'motion-reduce:animate-none'

/**
 * The overview before its numbers arrive. It has the real overview's frame (header, a row of KPI cards
 * at their 168px height, a row of three fixed-height section cards and a table card), so the data
 * replaces it without moving much. It does not know the role (the role is read behind it), so the
 * rows below the KPIs are the shape the reviewer board has.
 */
export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 pb-10 sm:px-8 sm:pt-6" dir="rtl">
      <Typography as="span" role="status" variant="14/regular" className="sr-only">
        در حال دریافت اطلاعات
      </Typography>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 pe-14 md:pe-0">
          <Skeleton className={`h-8 w-40 max-w-full rounded-lg bg-neutral-200 ${shimmer}`} />
          <Skeleton className={`h-5 w-64 max-w-full rounded-md bg-neutral-100 ${shimmer}`} />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {[0, 1, 2, 3].map((card) => (
            <Skeleton
              key={card}
              className={`h-[168px] rounded-[10px] border border-neutral-200 bg-neutral-100 ${shimmer}`}
            />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((card) => (
            <Skeleton
              key={card}
              className={`${FIXED_CARD_HEIGHT} rounded-[10px] border border-neutral-200 bg-neutral-100 ${shimmer}`}
            />
          ))}
        </div>
        <div className="overflow-hidden rounded-[10px] border border-neutral-200 bg-background">
          <div className="px-6 pt-5 pb-3">
            <Skeleton className={`h-6 w-48 rounded-md bg-neutral-200 ${shimmer}`} />
          </div>
          <div className="h-11 border-y border-neutral-200" />
          {[0, 1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="flex h-[72px] items-center border-b border-neutral-100 px-4 last:border-0"
            >
              <Skeleton className={`h-4 w-full rounded-md bg-neutral-100 ${shimmer}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
