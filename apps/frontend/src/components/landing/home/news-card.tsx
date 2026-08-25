import type { News } from '@dacho/cms-core'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpIcon } from '@/components/icons'
import { Media } from '@/components/Media'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

export type NewsCardData = Pick<News, 'heroImage' | 'slug' | 'title'>

const NewsCard = ({
  news,
  variant = 'home',
}: {
  news: NewsCardData
  variant?: 'home' | 'listing'
}) => {
  const hasHeroImage = typeof news.heroImage === 'object' && news.heroImage !== null
  const href = news.slug ? `/news/${news.slug}` : '/news'

  return (
    <article
      dir="rtl"
      className={cn(
        'group flex w-full flex-col items-end overflow-hidden rounded-4xl bg-white transition-all',
        variant === 'home' && 'drop-shadow-xl lg:drop-shadow-lg',
      )}
    >
      <Link
        href={href}
        aria-label={news.title}
        className="relative h-50 w-full shrink-0 overflow-hidden rounded-t-3xl 8xl:h-65"
      >
        {hasHeroImage ? (
          <Media
            fill
            resource={news.heroImage}
            size="(min-width: 1280px) 416px, (min-width: 768px) 50vw, 100vw"
            pictureClassName="absolute inset-0 block"
            imgClassName="pointer-events-none object-cover group-hover:scale-105 transition-transform duration-300"
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
      </Link>

      <div className="flex w-full flex-col items-end gap-4 p-5">
        <Typography
          as="h3"
          variant="16/semibold"
          color="neutral-900"
          title={news.title}
          className="w-full truncate text-right"
        >
          <Link href={href}>{news.title}</Link>
        </Typography>
        <Button
          variant="ghost"
          className="group h-8 self-start rounded-[10px] px-1.5 py-2 transition-colors hover:bg-[#E5E5E5]"
        >
          <Link href={href} className="flex items-center gap-1">
            <Typography as="span" variant="14/regular" color="neutral-600">
              مطالعه خبر
            </Typography>
            <ArrowUpIcon className="size-5 -rotate-90 text-[#525252]" />
          </Link>
        </Button>
      </div>
    </article>
  )
}

export default NewsCard
