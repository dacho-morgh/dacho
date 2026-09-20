import Image from 'next/image'
import Link from 'next/link'
import { Fragment } from 'react'
import NewsCard from '@/components/landing/home/news-card'
import RecruitmentSection from '@/components/landing/home/recruitment-section'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'
import type { MagData, MagStory } from './data'
import { NewsletterForm } from './newsletter-form'

function StoryImage({ story }: { story: MagStory }) {
  return (
    <Image
      src={story.image}
      alt=""
      fill
      sizes="(min-width: 1024px) 800px, 100vw"
      className="object-cover"
    />
  )
}

function Heading({
  title,
  id,
  href,
  linkText,
}: {
  title: string
  id?: string
  href?: string
  linkText?: string
}) {
  return (
    <div id={id} className="flex min-h-18 scroll-mt-24 items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-12 w-2 shrink-0 rounded-lg bg-secondary-500" />
        <Typography
          as="h2"
          variant="32/extrabold"
          color="neutral-800"
          className="text-[26px]! leading-9! sm:text-[30px]!"
        >
          {title}
        </Typography>
      </div>
      {href && linkText && (
        <Button asChild variant="text" size="clear" className="text-brand-500 hover:bg-transparent">
          <Link href={href}>
            <Typography as="span" variant="14/semibold" color="primary">
              {linkText} ←
            </Typography>
          </Link>
        </Button>
      )}
    </div>
  )
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn(`inline-flex w-fit rounded-lg bg-neutral-100 px-2 py-1`, className)}>
      <Typography as="span" variant="12/semibold" color="neutral-600">
        {label}
      </Typography>
    </span>
  )
}

function Hero({ data }: { data: MagData }) {
  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pt-4 pb-12" aria-label="خبر ویژه">
      <div className="grid gap-5 lg:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
        <aside className="order-2 lg:order-1">
          <Heading title="انتخاب سردبیر" />
          <div className="flex flex-col gap-4">
            {data.editorPicks.slice(0, 5).map((story) => (
              <div key={story.id} className="overflow-hidden rounded-3xl bg-white shadow-md">
                <NewsCard news={story} variant="mag-compact" />
              </div>
            ))}
          </div>
        </aside>
        {data.hero && (
          <article className="relative order-1 min-h-112 overflow-hidden rounded-[32px] lg:order-2 lg:h-full">
            <StoryImage story={data.hero} />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-neutral-900/90 via-neutral-900/45 to-transparent"
            />
            <div className="absolute inset-x-4 bottom-4 flex flex-col items-start gap-3 rounded-3xl border border-white/20 bg-neutral-900/35 p-5 text-right shadow-lg backdrop-blur-sm sm:right-8 sm:bottom-8 sm:left-auto sm:w-[calc(100%-4rem)] sm:max-w-2xl sm:p-8">
              <Badge className="hidden md:inline-flex" label={data.hero.category} />
              <Typography
                as="h1"
                lg="40/extrabold"
                variant="20/extrabold"
                color="white"
                className="max-w-xl"
              >
                {data.hero.title}
              </Typography>
              <Typography variant="16/regular" color="white" className="max-w-lg text-white/80!">
                {data.hero.excerpt}
              </Typography>
              <Typography
                className="hidden md:inline-flex"
                as="span"
                variant="14/light"
                color="white"
              >
                {data.hero.author} • {data.hero.readingTime} • {data.hero.time}
              </Typography>
              <Button
                asChild
                variant="text-white"
                size="36"
                className="mt-1 gap-2 border-transparent bg-white/20 px-4 backdrop-blur hover:bg-white/30"
              >
                <Link href={data.hero.href}>
                  <Typography as="span" variant="14/semibold" color="white">
                    مطالعه بیشتر ←
                  </Typography>
                </Link>
              </Button>
            </div>
          </article>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Typography as="span" variant="14/semibold" color="neutral-500" className="ml-1">
          موضوعات داغ:
        </Typography>
        {data.hotHashtags.map((tag) => (
          <Button key={tag} asChild variant="gray" size="xs" className="h-7 rounded-lg px-3">
            <Link href={`/mag?hashrag=${encodeURIComponent(tag)}`}>
              <Typography as="span" variant="12/regular" color="neutral-600">
                #{tag}
              </Typography>
            </Link>
          </Button>
        ))}
      </div>
    </section>
  )
}

function Grid({
  title,
  id,
  stories,
  article = false,
  href,
  linkText,
}: {
  title: string
  id: string
  stories: MagStory[]
  article?: boolean
  href?: string
  linkText?: string
}) {
  if (!stories.length) return null
  return (
    <section className={article ? 'py-12' : 'bg-neutral-50 py-12'}>
      <div className="mx-auto max-w-[1600px] px-4">
        <Heading title={title} id={id} href={href} linkText={linkText} />
        <div
          className={`mt-6 grid gap-5 ${article ? 'md:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}
        >
          {stories.map((story) => (
            <NewsCard key={story.id} news={story} variant={article ? 'mag-article' : 'mag-news'} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CategorySection({
  title,
  id,
  featured,
  stories,
  hashtag,
  reverse = false,
}: {
  title: string
  id: string
  featured?: MagStory
  stories: MagStory[]
  hashtag?: string
  reverse?: boolean
}) {
  if (!featured) return null
  return (
    <section className="py-10">
      <div className="mx-auto max-w-[1600px] px-4">
        <Heading
          title={title}
          id={id}
          href={hashtag ? `/mag?hashrag=${encodeURIComponent(hashtag)}` : undefined}
          linkText={hashtag ? 'مشاهده همه' : undefined}
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <Link
            href={featured.href}
            className={`overflow-hidden rounded-[32px] bg-white shadow-md lg:col-span-2 ${reverse ? 'lg:order-2' : ''}`}
          >
            <div className="relative h-72 sm:h-120">
              <StoryImage story={featured} />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-neutral-900/60 to-transparent"
              />
              <div className="absolute right-4 bottom-4">
                <Badge className="hidden md:inline-flex" label={featured.category} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 p-5">
              <div className="min-w-0">
                <Typography as="h3" variant="20/bold" color="neutral-800" className="line-clamp-1">
                  {featured.title}
                </Typography>
                <Typography as="span" variant="12/light" color="neutral-400">
                  {featured.time}
                </Typography>
              </div>
              <Typography as="span" variant="14/semibold" color="neutral-600">
                {featured.href.startsWith('/posts/') ? 'مطالعه مقاله' : 'مطالعه خبر'} ←
              </Typography>
            </div>
          </Link>
          <div className={`flex flex-col gap-4 ${reverse ? 'lg:order-1' : ''}`}>
            {stories.map((story) => (
              <div key={story.id} className="overflow-hidden rounded-3xl bg-white shadow-md">
                <NewsCard news={story} variant="mag-compact" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FeaturedReport({ story }: { story?: MagStory }) {
  if (!story) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-8" aria-label="گزارش ویژه">
      <div className="relative flex min-h-80 flex-col items-start justify-center gap-4 overflow-hidden rounded-[32px] p-6 sm:p-10">
        <StoryImage story={story} />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-l from-neutral-900/85 via-neutral-900/60 to-transparent"
        />
        <div className="relative rounded-lg bg-secondary-500 px-4 py-1">
          <Typography as="span" variant="14/semibold" color="neutral-800">
            گزارش ویژه
          </Typography>
        </div>
        <Typography
          as="h2"
          variant="32/extrabold"
          color="white"
          className="relative max-w-xl text-[28px]! leading-10! sm:text-[36px]!"
        >
          {story.title}
        </Typography>
        <Typography variant="16/regular" color="white" className="relative max-w-lg text-white/80!">
          {story.excerpt}
        </Typography>
        <Button
          asChild
          variant="gray"
          size="48"
          className="relative mt-1 bg-secondary-500 px-6 text-neutral-800 hover:bg-secondary-400"
        >
          <Link href={story.href}>
            <Typography as="span" variant="16/semibold" color="neutral-800">
              مطالعه گزارش ←
            </Typography>
          </Link>
        </Button>
      </div>
    </section>
  )
}

export default function MagPage({ data }: { data: MagData }) {
  return (
    <main dir="rtl" className="overflow-x-clip bg-white pt-24 pb-16">
      <Hero data={data} />
      {data.hashtag && (
        <section className="mx-auto max-w-[1600px] px-4 pb-12">
          <Heading title={`نتایج #${data.hashtag}`} id="hashtag-results" />
          <Typography variant="14/regular" color="neutral-500">
            {data.matches.length} مطلب پیدا شد
          </Typography>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.matches.map((story) => (
              <NewsCard
                key={story.id}
                news={story}
                variant={story.href.startsWith('/posts/') ? 'mag-article' : 'mag-news'}
              />
            ))}
          </div>
        </section>
      )}
      <Grid
        title="آخرین اخبار"
        id="latest-news"
        href="/news"
        linkText="مشاهده همه اخبار"
        stories={data.latestNews}
      />
      <Grid
        title="آخرین مقالات"
        id="articles"
        href="/posts"
        linkText="مشاهده همه مقالات"
        stories={data.articles}
        article
      />
      {data.sections.map((section, index) => (
        <Fragment key={section.id}>
          <CategorySection
            title={section.title}
            id={`mag-section-${section.id}`}
            featured={section.featured}
            stories={section.stories}
            hashtag={section.hashtag}
            reverse={section.reverseLayout}
          />
          {index === 0 && data.showRecruitment && (
            <div className="mx-auto max-w-7xl py-5">
              <RecruitmentSection variant="gold" />
            </div>
          )}
        </Fragment>
      ))}
      {data.sections.length === 0 && data.showRecruitment && (
        <div className="mx-auto max-w-7xl py-5">
          <RecruitmentSection variant="gold" />
        </div>
      )}
      {/* {data.mostRead.length > 0 && (
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-7xl px-4">
            <Heading title="پربازدیدترین‌ها" id="most-read" />
            <div className="mt-6 overflow-hidden rounded-3xl bg-white">
              {data.mostRead.map((story, index) => (
                <Link
                  href={story.href}
                  key={story.id}
                  className="flex items-center gap-4 border-b border-neutral-100 p-5 last:border-0 hover:bg-neutral-50"
                >
                  <Typography
                    as="span"
                    variant="24/bold"
                    color="neutral-300"
                    className="w-10 shrink-0 text-center"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                  <div className="min-w-0 flex-1">
                    <Typography
                      as="h3"
                      variant="16/semibold"
                      color="neutral-800"
                      className="line-clamp-1"
                    >
                      {story.title}
                    </Typography>
                    <Typography as="span" variant="12/light" color="neutral-400">
                      {story.category}
                    </Typography>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )} */}

      {data.eventNews.length > 0 && (
        <section className="py-12">
          <div className="mx-auto max-w-[1600px] px-4">
            <Heading
              title="اخبار رویدادها"
              href="/events"
              linkText="مشاهده همه رویدادها"
              id="event-news"
            />
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {data.eventNews.map((story) => (
                <NewsCard key={story.id} news={story} variant="mag-news" />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
