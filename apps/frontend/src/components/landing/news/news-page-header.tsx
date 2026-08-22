import Link from 'next/link'
import { Typography } from '@/components/ui/typography'

const NEWS_DESCRIPTION =
  'از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه مدیریت می‌شود.'

export function NewsBreadcrumb({ title }: { title?: string }) {
  return (
    <nav aria-label="مسیر صفحه" className="flex min-h-9 items-center gap-2 text-right">
      <Link href="/">
        <Typography as="span" variant="16/regular" color="neutral-500">
          صفحه خانه
        </Typography>
      </Link>
      <Typography as="span" variant="16/regular" color="neutral-500" aria-hidden="true">
        /
      </Typography>
      {title && (
        <>
          <Link href="/news">
            <Typography as="span" variant="16/regular" color="neutral-500">
              اخبار
            </Typography>
          </Link>
          <Typography as="span" variant="16/regular" color="neutral-500" aria-hidden="true">
            /
          </Typography>
        </>
      )}
      <Typography
        as="span"
        variant={title ? '20/bold' : '24/bold'}
        color="neutral-700"
        className={title ? 'max-w-[65vw] truncate lg:max-w-230' : undefined}
        aria-current="page"
      >
        {title || 'اخبار'}
      </Typography>
    </nav>
  )
}

export function NewsPageHeading() {
  return (
    <header className="flex flex-col items-start gap-2 text-right">
      <div className="flex items-center gap-2 sm:gap-4">
        <span aria-hidden="true" className="h-10 w-1 rounded-full bg-[#FAB622] sm:h-12 sm:w-2" />
        <Typography as="h1" variant="32/bold" sm="40/bold" color="neutral-600">
          اخبار
        </Typography>
      </div>
      <Typography variant="16/regular" sm="20/regular" color="neutral-500">
        {NEWS_DESCRIPTION}
      </Typography>
    </header>
  )
}
