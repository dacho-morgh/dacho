import { Skeleton } from '@/components/ui/skeleton'

const EventsSectionSkeleton = () => (
  <section
    aria-label="در حال بارگذاری نمایشگاه و رویدادها"
    className="relative z-10 flex w-full flex-col items-center gap-8 px-4 py-4 lg:gap-8 lg:px-0 lg:py-10"
  >
    <Skeleton className="h-9 w-60 rounded-lg bg-neutral-200 lg:w-72" />
    <div
      aria-hidden="true"
      className="flex min-h-140 w-full max-w-7xl flex-col items-stretch gap-8 rounded-[40px] bg-white p-5 shadow-[0_0_40px_0_rgba(10,10,10,0.1)] sm:p-8 lg:min-h-160 lg:flex-row lg:gap-10 lg:rounded-[80px] lg:p-10"
    >
      <div className="min-h-80 w-full shrink-0 overflow-hidden rounded-[28px] sm:min-h-110 lg:h-140 lg:w-160 lg:rounded-[40px]">
        <Skeleton className="h-full w-full rounded-none bg-neutral-200" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-end justify-between gap-5 py-0 lg:gap-10 lg:py-10">
        <div className="flex w-full flex-col items-end gap-5 lg:gap-10">
          <div className="flex w-full flex-col gap-4 text-right">
            <Skeleton className="h-7 w-24 rounded-full bg-neutral-200" />
            <Skeleton className="h-6 w-3/4 rounded-md bg-neutral-200" />
            <Skeleton className="h-4 w-full rounded-md bg-neutral-100" />
            <Skeleton className="h-4 w-full rounded-md bg-neutral-100" />
            <Skeleton className="h-4 w-2/3 rounded-md bg-neutral-100" />
          </div>

          <div className="flex w-full flex-col items-end gap-4">
            <Skeleton className="h-4 w-40 rounded-md bg-neutral-100" />
            <Skeleton className="h-4 w-36 rounded-md bg-neutral-100" />
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex gap-2">
            <Skeleton className="size-12 rounded-xl bg-neutral-100" />
            <Skeleton className="size-12 rounded-xl bg-neutral-100" />
          </div>
          <Skeleton className="h-12 w-36 rounded-xl bg-neutral-200" />
        </div>
      </div>
    </div>
  </section>
)

export default EventsSectionSkeleton