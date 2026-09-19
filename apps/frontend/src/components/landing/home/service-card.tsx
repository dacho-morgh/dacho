import { Typography } from '@/components/ui/typography'

export type ServiceCardData = {
  title: string
  description: string
}

const ServiceVisual = ({ variant }: { variant: number }) => {
  const shared = 'relative h-40 w-full overflow-hidden rounded-2xl bg-brand-50 sm:h-48 xl:h-44'

  switch (variant % 5) {
    case 0:
      return (
        <div aria-hidden="true" className={shared}>
          <div className="absolute top-1/2 left-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-200 sm:size-56" />
          <div className="absolute top-1/2 left-1/2 size-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-[16px] border-brand-300 sm:size-40" />
          <div className="absolute top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600 shadow-lg sm:size-20" />
          <div className="absolute top-7 right-1/4 size-8 rounded-full bg-secondary-500" />
        </div>
      )
    case 1:
      return (
        <div aria-hidden="true" className={shared}>
          <div className="absolute inset-x-[15%] top-8 bottom-[-30px] rotate-[-8deg] rounded-2xl border border-brand-200 bg-white shadow-lg" />
          <div className="absolute inset-x-[22%] top-5 bottom-[-36px] rotate-[7deg] rounded-2xl border border-brand-200 bg-brand-100 shadow-lg" />
          <div className="absolute inset-x-[28%] top-11 bottom-[-44px] rounded-2xl bg-brand-600 p-5 shadow-lg">
            <div className="h-3 w-1/2 rounded-full bg-secondary-400" />
            <div className="mt-5 h-2 w-full rounded-full bg-white/70" />
            <div className="mt-3 h-2 w-3/4 rounded-full bg-white/70" />
          </div>
        </div>
      )
    case 2:
      return (
        <div aria-hidden="true" className={shared}>
          <div className="absolute top-1/2 left-1/2 h-28 w-56 -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] rounded-2xl border border-brand-300 bg-white shadow-lg sm:w-64" />
          <div className="absolute top-1/2 left-1/2 h-28 w-56 -translate-x-1/2 -translate-y-1/2 rotate-[8deg] rounded-2xl bg-brand-200 shadow-lg sm:w-64" />
          <div className="absolute top-1/2 left-1/2 flex h-28 w-56 -translate-x-1/2 -translate-y-1/2 flex-col justify-center gap-3 rounded-2xl bg-brand-700 px-7 shadow-lg sm:w-64">
            <div className="h-3 w-2/3 rounded-full bg-secondary-400" />
            <div className="h-2 w-full rounded-full bg-white/70" />
            <div className="h-2 w-4/5 rounded-full bg-white/70" />
          </div>
        </div>
      )
    case 3:
      return (
        <div aria-hidden="true" className={shared}>
          <div className="absolute inset-x-[18%] bottom-0 flex h-36 items-end justify-center gap-3 sm:gap-5">
            <div className="h-1/3 w-1/5 rounded-t-xl bg-brand-200" />
            <div className="h-1/2 w-1/5 rounded-t-xl bg-brand-300" />
            <div className="h-3/4 w-1/5 rounded-t-xl bg-brand-500" />
            <div className="h-full w-1/5 rounded-t-xl bg-brand-700" />
          </div>
          <div className="absolute top-6 right-[22%] size-9 rounded-full bg-secondary-500 shadow-md" />
        </div>
      )
    default:
      return (
        <div aria-hidden="true" className={shared}>
          <div className="absolute top-1/2 left-1/2 size-32 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-3xl border-[18px] border-brand-300 sm:size-40" />
          <div className="absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-2xl bg-brand-700 shadow-lg sm:size-28" />
          <div className="absolute top-[22%] left-[27%] size-8 rounded-full bg-secondary-500" />
          <div className="absolute right-[25%] bottom-[20%] size-5 rounded-full bg-brand-400" />
        </div>
      )
  }
}

const ServiceCard = ({ service, index }: { service: ServiceCardData; index: number }) => (
  <article className="flex h-full min-w-0 flex-col gap-5 rounded-3xl bg-white p-5 text-right shadow-sm sm:p-6">
    <Typography as="h3" variant="20/bold" lg="24/bold" color="neutral-800" className="w-full">
      {service.title}
    </Typography>
    <ServiceVisual variant={index} />
    <Typography variant="16/regular" color="neutral-600" className="w-full">
      {service.description}
    </Typography>
  </article>
)

export default ServiceCard
