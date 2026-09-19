import { Skeleton } from '@/components/ui/skeleton'

const NewsCardSkeleton = () => (
  <article
    aria-hidden="true"
    className="flex w-full flex-col items-end overflow-hidden rounded-4xl bg-white drop-shadow-xl lg:drop-shadow-md"
  >
    <Skeleton className="h-50 w-full rounded-none bg-neutral-200 8xl:h-65" />
    <div className="flex w-full flex-col justify-between gap-4 p-5">
      <Skeleton className="h-6 w-3/4 rounded-md bg-neutral-200" />
      <Skeleton className="h-5 w-1/2 rounded-md bg-neutral-200" />
      <Skeleton className="h-8 w-28 rounded-[10px] bg-neutral-100" />
    </div>
  </article>
)

const NewsSectionSkeleton = () => (
  <section
    dir="rtl"
    aria-label="در حال بارگذاری اخبار"
    className="relative z-10 flex w-full flex-col items-center gap-10 bg-[#FAFAFA] px-4 py-8 lg:px-0 lg:py-10"
  >
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 text-right">
      <div className="flex items-stretch gap-2 lg:ms-30 xl:ms-40 8xl:ms-0">
        <Skeleton className="my-2 w-1 rounded-full bg-neutral-300 lg:my-3 lg:w-2" />
        <Skeleton className="h-8 w-36 rounded-lg bg-neutral-200 lg:w-40" />
      </div>
      <Skeleton className="h-5 max-w-5xl rounded-md bg-neutral-100 lg:ms-30 xl:ms-40 8xl:ms-0" />
    </div>

    <div className="grid w-full max-w-[1600px] grid-cols-1 justify-items-center gap-6 px-6 md:grid-cols-2 lg:px-30 xl:grid-cols-4 xl:px-40 8xl:px-0">
      <NewsCardSkeleton />
      <NewsCardSkeleton />
      <NewsCardSkeleton />
      <NewsCardSkeleton />
    </div>

    <Skeleton className="h-12 w-40 rounded-2xl bg-neutral-200" />
  </section>
)

export default NewsSectionSkeleton