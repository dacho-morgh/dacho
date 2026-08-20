import type { Media } from '@dacho/cms-core'
import Image from 'next/image'
import type React from 'react'
import ArrowUpIcon from '@/components/icons/arrow-up-icon'
import { Media as MediaComponent } from '@/components/Media'
import { Button } from '@/components/ui/button'

export type EventCardData = {
  id: string
  featuredImage?: number | Media | null
  fallbackImage: string
  tag: string
  title: string
  description: string
  date: string
  location: string
  countdown: string
  countdownLabel: string
}

type EventCardProps = {
  event: EventCardData
  hasNavigation: boolean
  onNext: () => void
  onPrevious: () => void
}

const EventMeta = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div dir="ltr" className="flex w-full items-center justify-end gap-2">
    <p className="min-w-0 flex-1 text-right text-base leading-7 font-normal text-[#525252]">
      {children}
    </p>
    <Image
      src={icon}
      alt=""
      width={28}
      height={28}
      className="pointer-events-none size-7 shrink-0"
    />
  </div>
)

const EventCard = ({ event, hasNavigation, onNext, onPrevious }: EventCardProps) => {
  const hasFeaturedImage = typeof event.featuredImage === 'object' && event.featuredImage !== null

  return (
    <article className="flex min-h-140 w-full flex-col items-stretch gap-8 rounded-[40px] bg-white p-5 shadow-[0_0_40px_0_rgba(10,10,10,0.1)] sm:p-8 lg:min-h-160 lg:flex-row lg:gap-10 lg:rounded-[80px] lg:p-10">
      <div className="relative min-h-80 w-full shrink-0 overflow-hidden rounded-[28px] p-5 sm:min-h-110 lg:h-140 lg:w-160 lg:rounded-[40px]">
        {hasFeaturedImage ? (
          <MediaComponent
            fill
            resource={event.featuredImage}
            size="(min-width: 1024px) 640px, 100vw"
            pictureClassName="absolute inset-0 block"
            imgClassName="pointer-events-none object-cover"
          />
        ) : (
          <Image
            src={event.fallbackImage}
            alt=""
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            className="pointer-events-none object-cover"
          />
        )}

        <div className="absolute bottom-4 z-10 flex h-full items-end justify-start lg:bottom-6">
          <div className="flex items-center gap-1 rounded-[20px] border border-white bg-white/20 p-4 text-right text-white shadow-[0_2px_8px_rgba(0,0,0,0.1)] backdrop-blur-[15px] lg:p-5">
            <Image
              src="/figma/events/timer.svg"
              alt=""
              width={36}
              height={36}
              className="pointer-events-none size-6 shrink-0 lg:size-9"
            />
            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
              {event.countdown ? (
                <p className="text-lg leading-9 font-extrabold lg:text-2xl">{event.countdown}</p>
              ) : null}
              <p className="text-sm leading-7 lg:text-base">{event.countdownLabel}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-end justify-between gap-5 py-0 lg:gap-10 lg:py-10">
        <div className="flex w-full flex-col items-end gap-5 lg:gap-10">
          <div className="flex w-full flex-col gap-4 text-right">
            <span className="self-start rounded-full bg-[#FEF0CD] px-4 py-1 text-base leading-7 text-[#C18404]">
              {event.tag}
            </span>
            <h3 className="w-full text-xl leading-8 font-bold text-[#262626] sm:text-2xl sm:leading-9">
              {event.title}
            </h3>
            {event.description ? (
              <p className="line-clamp-4 w-full text-sm leading-7 text-[#737373] sm:text-base">
                {event.description}
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col items-end gap-4">
            <EventMeta icon="/figma/events/calendar.svg">{event.date}</EventMeta>
            <EventMeta icon="/figma/events/location.svg">{event.location}</EventMeta>
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-4">
          {hasNavigation ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="مورد قبلی"
                onClick={onNext}
                className="size-12 rounded-xl bg-[#F5F5F5] p-0 hover:bg-[#E5E5E5]"
              >
                <Image
                  src="/figma/events/arrow-left.svg"
                  alt=""
                  width={26}
                  height={26}
                  className="pointer-events-none size-6.5 shrink-0 rotate-180"
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="مورد قبلی"
                onClick={onPrevious}
                className="size-12 rounded-xl bg-[#F5F5F5] p-0 hover:bg-[#E5E5E5]"
              >
                <Image
                  src="/figma/events/arrow-left.svg"
                  alt=""
                  width={26}
                  height={26}
                  className="pointer-events-none size-6.5 shrink-0"
                />
              </Button>
            </div>
          ) : null}
          <Button className="h-12 rounded-xl bg-[#3B82F6] px-3 py-2 text-xl leading-8 font-light! text-white transition-colors hover:bg-[#2563EB]">
            مطالعه بیشتر
            <ArrowUpIcon className="size-6.5 -rotate-90" />
          </Button>
        </div>
      </div>
    </article>
  )
}

export default EventCard
