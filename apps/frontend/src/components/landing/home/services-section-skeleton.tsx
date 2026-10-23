import { Skeleton } from '@/components/ui/skeleton'
import { serviceCardClassName, servicesGridClassName } from './services-layout'

const ServiceCardSkeleton = () => (
  <article
    aria-hidden="true"
    className="flex h-full min-w-0 flex-col gap-5 rounded-3xl bg-white p-5 shadow-sm sm:p-6"
  >
    <div className="flex min-h-8 items-start md:min-h-16 lg:min-h-18">
      <Skeleton className="h-8 w-3/4 rounded-md bg-neutral-200" />
    </div>
    <Skeleton className="aspect-video max-h-56 w-full shrink-0 rounded-2xl bg-neutral-200" />
    <div className="flex w-full flex-col gap-2">
      <Skeleton className="h-5 w-full rounded-md bg-neutral-100" />
      <Skeleton className="h-5 w-3/4 rounded-md bg-neutral-100" />
    </div>
  </article>
)

const ServicesSectionSkeleton = () => (
  <section
    aria-label="در حال بارگذاری ارائه خدمات"
    className="w-full bg-neutral-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
  >
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 sm:gap-10">
      <div className="flex flex-col gap-3">
        <div className="flex items-stretch gap-3">
          <Skeleton className="my-2 w-1.5 shrink-0 rounded-full bg-neutral-300" />
          <Skeleton className="h-[50px] w-44 rounded-lg bg-neutral-200 sm:h-16" />
        </div>
        <Skeleton className="h-14 w-full max-w-5xl rounded-md bg-neutral-100 sm:h-16" />
      </div>
      <div className={servicesGridClassName}>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={serviceCardClassName(index, 5)}>
            <ServiceCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  </section>
)

export default ServicesSectionSkeleton
