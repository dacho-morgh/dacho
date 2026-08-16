import configPromise from '@payload-config'
import Image from 'next/image'
import { getPayload } from 'payload'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import ServiceCard from './service-card'

const ServicesSection = async () => {
  const payload = await getPayload({ config: configPromise })
  const { docs: services } = await payload.find({
    collection: 'services',
    depth: 1,
    limit: 5,
    overrideAccess: false,
    sort: 'createdAt',
  })

  if (services.length === 0) return null

  return (
    <section
      dir="rtl"
      className="flex w-full flex-col items-center gap-6 overflow-x-hidden py-24 sm:py-32 lg:py-40"
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 text-right">
        <h2 className="text-[32px] leading-12 font-bold text-[#525252] sm:text-[40px] sm:leading-16">
          ارئه خدمات
        </h2>
        <p className="max-w-5xl text-base leading-7 text-[#737373] sm:text-xl sm:leading-8">
          از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه
          مدیریت می‌شود.
        </p>
      </div>
      <Carousel opts={{ align: 'start', direction: 'rtl' }} className="mx-auto w-full">
        <CarouselContent className="mx-8 py-4 md:mx-0 md:ms-20 lg:ms-30 xl:ms-40">
          {services.map((service, index) => {
            const featuredImage =
              typeof service.featuredImage === 'object' ? service.featuredImage : null
            const isFigmaCrop = featuredImage?.filename?.startsWith('service-2')

            return (
              <CarouselItem key={service.id} className="pl-5 md:basis-1/2 xl:basis-[30%]">
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
            className="static h-12 w-12 translate-0 rounded-xl bg-[#F5F5F5] p-0 hover:bg-[#E5E5E5]"
          >
            <Image
              src="/figma/services/arrow-left.svg"
              alt=""
              width={26}
              height={26}
              className="pointer-events-none h-6.5 w-6.5 rotate-180"
            />
          </CarouselPrevious>
          <CarouselNext
            variant="ghost"
            size="icon"
            aria-label="خدمت بعدی"
            className="static h-12 w-12 translate-0 rounded-xl bg-[#F5F5F5] p-0 hover:bg-[#E5E5E5]"
          >
            <Image
              src="/figma/services/arrow-left.svg"
              alt=""
              width={26}
              height={26}
              className="pointer-events-none h-6.5 w-6.5"
            />
          </CarouselNext>
        </div>
      </Carousel>
    </section>
  )
}

export default ServicesSection
