import { NewsEmptyState as NewsEmptyStateIllustration } from '@/components/icons'
import { Typography } from '@/components/ui/typography'

export function NewsEmptyState() {
  return (
    <div className="flex min-h-103.5 w-full flex-col items-center justify-center gap-10 py-10 text-center">
      <NewsEmptyStateIllustration
        aria-hidden="true"
        className="h-auto w-60 text-brand-400 sm:w-70"
      />
      <div className="flex max-w-3xl flex-col gap-4">
        <Typography as="h2" variant="20/bold" color="neutral-700">
          اخباری برای نمایش وجود ندارد
        </Typography>
        <Typography variant="16/regular" color="neutral-500">
          در حال حاضر خبری در این بخش منتشر نشده است. برای اطلاع از آخرین اخبار، به‌زودی دوباره به این
          صفحه سر بزنید.
        </Typography>
      </div>
    </div>
  )
}
