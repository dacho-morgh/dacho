import React from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'

/** Route-level skeleton shared by dashboard queues (Figma loading states). */
export function DashboardRouteLoading({ label = 'در حال بارگذاری پیشخوان' }: { label?: string }) {
  return (
    <div className="flex w-full flex-col gap-5 p-6 sm:p-8" role="status">
      <Typography as="span" className="sr-only">
        {label}
      </Typography>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  )
}
