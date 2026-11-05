import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'

const block = 'bg-neutral-100 motion-reduce:animate-none'

function FieldTiles({ count }: { count: number }) {
  return (
    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={`h-[78px] rounded-lg ${block}`} />
      ))}
    </div>
  )
}

/**
 * The company detail before its data arrives. It has the real page's frame (breadcrumb, card,
 * section tabs, logo row and the two profile cards), so the content replaces it without moving anything.
 */
export function CompanyDetailSkeleton() {
  return (
    <main
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pt-6 md:pt-10 lg:overflow-hidden"
      dir="rtl"
    >
      <Typography as="span" role="status" variant="14/regular" className="sr-only">
        در حال دریافت اطلاعات شرکت
      </Typography>
      <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex min-h-10 items-center gap-2 pe-12 md:pe-0">
          <Skeleton className="h-6 w-16 rounded-md bg-neutral-100 motion-reduce:animate-none" />
          <Skeleton className="h-9 w-48 max-w-full rounded-lg bg-neutral-200 motion-reduce:animate-none" />
        </div>
        <div className="flex shrink-0 grow flex-col gap-4 rounded-2xl border border-neutral-200 bg-background p-4 lg:min-h-0 lg:flex-1 lg:flex-row">
          <div className="sticky bottom-2 z-20 order-last grid grid-cols-4 gap-1 rounded-2xl border border-neutral-200 bg-background p-1 shadow-lg lg:static lg:order-first lg:flex lg:w-[200px] lg:shrink-0 lg:flex-col lg:gap-4 lg:self-stretch lg:rounded-none lg:border-y-0 lg:border-r-0 lg:bg-transparent lg:p-0 lg:pl-2 lg:shadow-none">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className={`h-12 rounded-xl lg:h-10 ${block}`} />
            ))}
            <Skeleton className={`hidden h-10 rounded-xl lg:block ${block}`} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-5 lg:min-h-0 lg:overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Skeleton className="size-20 rounded-2xl bg-neutral-100 motion-reduce:animate-none" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Skeleton className={`h-8 w-40 rounded-[10px] sm:h-10 ${block}`} />
                <Skeleton className={`h-8 w-36 rounded-[10px] sm:h-10 ${block}`} />
              </div>
            </div>
            <div className="flex flex-col gap-5 rounded-2xl border border-neutral-200 p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-32 rounded-md bg-neutral-200 motion-reduce:animate-none" />
                <Skeleton className={`h-8 w-20 rounded-[10px] ${block}`} />
              </div>
              <FieldTiles count={7} />
            </div>
            <div className="flex flex-col gap-5 rounded-2xl border border-neutral-200 p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-24 rounded-md bg-neutral-200 motion-reduce:animate-none" />
                <Skeleton className={`h-8 w-24 rounded-[10px] ${block}`} />
              </div>
              <Skeleton className={`h-28 rounded-lg ${block}`} />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
