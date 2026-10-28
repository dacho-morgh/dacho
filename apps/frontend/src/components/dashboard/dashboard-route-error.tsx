'use client'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

/** Route-level failure boundary for the dashboard queues (network/server). */
export function DashboardRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const digest = error.digest
  return (
    <section
      role="alert"
      className="m-6 flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border border-error-100 bg-white p-6 text-center sm:m-8"
    >
      <Typography as="h2" variant="24/bold" color="neutral-700">
        دریافت اطلاعات این بخش انجام نشد
      </Typography>
      <Typography color="neutral-500">
        ارتباط با سرویس پیشخوان برقرار نشد. این خطا به معنای نبود داده نیست.
      </Typography>
      {digest && (
        <Typography as="span" variant="12/regular" color="neutral-400" className="font-mono">
          {digest}
        </Typography>
      )}
      <Button type="button" onClick={reset}>
        تلاش دوباره
      </Button>
    </section>
  )
}
