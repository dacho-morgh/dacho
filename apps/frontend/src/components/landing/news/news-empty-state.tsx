import { NewsEmptyState as NewsEmptyStateIllustration } from '@/components/icons'
import { Typography } from '@/components/ui/typography'

export function NewsEmptyState({
  title = 'اخباری برای نمایش وجود ندارد',
  description = 'در حال حاضر خبری در این بخش منتشر نشده است. برای اطلاع از آخرین اخبار، به‌زودی دوباره به این صفحه سر بزنید.',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex min-h-103.5 w-full flex-col items-center justify-center gap-10 py-10 text-center">
      <NewsEmptyStateIllustration
        aria-hidden="true"
        className="h-auto w-60 text-brand-400 sm:w-70"
      />
      <div className="flex max-w-3xl flex-col gap-4">
        <Typography as="h2" variant="20/bold" color="neutral-700">
          {title}
        </Typography>
        <Typography variant="16/regular" color="neutral-500">
          {description}
        </Typography>
      </div>
    </div>
  )
}
