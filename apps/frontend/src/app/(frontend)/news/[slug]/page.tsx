import configPromise from '@payload-config'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'
import RecruitmentSection from '@/components/landing/home/recruitment-section'
import { NewsBreadcrumb } from '@/components/landing/news/news-page-header'
import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import { Typography } from '@/components/ui/typography'

export const revalidate = 600

type Args = {
  params: Promise<{ slug: string }>
}

const persianDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function countTextWords(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((total, item) => total + countTextWords(item), 0)
  if (!value || typeof value !== 'object') return 0

  return Object.entries(value).reduce((total, [key, item]) => {
    if (key === 'text' && typeof item === 'string') {
      return total + item.trim().split(/\s+/u).filter(Boolean).length
    }
    return total + countTextWords(item)
  }, 0)
}

const queryNewsBySlug = cache(async (slug: string) => {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'news',
    depth: 2,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: {
      and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }],
    },
  })

  return result.docs[0] || null
})

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'news',
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: { slug: true },
    where: { status: { equals: 'published' } },
  })

  return result.docs.flatMap((news) => (news.slug ? [{ slug: news.slug }] : []))
}

export default async function NewsArticlePage({ params }: Args) {
  const { slug } = await params
  const news = await queryNewsBySlug(decodeURIComponent(slug))

  if (!news) notFound()

  const publishedAt = news.publishDate || news.createdAt
  const readingMinutes = Math.max(1, Math.ceil(countTextWords(news.content) / 200))
  const hasFeaturedImage = typeof news.featuredImage === 'object' && news.featuredImage !== null

  return (
    <main className="overflow-x-clip bg-white">
      <article className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 pt-10 pb-20 sm:px-6 lg:pt-14">
        <NewsBreadcrumb title={news.title} />

        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative aspect-[31/20] w-full overflow-hidden rounded-4xl bg-neutral-100">
            {hasFeaturedImage ? (
              <Media
                fill
                priority
                resource={news.featuredImage}
                size="(min-width: 1024px) 620px, 100vw"
                pictureClassName="absolute inset-0 block"
                imgClassName="object-cover"
              />
            ) : (
              <Image
                src="/figma/news/news-1.png"
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 620px, 100vw"
                className="object-cover"
              />
            )}
          </div>

          <header className="flex flex-col items-start gap-8 text-right lg:px-12">
            <Typography as="h1" variant="32/bold" lg="48/bold" color="neutral-800">
              {news.title}
            </Typography>
            <dl className="flex flex-col gap-4 text-neutral-500">
              <div className="flex items-center gap-2">
                <Image src="/figma/newspage/calender.svg" alt="" width={28} height={28} />
                <dt className="sr-only">تاریخ انتشار</dt>
                <Typography as="dd" variant="16/regular" color="neutral-500">
                  {persianDateFormatter.format(new Date(publishedAt))}
                </Typography>
              </div>
              <div className="flex items-center gap-2">
                <Image src="/figma/newspage/time.svg" alt="" width={28} height={28} />
                <dt className="sr-only">زمان مطالعه</dt>
                <Typography as="dd" variant="16/regular" color="neutral-500">
                  زمان مطالعه {readingMinutes.toLocaleString('fa-IR')} دقیقه
                </Typography>
              </div>
            </dl>
          </header>
        </div>

        <RichText
          data={news.content}
          enableGutter={false}
          enableProse={false}
          className="w-full text-right [&_a]:text-brand-500 [&_h2]:mt-20 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:leading-10 [&_h2]:font-bold [&_h2]:text-neutral-600 lg:[&_h2]:text-[32px] lg:[&_h2]:leading-12.5 [&_h3]:mt-12 [&_h3]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-neutral-600 [&_img]:my-20 [&_img]:w-full [&_img]:rounded-4xl [&_li]:text-base [&_li]:leading-8 [&_li]:text-neutral-500 lg:[&_li]:text-xl [&_p]:mb-4 [&_p]:text-base [&_p]:leading-8 [&_p]:font-normal [&_p]:text-neutral-500 lg:[&_p]:text-xl"
        />
      </article>

      <RecruitmentSection />
      <div className="h-40" aria-hidden="true" />
    </main>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const news = await queryNewsBySlug(decodeURIComponent(slug))

  if (!news) return { title: 'خبر پیدا نشد' }

  const image = typeof news.featuredImage === 'object' ? news.featuredImage?.url : undefined

  return {
    title: news.title,
    description: news.excerpt || undefined,
    openGraph: image ? { images: [{ url: image }] } : undefined,
  }
}
