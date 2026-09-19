import { Skeleton } from '@/components/ui/skeleton'

const FaqItemSkeleton = () => (
  <div aria-hidden="true" className="flex w-full flex-col gap-3 rounded-2xl bg-neutral-100 px-4 py-4">
    <Skeleton className="h-5 w-3/4 rounded-md bg-neutral-200" />
    <Skeleton className="h-4 w-full rounded-md bg-neutral-200/60" />
    <Skeleton className="h-4 w-5/6 rounded-md bg-neutral-200/60" />
  </div>
)

const FaqSectionSkeleton = () => (
  <section
    aria-label="در حال بارگذاری سوالات پر تکرار"
    className="flex w-full flex-col items-center gap-10 bg-neutral-50 px-4 pt-10 pb-15 sm:px-6 lg:px-0 lg:py-20"
  >
    <div className="flex w-full max-w-200 flex-col items-center gap-2 text-center">
      <Skeleton className="h-9 w-52 rounded-lg bg-neutral-200" />
      <Skeleton className="h-5 max-w-200 w-full rounded-md bg-neutral-100" />
    </div>

    <div className="flex w-full max-w-200 flex-col gap-4">
      <FaqItemSkeleton />
      <FaqItemSkeleton />
      <FaqItemSkeleton />
    </div>
  </section>
)

export default FaqSectionSkeleton