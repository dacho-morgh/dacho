import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'

export default function RequestDetailLoading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-10" dir="rtl" role="status">
      <Typography as="span" className="sr-only">
        در حال بارگذاری جزئیات درخواست
      </Typography>
      <Skeleton className="h-9 w-64 rounded-xl" />
      <Skeleton className="h-5 w-80 rounded-lg" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </main>
  )
}
