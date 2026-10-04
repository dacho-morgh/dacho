import type { News, Post } from '@dacho/cms-core'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpIcon } from '@/components/icons'
import { Media } from '@/components/Media'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export type NewsCardData = Pick<News | Post, 'heroImage' | 'slug' | 'title'>

export type EditorialCardData = {
  title: string
  image: string
  href?: string
  category: string
  time?: string
  excerpt?: string
  label?: string
  author?: string
  readingTime?: string
  date?: string
}

type NewsCardProps =
  | { news: NewsCardData; variant?: 'default' | 'listing'; relationTo?: 'news' | 'posts' }
  | { news: EditorialCardData; variant: 'mag-news' | 'mag-article' | 'mag-compact' }

const NewsCard = ({ news, variant, ...props }: NewsCardProps) => {
  const editorial = 'image' in news ? news : undefined
  const relationTo = 'relationTo' in props && props.relationTo === 'posts' ? 'posts' : 'news'
  const hasHeroImage =
    'heroImage' in news && typeof news.heroImage === 'object' && news.heroImage !== null
  const isArticle = variant === 'mag-article' || relationTo === 'posts'
  const href = editorial
    ? (editorial.href ?? (isArticle ? '/posts' : '/news'))
    : 'slug' in news && news.slug
      ? `/${relationTo}/${news.slug}`
      : `/${relationTo}`

  if (variant === 'mag-compact' && editorial) {
    return (
      <article className="min-w-0 border-b border-neutral-100 last:border-0">
        <Link href={href} className="flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-neutral-50">
          <div className="min-w-0 flex-1 text-right">
            <span className="inline-flex w-fit rounded-lg bg-neutral-100 px-2 py-1">
              <Typography as="span" variant="12/semibold" color="neutral-600">
                {editorial.category}
              </Typography>
            </span>
            <Typography
              as="h3"
              variant="14/semibold"
              color="neutral-800"
              className="mt-1 line-clamp-2 leading-5!"
            >
              {editorial.title}
            </Typography>
            {editorial.time && (
              <Typography as="span" variant="12/light" color="neutral-400" className="mt-1 block">
                {editorial.time}
              </Typography>
            )}
          </div>
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
            <Image src={editorial.image} alt="" fill sizes="64px" className="object-cover" />
          </div>
        </Link>
      </article>
    )
  }

  return (
    <article
      dir="rtl"
      className="group flex h-full w-full flex-col items-end overflow-hidden rounded-4xl bg-white drop-shadow-xl transition-all lg:drop-shadow-md"
    >
      <Link
        href={href}
        aria-label={news.title}
        className="relative h-50 w-full shrink-0 overflow-hidden rounded-t-3xl 8xl:h-65"
      >
        {editorial ? (
          <Image
            src={editorial.image}
            alt=""
            fill
            sizes="(min-width: 1280px) 416px, (min-width: 768px) 50vw, 100vw"
            className="pointer-events-none object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : hasHeroImage ? (
          <Media
            fill
            resource={news.heroImage}
            size="(min-width: 1280px) 416px, (min-width: 768px) 50vw, 100vw"
            pictureClassName="absolute inset-0 block"
            imgClassName="pointer-events-none object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <Image
            src="/figma/news/news-1.png"
            alt=""
            fill
            sizes="(min-width: 1280px) 416px, (min-width: 768px) 50vw, 100vw"
            className="pointer-events-none object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {editorial?.label && (
          <span className="absolute top-3 right-3 rounded-lg bg-white/90 px-2 py-1 backdrop-blur">
            <Typography as="span" variant="12/semibold" color="neutral-700">
              {editorial.label}
            </Typography>
          </span>
        )}
      </Link>

      <div className="flex h-full w-full flex-col justify-between gap-4 p-5">
        {editorial && (
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex w-fit rounded-lg bg-neutral-100 px-2 py-1">
              <Typography as="span" variant="12/semibold" color="neutral-600">
                {editorial.category}
              </Typography>
            </span>
            {editorial.time && (
              <Typography as="span" variant="12/light" color="neutral-400">
                {editorial.time}
              </Typography>
            )}
          </div>
        )}
        <Typography
          as="h3"
          variant="16/semibold"
          color="neutral-900"
          title={news.title}
          className="w-full text-right"
        >
          <Link href={href}>{news.title}</Link>
        </Typography>
        {editorial?.excerpt && (
          <Typography
            variant="14/regular"
            color="neutral-500"
            className="line-clamp-2 w-full text-right"
          >
            {editorial.excerpt}
          </Typography>
        )}
        {isArticle && editorial && (
          <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
            {[editorial.readingTime, editorial.author, editorial.date]
              .filter(Boolean)
              .map((detail, index) => (
                <span key={detail} className="flex items-center gap-2">
                  {index > 0 && (
                    <span aria-hidden="true" className="text-neutral-300">
                      •
                    </span>
                  )}
                  <Typography as="span" variant="12/light" color="neutral-400">
                    {detail}
                  </Typography>
                </span>
              ))}
          </div>
        )}
        <Button
          asChild
          variant="ghost"
          className="h-8 self-start rounded-[10px] px-1.5 py-2 transition-colors hover:bg-neutral-200"
        >
          <Link
            href={href}
            aria-label={`${isArticle ? 'مطالعه مقاله' : 'مطالعه خبر'}: ${news.title}`}
            className="flex items-center gap-1"
          >
            <Typography as="span" variant="14/regular" color="neutral-600">
              {isArticle ? 'مطالعه مقاله' : 'مطالعه خبر'}
            </Typography>
            <ArrowUpIcon className="size-5 -rotate-90 text-neutral-600" />
          </Link>
        </Button>
      </div>
    </article>
  )
}

export default NewsCard
