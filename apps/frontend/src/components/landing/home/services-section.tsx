import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { ArrowLeftIcon } from '@/components/icons'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { Typography } from '@/components/ui/typography'
import { buildSafe } from '@/utilities/buildSafe'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import ServiceCard from './service-card'

const ServicesSection = async () => {
  const services = await buildSafe('home services', async () => {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'services',
      depth: 1,
      limit: 5,
      overrideAccess: false,
      sort: 'createdAt',
    })
    return docs
  })

  if (!services || services.length === 0) return null

  return (
    <section className="flex w-full flex-col items-center gap-6 overflow-x-clip py-16 md:py-24 lg:py-28 2xl:py-32">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 text-right">
        <div className="flex items-stretch gap-2 lg:ms-30 xl:ms-40 8xl:ms-0">
          <div className="my-2 w-1 rounded-full bg-[#FAB622] lg:my-3 lg:w-2" />
          <Typography as="h2" variant="32/extrabold" sm="40/extrabold" color="neutral-600">
            ارائه خدمات
          </Typography>
        </div>
        <Typography
          variant="16/light"
          sm="20/regular"
          color="neutral-500"
          className="max-w-5xl lg:ms-30 xl:ms-40 8xl:ms-0"
        >
          از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه
          مدیریت می‌شود.
        </Typography>
      </div>
      <Carousel opts={{ align: 'start', direction: 'rtl' }} className="mx-auto w-full">
        <CarouselContent className="mx-8 py-4 md:mx-0 md:ms-20 lg:ms-30 lg:me-4 xl:ms-40">
          {services.map((service, index) => {
            const featuredImage =
              typeof service.featuredImage === 'object' ? service.featuredImage : null
            const isFigmaCrop = featuredImage?.filename?.startsWith('service-2')

            return (
              <CarouselItem key={service.id} className="pl-5 md:basis-1/2 lg:basis-lg">
                <ServiceCard
                  service={{
                    image:
                      getMediaUrl(featuredImage?.url, featuredImage?.updatedAt) ||
                      `/figma/services/service-${(index % 3) + 1}.png`,
                    title: service.title,
                    description: service.excerpt || '',
                    crop: isFigmaCrop ? 'figma' : 'cover',
                  }}
                />
              </CarouselItem>
            )
          })}
        </CarouselContent>

        <div className="mt-6 flex items-start gap-2 ps-8 md:ps-20 lg:ps-30 xl:ps-40">
          <CarouselPrevious
            variant="ghost"
            size="icon"
            aria-label="خدمت قبلی"
            className="static h-12 w-12 translate-0 rounded-xl bg-brand-500 p-0 text-white hover:bg-brand-600 hover:text-white disabled:bg-neutral-200 disabled:text-neutral-300"
          >
            <ArrowLeftIcon className="h-6.5 w-6.5 rotate-180" />
          </CarouselPrevious>
          <CarouselNext
            variant="ghost"
            size="icon"
            aria-label="خدمت بعدی"
            className="static h-12 w-12 translate-0 rounded-xl bg-brand-500 p-0 text-white hover:bg-brand-600 hover:text-white disabled:bg-neutral-200 disabled:text-neutral-300"
          >
            <ArrowLeftIcon className="h-6.5 w-6.5" />
          </CarouselNext>
        </div>
      </Carousel>
    </section>
  )
}

export default ServicesSection
