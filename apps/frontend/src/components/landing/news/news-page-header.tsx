import Link from 'next/link'
import { Typography } from '@/components/ui/typography'

const NEWS_DESCRIPTION =
  'از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه مدیریت می‌شود.'

export function NewsBreadcrumb({
  title,
  section = 'اخبار',
  sectionHref = '/news',
}: {
  title?: string
  section?: string
  sectionHref?: string
}) {
  return (
    <nav aria-label="مسیر صفحه" className="flex min-h-9 items-center gap-2 text-right">
      <Link href="/">
        <Typography as="span" variant="14/regular" lg="16/regular" color="neutral-500">
          خانه
        </Typography>
      </Link>
      <Typography
        as="span"
        variant="14/regular"
        lg="16/regular"
        color="neutral-500"
        aria-hidden="true"
      >
        /
      </Typography>
      {title && (
        <>
          <Link href={sectionHref}>
            <Typography as="span" variant="14/regular" lg="16/regular" color="neutral-500">
              {section}
            </Typography>
          </Link>
          <Typography
            as="span"
            variant="14/regular"
            lg="16/regular"
            color="neutral-500"
            aria-hidden="true"
          >
            /
          </Typography>
        </>
      )}
      <Typography
        as="span"
        variant={title ? '16/semibold' : '20/bold'}
        lg={title ? '20/bold' : '24/bold'}
        color="neutral-700"
        className={title ? 'max-w-[65vw] truncate lg:max-w-230' : undefined}
        aria-current="page"
      >
        {title || section}
      </Typography>
    </nav>
  )
}

export function NewsPageHeading({
  title = 'اخبار',
  description = NEWS_DESCRIPTION,
}: {
  title?: string
  description?: string
}) {
  return (
    <header className="flex flex-col items-start gap-2 text-right">
      <div className="flex items-center gap-2 sm:gap-4">
        <span
          aria-hidden="true"
          className="h-10 w-1 rounded-full bg-secondary-500 sm:h-12 sm:w-2"
        />
        <Typography as="h1" variant="24/bold" lg="40/bold" color="neutral-600">
          {title}
        </Typography>
      </div>
      <Typography variant="16/regular" lg="20/regular" color="neutral-500">
        {description}
      </Typography>
    </header>
  )
}
