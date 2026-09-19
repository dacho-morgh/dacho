import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { Typography } from '@/components/ui/typography'
import { buildSafe } from '@/utilities/buildSafe'
import ServiceCard from './service-card'

const cardSpan = (index: number, total: number) => {
  if (total === 5) {
    return index === 4
      ? 'md:col-span-2 xl:col-span-3'
      : index === 3
        ? 'xl:col-span-3'
        : 'xl:col-span-2'
  }

  if (total === 4 || total === 2) return 'xl:col-span-3'
  if (total === 1) return 'md:col-span-2 xl:col-span-6'
  return 'xl:col-span-2'
}

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
    <section
      id="services"
      className="relative z-10 flex w-full flex-col items-center gap-10 bg-neutral-50 px-4 py-8 lg:px-0 lg:py-10"
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 text-right">
        <div className="mx-auto mb-10 flex w-full max-w-[1600px] flex-col gap-3 text-right md:mb-12">
          <div className="flex items-stretch gap-3">
            <span
              aria-hidden="true"
              className="my-2 w-1.5 shrink-0 rounded-full bg-secondary-500"
            />
            <Typography as="h2" variant="32/extrabold" sm="40/extrabold" color="neutral-600">
              ارائه خدمات
            </Typography>
          </div>
          <Typography
            variant="16/regular"
            sm="20/regular"
            color="neutral-500"
            className="max-w-5xl lg:ms-30 xl:ms-40 8xl:ms-0"
          >
            از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای
            یکپارچه مدیریت می‌شود.
          </Typography>
        </div>

        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-6">
          {services.map((service, index) => (
            <div key={service.id} className={cardSpan(index, services.length)}>
              <ServiceCard
                index={index}
                service={{ title: service.title, description: service.excerpt || '' }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ServicesSection
