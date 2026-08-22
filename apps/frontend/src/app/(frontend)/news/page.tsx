import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import NewsCard from '@/components/landing/home/news-card'
import RecruitmentSection from '@/components/landing/home/recruitment-section'
import { NewsEmptyState } from '@/components/landing/news/news-empty-state'
import { NewsBreadcrumb, NewsPageHeading } from '@/components/landing/news/news-page-header'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'اخبار',
  description: 'آخرین اخبار، فرصت‌های صنعتی، داوری‌های تخصصی و رویدادهای صندوق کارآفرینی بوشهر.',
}

export default async function NewsPage() {
  const payload = await getPayload({ config: configPromise })
  const { docs: newsItems } = await payload.find({
    collection: 'news',
    depth: 1,
    limit: 12,
    overrideAccess: false,
    sort: ['-pinned', '-publishDate', '-createdAt'],
    where: {
      status: {
        equals: 'published',
      },
    },
  })

  return (
    <main className="overflow-x-clip bg-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pt-10 pb-20 sm:px-6 lg:pt-14">
        <NewsBreadcrumb />
        <NewsPageHeading />

        {newsItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {newsItems.map((news) => (
              <NewsCard key={news.id} news={news} variant="listing" />
            ))}
          </div>
        ) : (
          <NewsEmptyState />
        )}
      </section>

      <RecruitmentSection />
      <div className="h-40" aria-hidden="true" />
    </main>
  )
}
