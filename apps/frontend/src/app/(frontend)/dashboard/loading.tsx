import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'

/** Shown while a dashboard page reads its data; no action is clickable until the real page arrives. */
export default function DashboardLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-6 pt-20 md:p-10" dir="rtl">
      <Typography as="span" role="status" variant="14/regular" className="sr-only">
        در حال دریافت اطلاعات
      </Typography>
      <div className="flex flex-col gap-6" aria-hidden="true">
        <Skeleton className="h-8 w-64 max-w-full rounded-lg bg-neutral-200 motion-reduce:animate-none" />
        <Skeleton className="h-12 w-full rounded-xl bg-neutral-100 motion-reduce:animate-none" />
        <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full rounded-lg bg-neutral-100 motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </div>
  )
}
