import configPromise from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { buildSafe } from '@/utilities/buildSafe'
import NewsCard from './news-card'

const NewsSection = async () => {
  const newsItems = await buildSafe('home news', async () => {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'news',
      draft: false,
      where: { _status: { equals: 'published' } },
      depth: 1,
      limit: 4,
      overrideAccess: false,
      sort: ['-pinned', '-publishedAt', '-createdAt'],
    })
    return docs
  })

  if (!newsItems || newsItems.length === 0) return null

  return (
    <section
      dir="rtl"
      className="relative z-10 flex w-full flex-col items-center gap-10 bg-neutral-50 px-4 py-8 lg:px-0 lg:py-10"
    >
      <div
        data-home-reveal
        className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 text-right"
      >
        <div className="flex items-stretch gap-2 lg:ms-30 xl:ms-40 8xl:ms-0">
          <div className="my-2 w-1 rounded-full bg-secondary-500 lg:my-3 lg:w-2" />
          <Typography as="h2" variant="32/extrabold" sm="40/extrabold" color="neutral-600">
            اخبار
          </Typography>
        </div>
        <Typography
          variant="16/light"
          sm="20/regular"
          color="neutral-500"
          className="max-w-5xl lg:ms-30 xl:ms-40 8xl:ms-0"
        >
          از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه
          مدیریت می‌شود.
        </Typography>
      </div>
      <div className="grid w-full max-w-[1600px] grid-cols-1 justify-items-center gap-6 px-6 md:grid-cols-2 lg:px-30 xl:grid-cols-4 xl:px-40 8xl:px-0">
        {newsItems.map((news) => (
          <NewsCard key={news.id} news={news} />
        ))}
      </div>

      <Button asChild variant="ghost" size="48" className="text-neutral-600 hover:bg-neutral-100">
        <Link href="/news">
          <Typography as="span" variant="20/regular" color="neutral-600">
            مشاهده همه
          </Typography>
        </Link>
      </Button>
    </section>
  )
}

export default NewsSection
