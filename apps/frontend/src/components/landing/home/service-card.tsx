import Image from 'next/image'
import { Typography } from '@/components/ui/typography'

export type ServiceCardData = {
  image: string
  title: string
  description: string
  crop: 'cover' | 'figma'
}

const ServiceCard = ({ service }: { service: ServiceCardData }) => {
  return (
    <article className="flex h-[420px] min-w-0 flex-col items-end gap-4 rounded-[40px] bg-white px-4 pt-4 pb-8 drop-shadow-xl lg:h-auto">
      <div className="relative h-60 w-full shrink-0 overflow-hidden rounded-3xl lg:h-80 lg:rounded-4xl">
        {service.crop === 'figma' ? (
          <Image
            src={service.image}
            alt=""
            width={735}
            height={978}
            className="pointer-events-none absolute top-[-67.92%] left-0 h-[190.63%] w-full max-w-none"
          />
        ) : (
          <Image
            src={service.image}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 40vw"
            className="pointer-events-none absolute inset-0 size-full max-w-none object-cover"
          />
        )}
      </div>

      <div className="flex w-full flex-col items-start gap-2 px-2 text-right">
        <Typography as="h3" variant="20/bold" color="neutral-800" className="w-full">
          {service.title}
        </Typography>
        <Typography
          variant="16/regular"
          color="neutral-500"
          className="line-clamp-2 w-full lg:line-clamp-none"
        >
          {service.description}
        </Typography>
      </div>
    </article>
  )
}

export default ServiceCard
