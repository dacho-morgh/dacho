import type { Media } from '@dacho/cms-core'
import Image from 'next/image'
import Link from 'next/link'
import type React from 'react'
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  EventsCalendarIcon,
  EventsLocationIcon,
  EventsTimerIcon,
} from '@/components/icons'
import { Media as MediaComponent } from '@/components/Media'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export type EventCardData = {
  id: string
  href: string
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

const EventMeta = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div dir="ltr" className="flex w-full items-center justify-end gap-2">
    <Typography
      lg="16/semibold"
      variant="14/semibold"
      color="neutral-600"
      className="min-w-0 flex-1 text-right"
    >
      {children}
    </Typography>
    {icon}
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
            <EventsTimerIcon
              aria-hidden="true"
              className="pointer-events-none size-6 shrink-0 text-white lg:size-9"
            />
            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
              {event.countdown ? (
                <Typography as="span" variant="24/extrabold" color="white">
                  {event.countdown}
                </Typography>
              ) : null}
              <Typography as="span" variant="16/regular" color="white">
                {event.countdownLabel}
              </Typography>
            </div>
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-end justify-between gap-5 py-0 lg:gap-10 lg:py-10">
        <div className="flex w-full flex-col items-end gap-5 lg:gap-10">
          <div className="flex w-full flex-col gap-4 text-right">
            <Typography
              as="span"
              variant="16/regular"
              color="warning"
              className="self-start rounded-full bg-secondary-100 px-4 py-0.5 text-secondary-700"
            >
              {event.tag}
            </Typography>
            <Typography
              as="h3"
              variant="20/bold"
              sm="24/bold"
              color="neutral-800"
              className="w-full"
            >
              {event.title}
            </Typography>
            {event.description ? (
              <Typography
                variant="14/regular"
                sm="16/regular"
                color="neutral-500"
                className="line-clamp-4 w-full"
              >
                {event.description}
              </Typography>
            ) : null}
          </div>

          <div className="flex w-full flex-col items-end gap-4">
            <EventMeta
              icon={
                <EventsCalendarIcon
                  aria-hidden="true"
                  className="pointer-events-none size-7 shrink-0 text-neutral-400"
                />
              }
            >
              {event.date}
            </EventMeta>
            <EventMeta
              icon={
                <EventsLocationIcon
                  aria-hidden="true"
                  className="pointer-events-none size-7 shrink-0 text-neutral-400"
                />
              }
            >
              {event.location}
            </EventMeta>
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-4">
          {hasNavigation ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="مورد بعدی"
                onClick={onNext}
                className="size-12 rounded-xl bg-neutral-100 p-0 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-600"
              >
                <ArrowLeftIcon
                  aria-hidden="true"
                  className="pointer-events-none size-6.5 shrink-0 rotate-180"
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="مورد قبلی"
                onClick={onPrevious}
                className="size-12 rounded-xl bg-neutral-100 p-0 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-600"
              >
                <ArrowLeftIcon
                  aria-hidden="true"
                  className="pointer-events-none size-6.5 shrink-0"
                />
              </Button>
            </div>
          ) : null}
          <Button asChild size="36" lg="48" className="w-auto font-[325]!">
            <Link href={event.href}>
              مطالعه بیشتر
              <ArrowUpIcon className="size-4.5 -rotate-90 lg:size-6.5" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

export default EventCard
