import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { Button } from '@/components/ui/button'
import NewsCard from './news-card'

const NewsSection = async () => {
  const payload = await getPayload({ config: configPromise })
  const { docs: newsItems } = await payload.find({
    collection: 'news',
    depth: 1,
    limit: 6,
    overrideAccess: false,
    sort: ['-pinned', '-publishDate', '-createdAt'],
    where: {
      status: {
        equals: 'published',
      },
    },
  })

  if (newsItems.length === 0) return null

  return (
    <section
      dir="rtl"
      className="relative z-10 flex w-full flex-col items-center gap-10 bg-[#FAFAFA] px-4 py-24 sm:px-6 sm:py-32 lg:px-0 lg:py-40"
    >
      <div className="flex w-full max-w-7xl flex-col items-center gap-2 text-center">
        <h2 className="text-[32px] leading-12 font-bold text-[#525252] sm:text-[40px] sm:leading-16">
          اخبار
        </h2>
        <p className="max-w-7xl text-base leading-7 text-[#737373] sm:text-xl sm:leading-8">
          از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه
          مدیریت می‌شود.
        </p>
      </div>

      <div className="grid w-full max-w-7xl grid-cols-1 justify-items-center gap-4 md:grid-cols-2 xl:grid-cols-3">
        {newsItems.map((news) => (
          <NewsCard key={news.id} news={news} />
        ))}
      </div>

      <Button
        variant="ghost"
        className="h-12 rounded-xl px-3 py-2 text-xl leading-8 font-normal text-[#525252] hover:bg-[#F5F5F5]"
      >
        مشاهده همه
      </Button>
    </section>
  )
}

export default NewsSection
