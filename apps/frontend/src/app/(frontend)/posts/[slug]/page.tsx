import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import Image from 'next/image'
import { getPayload } from 'payload'
import { cache } from 'react'
import { NewsCalendarIcon, NewsTimeIcon } from '@/components/icons'
import NewsCard from '@/components/landing/home/news-card'
import RecruitmentSection from '@/components/landing/home/recruitment-section'
import { NewsBreadcrumb } from '@/components/landing/news/news-page-header'
import { StoryLead } from '@/components/landing/news/story-lead'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { Media } from '@/components/Media'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import RichText from '@/components/RichText'
import { Typography } from '@/components/ui/typography'
import { buildSafe } from '@/utilities/buildSafe'
import { formatAuthors } from '@/utilities/formatAuthors'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'

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

export async function generateStaticParams() {
  const posts = await buildSafe('post slug params', async () => {
    const payload = await getPayload({ config: configPromise })
    return payload.find({
      collection: 'posts',
      draft: false,
      limit: 1000,
      overrideAccess: false,
      pagination: false,
      select: {
        slug: true,
      },
    })
  })

  const params = posts?.docs.map(({ slug }) => {
    return { slug }
  })

  return params ?? []
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Post({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/posts/' + decodedSlug
  const post = await queryPostBySlug({ slug: decodedSlug })

  if (!post) return <PayloadRedirects url={url} />

  const publishedAt = post.publishedAt || post.createdAt
  const readingMinutes =
    post.readingMinutes || Math.max(1, Math.ceil(countTextWords(post.content) / 200))
  const hasHeroImage = typeof post.heroImage === 'object' && post.heroImage !== null
  const categories =
    post.categories?.flatMap((category) =>
      typeof category === 'object' && category.title ? [category.title] : [],
    ) ?? []
  const authors = post.populatedAuthors ? formatAuthors(post.populatedAuthors) : ''

  return (
    <main className="overflow-x-clip bg-white">
      <PageClient />

      {/* Allows redirects for valid posts too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <article className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-25 pb-20 sm:px-6 lg:gap-10 lg:pt-30">
        <NewsBreadcrumb title={post.title} section="مقالات" sectionHref="/posts" />

        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="relative aspect-31/20 w-full overflow-hidden rounded-4xl bg-neutral-100">
            {hasHeroImage ? (
              <Media
                fill
                priority
                resource={post.heroImage}
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

          <header className="flex h-full w-full flex-1 flex-col gap-4 text-right">
            <Typography as="h1" variant="20/bold" lg="32/extrabold" color="neutral-800">
              {post.title}
            </Typography>
            <dl className="flex flex-col gap-4 text-neutral-500">
              <div className="flex items-center gap-2">
                <NewsCalendarIcon aria-hidden="true" className="size-7 shrink-0 text-neutral-400" />
                <dt className="sr-only">تاریخ انتشار</dt>
                <Typography as="dd" variant="16/regular" color="neutral-500">
                  {persianDateFormatter.format(new Date(publishedAt))}
                </Typography>
              </div>
              <div className="flex items-center gap-2">
                <NewsTimeIcon aria-hidden="true" className="size-7 shrink-0 text-neutral-400" />
                <dt className="sr-only">زمان مطالعه</dt>
                <Typography as="dd" variant="16/regular" color="neutral-500">
                  زمان مطالعه {readingMinutes.toLocaleString('fa-IR')} دقیقه
                </Typography>
              </div>
              {categories.length > 0 && (
                <div>
                  <dt className="sr-only">دسته‌بندی</dt>
                  <Typography as="dd" variant="16/regular" color="neutral-500">
                    {categories.join('، ')}
                  </Typography>
                </div>
              )}
              {authors && (
                <div>
                  <dt className="sr-only">نویسنده</dt>
                  <Typography as="dd" variant="16/regular" color="neutral-500">
                    {authors}
                  </Typography>
                </div>
              )}
            </dl>
            <StoryLead excerpt={post.excerpt} />
          </header>
        </div>

        <RichText
          data={post.content}
          enableGutter={false}
          enableProse={false}
          className="w-full text-right [&_a]:text-brand-500 [&_h2]:mt-20 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:leading-10 [&_h2]:font-bold [&_h2]:text-neutral-600 lg:[&_h2]:text-[32px] lg:[&_h2]:leading-12.5 [&_h3]:mt-12 [&_h3]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-neutral-600 [&_img]:my-20 [&_img]:w-full [&_img]:rounded-4xl [&_li]:text-base [&_li]:leading-8 [&_li]:text-neutral-500 lg:[&_li]:text-xl [&_p]:mb-4 [&_p]:text-base [&_p]:leading-8 [&_p]:font-normal [&_p]:text-neutral-500 lg:[&_p]:text-xl"
        />
        {post.relatedPosts && post.relatedPosts.length > 0 && (
          <section className="mt-12 w-full text-right">
            <Typography as="h2" variant="24/bold" color="neutral-800" className="mb-5">
              مقالات مرتبط
            </Typography>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {post.relatedPosts
                .filter(
                  (item) => typeof item === 'object' && (draft || item._status === 'published'),
                )
                .map(
                  (item) =>
                    typeof item === 'object' && (
                      <NewsCard key={item.id} news={item} variant="listing" relationTo="posts" />
                    ),
                )}
            </div>
          </section>
        )}
      </article>

      <RecruitmentSection />
      <div className="h-40" aria-hidden="true" />
    </main>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const post = await queryPostBySlug({ slug: decodedSlug })

  return generateMeta({ doc: post, path: `/posts/${decodedSlug}` })
}

const queryPostBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'posts',
    depth: 2,
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
