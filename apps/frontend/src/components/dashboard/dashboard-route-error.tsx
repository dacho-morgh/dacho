'use client'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

/** A tab opened before a deploy asks for code the new build no longer serves. */
function isStaleBuild(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /loading chunk|dynamically imported module/i.test(error.message)
  )
}

/** Route-level failure boundary for the dashboard queues (network/server). */
export function DashboardRouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const digest = error.digest
  const staleBuild = isStaleBuild(error)
  return (
    <section
      role="alert"
      className="m-6 mt-20 flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border border-error-100 bg-white p-6 text-center sm:m-8 sm:mt-20 md:mt-8"
    >
      <Typography as="h2" variant="24/bold" color="neutral-700">
        {staleBuild ? 'نسخه تازه‌ای از سامانه منتشر شده است' : 'دریافت اطلاعات این بخش انجام نشد'}
      </Typography>
      <Typography color="neutral-500">
        {staleBuild
          ? 'این صفحه با نسخه قدیمی باز شده است. برای ادامه، آن را تازه کنید.'
          : 'ارتباط با سرویس پیشخوان برقرار نشد. این خطا به معنای نبود داده نیست.'}
      </Typography>
      {digest && (
        <Typography as="span" variant="12/regular" color="neutral-400" className="font-mono">
          {digest}
        </Typography>
      )}
      <Button type="button" onClick={staleBuild ? () => window.location.reload() : () => retry()}>
        <Typography>{staleBuild ? 'تازه کردن صفحه' : 'تلاش دوباره'}</Typography>
      </Button>
    </section>
  )
}
