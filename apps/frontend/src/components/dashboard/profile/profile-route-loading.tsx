import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'

export function ProfileRouteLoading() {
  return (
    <div className="flex w-full flex-col gap-5" role="status">
      <Typography as="span" className="sr-only">
        در حال بارگذاری اطلاعات پروفایل
      </Typography>
      <Skeleton className="size-20 rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  )
}
