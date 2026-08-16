import Image from 'next/image'
import ArrowUpIcon from '@/components/icons/arrow-up-icon'
import { Media } from '@/components/Media'
import { Button } from '@/components/ui/button'
import type { News } from '@dacho/cms-core'

export type NewsCardData = Pick<News, 'featuredImage' | 'title'>

const NewsCard = ({ news }: { news: NewsCardData }) => {
  const hasFeaturedImage = typeof news.featuredImage === 'object' && news.featuredImage !== null

  return (
    <article
      dir="rtl"
      className="group flex w-full flex-col items-end overflow-hidden rounded-4xl bg-white transition-all md:max-w-104"
    >
      <div className="relative h-50 w-full shrink-0 overflow-hidden rounded-t-3xl">
        {hasFeaturedImage ? (
          <Media
            fill
            resource={news.featuredImage}
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
            className="pointer-events-none object-cover"
          />
        )}
      </div>

      <div className="flex w-full flex-col items-end gap-4 p-5">
        <h3
          title={news.title}
          className="w-full truncate text-right text-base leading-7 font-semibold text-[#262626]"
        >
          {news.title}
        </h3>
        <Button
          variant="ghost"
          className="group h-8 self-start rounded-[10px] px-1.5 py-2 text-sm leading-6 font-normal text-[#525252] transition-colors hover:bg-[#E5E5E5]"
        >
          مطالعه خبر
          <ArrowUpIcon className="-rotate-90" />
        </Button>
      </div>
    </article>
  )
}

export default NewsCard
