import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { Typography } from '@/components/ui/typography'
import { buildSafe } from '@/utilities/buildSafe'
import ServiceCard from './service-card'
import { serviceCardClassName, servicesGridClassName } from './services-layout'

const ServicesSection = async () => {
  const services = await buildSafe('home services', async () => {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'services',
      depth: 1,
      limit: 0,
      pagination: false,
      overrideAccess: false,
      sort: ['_order', 'createdAt', 'id'],
    })
    return docs
  })

  if (!services || services.length === 0) return null

  return (
    <section
      id="services"
      className="relative z-10 w-full bg-neutral-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 text-right sm:gap-10">
        <div data-home-reveal className="flex min-w-0 flex-col gap-3 text-right">
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
            className="max-w-5xl"
          >
            از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای
            یکپارچه مدیریت می‌شود.
          </Typography>
        </div>

        <div className={servicesGridClassName}>
          {services.map((service, index) => (
            <div
              data-home-reveal
              key={service.id}
              className={serviceCardClassName(index, services.length)}
            >
              <ServiceCard service={service} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ServicesSection
