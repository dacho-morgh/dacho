import type { Service } from '@dacho/cms-core'
import Image from 'next/image'
import { Typography } from '@/components/ui/typography'
import { getMediaUrl } from '@/utilities/getMediaUrl'

export type ServiceCardData = Pick<Service, 'title' | 'excerpt' | 'featuredImage'>

const ServiceCard = ({ service }: { service: ServiceCardData }) => {
  const image =
    service.featuredImage && typeof service.featuredImage === 'object'
      ? service.featuredImage
      : null
  const imageUrl = image?.mimeType?.startsWith('image/')
    ? getMediaUrl(image.url, image.updatedAt)
    : ''

  return (
    <article className="flex h-full min-w-0 flex-col gap-5 rounded-3xl bg-white p-5 text-right shadow-sm sm:p-6">
      <Typography
        as="h3"
        variant="20/bold"
        lg="24/bold"
        color="neutral-800"
        className="w-full wrap-anywhere md:min-h-16 lg:min-h-18"
      >
        {service.title}
      </Typography>
      {imageUrl && (
        <div className="relative aspect-video max-h-56 w-full shrink-0 overflow-hidden rounded-2xl bg-brand-50">
          <Image
            src={imageUrl}
            alt={image?.alt || ''}
            fill
            sizes="(min-width: 1664px) 472px, (min-width: 1280px) calc((100vw - 248px) / 3), (min-width: 1024px) calc((100vw - 180px) / 2), (min-width: 768px) calc((100vw - 164px) / 2), (min-width: 640px) calc(100vw - 96px), calc(100vw - 72px)"
            className="object-contain"
            unoptimized={image?.mimeType === 'image/svg+xml'}
          />
        </div>
      )}
      {service.excerpt && (
        <Typography
          variant="16/regular"
          color="neutral-600"
          className="w-full wrap-anywhere whitespace-pre-line"
        >
          {service.excerpt}
        </Typography>
      )}
    </article>
  )
}

export default ServiceCard
