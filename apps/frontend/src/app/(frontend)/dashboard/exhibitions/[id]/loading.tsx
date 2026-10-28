import { Skeleton } from '@/components/ui/skeleton'

export default function ExhibitionAdminLoading() {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center bg-[#fafafa] px-4 pt-6 pb-12 sm:px-6 sm:pt-10 lg:px-8"
      dir="rtl"
    >
      <div className="flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-40 rounded-lg bg-neutral-200" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64 rounded-lg bg-neutral-200" />
            <Skeleton className="h-10 w-32 rounded-lg bg-neutral-200" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-2xl bg-neutral-100" />
        <Skeleton className="h-64 w-full rounded-2xl bg-neutral-100" />
      </div>
    </div>
  )
}
