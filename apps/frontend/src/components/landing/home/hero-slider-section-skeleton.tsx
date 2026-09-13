import { Skeleton } from '@/components/ui/skeleton'

const HeroSliderSectionSkeleton = () => (
  <section
    aria-label="در حال بارگذاری اسلایدر"
    className="relative mx-auto h-180 w-full max-w-[1600px] px-4 pt-25 pb-8 lg:h-200 lg:px-10 lg:pt-24 lg:pb-10"
  >
    <div className="relative h-full w-full overflow-hidden rounded-3xl">
      <Skeleton className="h-full w-full rounded-none bg-neutral-200" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-b from-transparent to-neutral-900/30"
      />
      <div className="absolute inset-x-0 bottom-6 flex justify-center gap-2">
        <Skeleton className="h-2 w-8 rounded-full bg-neutral-100/80" />
        <Skeleton className="h-2 w-2 rounded-full bg-neutral-100/60" />
        <Skeleton className="h-2 w-2 rounded-full bg-neutral-100/60" />
      </div>
    </div>
  </section>
)

export default HeroSliderSectionSkeleton
