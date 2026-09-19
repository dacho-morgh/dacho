import { Skeleton } from '@/components/ui/skeleton'

const ServiceCardSkeleton = () => (
  <article
    aria-hidden="true"
    className="flex h-[420px] min-w-0 flex-col items-end gap-4 rounded-[40px] bg-white px-4 pt-4 pb-8 drop-shadow-xl lg:h-auto lg:w-96"
  >
    <Skeleton className="h-60 w-full shrink-0 rounded-3xl bg-neutral-200 lg:h-80 lg:rounded-4xl" />
    <div className="flex w-full flex-col items-start gap-2 px-2 text-right">
      <Skeleton className="h-6 w-40 rounded-md bg-neutral-200" />
      <Skeleton className="h-4 w-full rounded-md bg-neutral-100" />
      <Skeleton className="h-4 w-3/4 rounded-md bg-neutral-100" />
    </div>
  </article>
)

const ServicesSectionSkeleton = () => (
  <section
    aria-label="در حال بارگذاری ارائه خدمات"
    className="flex w-full flex-col items-center gap-6 overflow-x-clip py-16 md:py-24 lg:py-28 2xl:py-32"
  >
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 text-right">
      <div className="flex items-stretch gap-2 lg:ms-30 xl:ms-40 8xl:ms-0">
        <Skeleton className="my-2 w-1 rounded-full bg-neutral-300 lg:my-3 lg:w-2" />
        <Skeleton className="h-8 w-44 rounded-lg bg-neutral-200" />
      </div>
      <Skeleton className="h-5 max-w-5xl rounded-md bg-neutral-100 lg:ms-30 xl:ms-40 8xl:ms-0" />
    </div>

    <div className="flex w-full gap-6 overflow-hidden px-6 lg:px-30 xl:px-40 8xl:px-0">
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
    </div>

    <div className="flex w-full items-start gap-2 ps-8 md:ps-20 lg:ps-30 xl:ps-40">
      <Skeleton className="size-12 rounded-xl bg-neutral-200" />
      <Skeleton className="size-12 rounded-xl bg-neutral-200" />
    </div>
  </section>
)

export default ServicesSectionSkeleton