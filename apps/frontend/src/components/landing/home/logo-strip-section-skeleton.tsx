import { Skeleton } from '@/components/ui/skeleton'

const logoWidths = [
  'w-24',
  'w-16',
  'w-20',
  'w-28',
  'w-32',
  'w-20',
  'w-24',
  'w-16',
  'w-32',
  'w-20',
  'w-24',
  'w-16',
]

const LogoBlock = ({ width }: { width: string }) => (
  <div
    aria-hidden="true"
    className={`flex h-20 shrink-0 items-center justify-center sm:h-24 ${width}`}
  >
    <Skeleton className="h-10 w-full rounded-lg bg-neutral-200" />
  </div>
)

const LogoStripSectionSkeleton = () => (
  <section
    aria-label="در حال بارگذاری لوگوها"
    className="relative z-10 w-full overflow-x-hidden py-8"
  >
    <div dir="ltr" className="flex w-max gap-20 pe-20">
      {logoWidths.map((width) => (
        <LogoBlock key={width} width={width} />
      ))}
    </div>
  </section>
)

export default LogoStripSectionSkeleton
