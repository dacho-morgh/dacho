import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'

const ROWS = 10

/**
 * The staff table before its rows arrive. It has the real page's frame (title, a 48px toolbar,
 * a 44px header and 72px rows), so the rows replace it without moving anything.
 */
export default function EmployeesLoading() {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10" dir="rtl">
      <Typography as="span" role="status" variant="14/regular" className="sr-only">
        در حال دریافت اطلاعات
      </Typography>
      <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col gap-5">
        <Skeleton className="h-9 w-40 max-w-full rounded-lg bg-neutral-200 motion-reduce:animate-none" />
        <div className="flex flex-col-reverse gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
          <Skeleton className="h-12 w-full rounded-xl bg-neutral-100 sm:w-36 motion-reduce:animate-none" />
          <div className="flex w-full flex-row-reverse gap-2 sm:w-auto">
            <Skeleton className="size-12 shrink-0 rounded-xl bg-neutral-100 motion-reduce:animate-none" />
            <Skeleton className="h-12 w-full rounded-lg bg-neutral-100 sm:w-[400px] motion-reduce:animate-none" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-neutral-200 bg-background">
          <div className="h-11 border-b border-neutral-200" />
          {Array.from({ length: ROWS }, (_, row) => (
            <div key={row} className="flex h-[72px] items-center border-b border-neutral-100 px-4 last:border-0">
              <Skeleton className="h-4 w-full rounded-md bg-neutral-100 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
