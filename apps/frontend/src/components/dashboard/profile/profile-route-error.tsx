'use client'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export function ProfileRouteError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <section className="flex min-h-80 w-full flex-col items-center justify-center gap-4 rounded-2xl border border-error-100 bg-white p-6 text-center">
      <Typography as="h2" variant="24/bold" color="neutral-700">
        بارگذاری این بخش انجام نشد
      </Typography>
      <Typography color="neutral-500">
        مشکلی در دریافت اطلاعات پروفایل رخ داد. لطفاً دوباره تلاش کنید.
      </Typography>
      <Button type="button" onClick={() => retry()}>
        تلاش دوباره
      </Button>
    </section>
  )
}
