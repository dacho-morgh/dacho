import { Skeleton } from '@/components/ui/skeleton'

const HeroSectionSkeleton = () => (
  <div
    aria-label="در حال بارگذاری بخش اصلی"
    className="relative mx-auto flex w-full max-w-[1600px] flex-col gap-6 overflow-hidden px-8 pt-25 lg:h-200 lg:flex-row lg:gap-0 lg:px-0 lg:pt-45"
  >
    <div className="order-2 flex w-full flex-1 flex-col items-start gap-8 px-4 pt-1 lg:order-1 lg:w-160 lg:gap-20 lg:px-10">
      <div className="ml-auto flex w-full max-w-150 flex-col gap-4">
        <Skeleton className="h-6 w-50 rounded-lg bg-neutral-200 lg:h-10 lg:w-90" />
        <Skeleton className="h-6 w-40 rounded-lg bg-neutral-200 lg:h-10 lg:w-70" />
        <Skeleton className="h-4 w-30 rounded-lg bg-neutral-200 lg:h-10 lg:w-44" />
        <Skeleton className="h-5 w-full rounded-md bg-neutral-100" />
        <Skeleton className="h-5 w-3/4 rounded-md bg-neutral-100" />
      </div>
      <div className="flex w-full justify-center gap-4 self-start pb-20 lg:justify-start lg:px-0 lg:pb-0">
        <Skeleton className="h-12 w-40 rounded-2xl bg-neutral-200" />
        <Skeleton className="h-12 w-40 rounded-2xl bg-neutral-200" />
      </div>
    </div>
    <div aria-hidden="true" className="order-1 w-full shrink-0 lg:w-[min(90%,520px)]">
      <Skeleton className="aspect-[500/520] w-full rounded-3xl bg-neutral-100" />
    </div>
  </div>
)

export default HeroSectionSkeleton
