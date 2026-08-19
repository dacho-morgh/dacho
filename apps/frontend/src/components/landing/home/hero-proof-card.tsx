import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

type HeroProofCardProps = {
  metric: string
  message: string
  className?: string
}

const HeroProofCard = ({ metric, message, className }: HeroProofCardProps) => {
  return (
    <div
      dir="rtl"
      data-hero-proof
      className={cn(
        'absolute inset-0 flex items-center gap-0.5 rounded-[14px] border border-white bg-white/20 p-3 opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.1)] backdrop-blur-[15px] will-change-transform sm:gap-1 sm:rounded-[18px] sm:p-4 lg:rounded-[20px] lg:p-5',
        className,
      )}
    >
      <div className="flex items-center pl-2 sm:pl-3 lg:pl-4" aria-hidden="true">
        <span className="-ml-2.5 size-6 rounded-full border-2 border-white bg-linear-to-br from-brand-300 to-brand-700 sm:-ml-3.5 sm:size-8 lg:-ml-4 lg:size-9" />
        <span className="-ml-2.5 size-6 rounded-full border-2 border-white bg-linear-to-br from-amber-200 to-amber-600 sm:-ml-3.5 sm:size-8 lg:-ml-4 lg:size-9" />
        <span className="size-6 rounded-full border-2 border-white bg-linear-to-br from-neutral-300 to-neutral-700 sm:size-8 lg:size-9" />
      </div>
      <Typography
        variant="24/bold"
        color="neutral-600"
        className="text-[18px] leading-7 whitespace-nowrap sm:text-[20px] sm:leading-8 lg:text-[24px] lg:leading-9"
      >
        {metric}
      </Typography>
      <Typography
        variant="16/light"
        color="neutral-600"
        className="text-xs leading-5 whitespace-nowrap sm:text-sm sm:leading-6 lg:text-base lg:leading-7"
      >
        {message}
      </Typography>
    </div>
  )
}

export default HeroProofCard
