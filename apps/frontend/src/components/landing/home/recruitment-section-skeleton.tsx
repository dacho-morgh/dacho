import { Skeleton } from '@/components/ui/skeleton'

const RecruitmentSectionSkeleton = () => (
  <section
    aria-label="در حال بارگذاری بخش همکاری"
    className="relative z-10 mx-auto flex min-h-64 w-[calc(100%-2rem)] max-w-280 items-center overflow-hidden rounded-[40px] px-6 py-10 sm:px-10 md:px-12 xl:h-64 xl:px-20 xl:py-0"
  >
    <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-neutral-200" />

    <div
      aria-hidden="true"
      className="relative z-10 grid w-full items-center gap-8 md:grid-cols-[160px_minmax(0,1fr)] md:gap-12 xl:grid-cols-[160px_minmax(0,702px)] xl:gap-24.5"
    >
      <div className="order-2 flex justify-center md:order-1 md:justify-start">
        <Skeleton className="h-12 w-40 rounded-2xl bg-neutral-100" />
      </div>

      <div
        dir="rtl"
        className="order-1 flex min-w-0 flex-col items-center gap-4 text-center md:order-2 md:items-start md:text-right"
      >
        <Skeleton className="h-8 w-72 rounded-md bg-neutral-100" />
        <Skeleton className="h-5 max-w-175.5 w-full rounded-md bg-neutral-200/60" />
        <Skeleton className="h-5 max-w-175.5 w-3/4 rounded-md bg-neutral-200/60" />
      </div>
    </div>
  </section>
)

export default RecruitmentSectionSkeleton