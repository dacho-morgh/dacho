import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import NewsCard from './news-card'

const NewsSection = async () => {
  const payload = await getPayload({ config: configPromise })
  const { docs: newsItems } = await payload.find({
    collection: 'news',
    depth: 1,
    limit: 6,
    overrideAccess: false,
    sort: ['-pinned', '-publishedAt', '-createdAt'],
  })

  if (newsItems.length === 0) return null

  return (
    <section
      dir="rtl"
      className="relative z-10 flex w-full flex-col items-center gap-10 bg-[#FAFAFA] px-4 py-8 sm:px-6 lg:px-0 lg:py-20"
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 text-right">
        <div className="flex items-stretch gap-2 lg:ms-30 xl:ms-40 8xl:ms-0">
          <div className="my-2 w-1 rounded-full bg-[#FAB622] lg:my-3 lg:w-2" />
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
      <div className="grid w-full max-w-[1600px] grid-cols-1 justify-items-center gap-6 px-6 md:grid-cols-2 lg:px-30 xl:grid-cols-3 xl:px-40 8xl:px-0">
        {newsItems.map((news) => (
          <NewsCard key={news.id} news={news} />
        ))}
      </div>

      <Button variant="ghost" size="48" className="text-neutral-600 hover:bg-neutral-100">
        <Typography as="span" variant="20/regular" color="neutral-600">
          مشاهده همه
        </Typography>
      </Button>
    </section>
  )
}

export default NewsSection
