import type { Event, Media } from '@dacho/cms-core'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import Image from 'next/image'
import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'
import {
  ArrowUpIcon,
  EventAwardIcon,
  EventClockIcon,
  EventMapIcon,
  EventTypeGridIcon,
  EventsCalendarIcon,
} from '@/components/icons/generated'
import SectionHeading from '@/components/landing/home/section-heading'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import EventCountdown from './event-countdown'

type EventDetailPageProps = { document: Event }
type MetaItem = { icon: ComponentType<SVGProps<SVGSVGElement>>; label: string; value: string }

const dateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Tehran',
})
const timeFormatter = new Intl.DateTimeFormat('fa-IR', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Tehran',
})

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return dateFormatter.format(start) === dateFormatter.format(end)
    ? dateFormatter.format(start)
    : dateFormatter.formatRange(start, end)
}

function mediaSource(media: number | Media | null | undefined) {
  return media && typeof media === 'object' ? getMediaUrl(media.url, media.updatedAt) : ''
}

function mediaAlt(media: number | Media | null | undefined) {
  return media && typeof media === 'object' ? media.alt || '' : ''
}

function registerButton(document: Event) {
  const button = document.registration
  if (button?.enabled === false || !button?.label || !button.href) return null
  return (
    <Button asChild className="w-full font-[325]! sm:w-[200px]" size="48" variant="white">
      <Link href={button.href}>{button.label}</Link>
    </Button>
  )
}

function DetailHero({ document }: EventDetailPageProps) {
  const description = document.description
    ? convertLexicalToPlaintext({ data: document.description }).replace(/\s+/gu, ' ').trim()
    : ''

  return (
    <section
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-20 md:min-h-screen md:justify-end md:px-20"
      dir="ltr"
    >
      {mediaSource(document.featuredImage) && (
        <Image
          alt={mediaAlt(document.featuredImage)}
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={mediaSource(document.featuredImage)}
        />
      )}
      <div className="absolute inset-0 bg-linear-[115deg] from-brand-900/0 to-brand-900/80" />
      <div
        className="relative w-full max-w-[640px] rounded-[40px] border border-white/20 bg-white/20 px-5 py-10 text-right text-white shadow-[0_0_40px_rgb(21_21_21/0.16)] backdrop-blur-md"
        dir="rtl"
      >
        <div className="flex flex-col items-start gap-8">
          <div className="flex flex-col gap-4">
            <Typography as="h1" className="text-white" lg="48/black" variant="32/black">
              {document.title}
            </Typography>
            <Typography className="text-white" lg="20/regular" variant="16/regular">
              {description}
            </Typography>
          </div>
          {document.countdown?.enabled !== false && (
            <EventCountdown
              startDate={document.countdown?.targetDate || document.startDate}
              labels={document.countdown}
            />
          )}
          {registerButton(document)}
        </div>
      </div>
    </section>
  )
}

function EventMetadata({ document }: EventDetailPageProps) {
  const items: MetaItem[] = [
    {
      icon: EventsCalendarIcon,
      label: document.metadata?.dateLabel || '',
      value: document.metadata?.dateText || formatDateRange(document.startDate, document.endDate),
    },
    {
      icon: EventClockIcon,
      label: document.metadata?.timeLabel || '',
      value:
        document.metadata?.timeText ||
        `${timeFormatter.format(new Date(document.startDate))} ${document.metadata?.timeSeparator || ''} ${timeFormatter.format(new Date(document.endDate))}`,
    },
    { icon: EventMapIcon, label: document.metadata?.locationLabel || '', value: document.location },
    {
      icon: EventTypeGridIcon,
      label: document.metadata?.typeLabel || '',
      value: document.metadata?.eventType || '',
    },
  ]
  return (
    <section
      aria-label={document.metadata?.label || undefined}
      className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8 lg:px-0"
    >
      <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4" dir="rtl">
        {items.map(({ icon: Icon, label, value }, index) => (
          <div className="min-w-0 border-r-4 border-brand-200 px-6" key={index}>
            <div className="flex items-center gap-4">
              <Icon aria-hidden="true" className="size-9 shrink-0 text-brand-500" />
              <Typography as="dt" color="primary" lg="20/bold" variant="16/bold">
                {label}
              </Typography>
            </div>
            <Typography
              as="dd"
              className="mt-5 truncate"
              color="neutral-500"
              lg="24/bold"
              variant="20/bold"
            >
              {value}
            </Typography>
          </div>
        ))}
      </dl>
    </section>
  )
}

function AboutSection({ document }: EventDetailPageProps) {
  return (
    <section className="px-4 md:px-8 md:py-10">
      <article
        className="mx-auto grid w-full max-w-7xl rounded-[40px] bg-white p-5 shadow-[0_0_40px_rgb(10_10_10/0.1)] sm:p-8 lg:min-h-[640px] lg:grid-cols-[520px_640px] lg:gap-10 lg:rounded-[80px] lg:p-10"
        dir="ltr"
      >
        <div
          className="order-2 flex flex-col justify-start gap-4 pt-10 text-right lg:order-1"
          dir="rtl"
        >
          <Typography as="h2" color="neutral-800" lg="24/bold" variant="20/bold">
            {document.about?.title}
          </Typography>
          {document.about?.description && (
            <Typography color="neutral-500" lg="16/regular" variant="14/regular">
              {document.about.description}
            </Typography>
          )}
          {(document.about?.paragraphs || []).map((paragraph) => (
            <Typography color="neutral-500" key={paragraph.id} lg="16/regular" variant="14/regular">
              {paragraph.text}
            </Typography>
          ))}
        </div>
        <div className="relative order-1 min-h-80 overflow-hidden rounded-[40px] lg:order-2 lg:min-h-0">
          {mediaSource(document.about?.image) && (
            <Image
              alt={mediaAlt(document.about?.image)}
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              src={mediaSource(document.about?.image)}
            />
          )}
        </div>
      </article>
    </section>
  )
}

function OpportunitiesSection({ document }: EventDetailPageProps) {
  return (
    <section className="px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <SectionHeading
          description={document.opportunities?.description || ''}
          title={document.opportunities?.title || ''}
        />
        <div className="grid items-center gap-10 lg:grid-cols-[640px_600px]" dir="ltr">
          <ul className="flex flex-col justify-center" dir="rtl">
            {(document.opportunities?.items || []).map((opportunity, index) => (
              <li
                className="border-y border-neutral-200 py-6 text-right"
                key={opportunity.id || index}
              >
                <Typography
                  color={index === 0 ? 'neutral-700' : 'neutral-600'}
                  lg={index === 0 ? '32/extrabold' : '24/extrabold'}
                  variant="20/extrabold"
                >
                  {opportunity.title}
                </Typography>
                {opportunity.description && (
                  <Typography
                    className="mt-2"
                    color="neutral-500"
                    lg="20/regular"
                    variant="16/regular"
                  >
                    {opportunity.description}
                  </Typography>
                )}
              </li>
            ))}
          </ul>
          <div className="relative aspect-square overflow-hidden rounded-[40px]">
            {mediaSource(document.opportunities?.image) && (
              <Image
                alt={mediaAlt(document.opportunities?.image)}
                className="object-cover"
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                src={mediaSource(document.opportunities?.image)}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function AudienceSection({ document }: EventDetailPageProps) {
  return (
    <section className="bg-neutral-50 px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <SectionHeading
          description={document.audience?.description || ''}
          title={document.audience?.title || ''}
        />
        <ul className="flex flex-wrap items-center justify-start gap-5" dir="rtl">
          {(document.audience?.items || []).map((audience) => (
            <li className="border-r-[6px] border-neutral-300 py-2 pr-5 pl-10" key={audience.id}>
              <Typography as="span" color="neutral-500" lg="24/bold" variant="20/bold">
                {audience.title}
              </Typography>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function StepsSection({ document }: EventDetailPageProps) {
  return (
    <section className="px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-20 text-center">
        <div className="flex flex-col gap-2">
          <Typography as="h2" color="neutral-600" lg="40/extrabold" variant="34/extrabold">
            {document.steps?.title}
          </Typography>
          <Typography color="neutral-500" lg="20/regular" variant="16/regular">
            {document.steps?.description}
          </Typography>
        </div>
        <ol className="grid w-full gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0" dir="rtl">
          {(document.steps?.items || []).map((step, index) => (
            <li className="relative flex flex-col items-center gap-8" key={step.id || index}>
              <div className="flex w-full items-center gap-2">
                <span className="h-px flex-1 bg-brand-300" aria-hidden="true" />
                <span className="flex size-14 items-center justify-center rounded-full bg-brand-100">
                  <Typography as="span" color="primary" lg="24/bold" variant="20/bold">
                    {(index + 1).toLocaleString('fa-IR')}
                  </Typography>
                </span>
                <span className="h-px flex-1 bg-brand-300" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-2 px-4">
                <Typography color="neutral-600" lg="20/bold" variant="16/bold">
                  {step.title}
                </Typography>
                <Typography color="neutral-500" lg="16/regular" variant="14/regular">
                  {step.description}
                </Typography>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function GuestsSection({ document }: EventDetailPageProps) {
  return (
    <section className="overflow-hidden px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <SectionHeading
          description={document.guests?.description || ''}
          title={document.guests?.title || ''}
        />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" dir="rtl">
          {(document.guests?.items || []).map((guest, index) => (
            <li
              className="flex min-w-0 items-center gap-4 rounded-[32px] bg-white p-4 shadow-[0_0_20px_rgb(10_10_10/0.05)] lg:shrink-0"
              key={guest.id || index}
            >
              {mediaSource(guest.image) && (
                <Image
                  alt={mediaAlt(guest.image)}
                  className="size-20 rounded-2xl object-cover"
                  height={80}
                  src={mediaSource(guest.image)}
                  width={80}
                />
              )}
              <div className="min-w-0 text-right">
                <Typography className="truncate" color="neutral-600" lg="20/bold" variant="16/bold">
                  {guest.name}
                </Typography>
                <Typography color="neutral-500" lg="20/regular" variant="16/regular">
                  {guest.role}
                </Typography>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function SponsorsSection({ document }: EventDetailPageProps) {
  return (
    <section className="bg-neutral-50 px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <SectionHeading
          description={document.sponsors?.description || ''}
          title={document.sponsors?.title || ''}
        />
        <ul className="flex flex-wrap justify-start gap-x-5 gap-y-10" dir="rtl">
          {(document.sponsors?.items || []).map((sponsor, index) => (
            <li
              className="flex items-center gap-4 border-r-[6px] border-neutral-300 py-2 pr-5 pl-10"
              key={sponsor.id || index}
            >
              {mediaSource(sponsor.logo) ? (
                <Image
                  alt={mediaAlt(sponsor.logo)}
                  src={mediaSource(sponsor.logo)}
                  width={40}
                  height={40}
                  className="size-10 object-contain"
                />
              ) : (
                <EventAwardIcon aria-hidden="true" className="size-10 text-neutral-500" />
              )}
              <Typography as="span" color="neutral-500" lg="24/bold" variant="20/bold">
                {sponsor.href ? <Link href={sponsor.href}>{sponsor.name}</Link> : sponsor.name}
              </Typography>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function GallerySection({ document }: EventDetailPageProps) {
  const images = (document.gallery?.items || []).filter((item) => mediaSource(item.image))
  const stacked = images.length === 5
  return (
    <section className="overflow-hidden px-4 py-40 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-20 text-center">
        <div className="flex flex-col gap-2">
          <Typography as="h2" color="neutral-600" lg="40/extrabold" variant="34/extrabold">
            {document.gallery?.title}
          </Typography>
          <Typography color="neutral-500" lg="20/regular" variant="16/regular">
            {document.gallery?.description}
          </Typography>
        </div>
        <div
          className={
            stacked
              ? 'relative h-[500px] w-[1040px] shrink-0 max-lg:-mb-[125px] max-lg:origin-top max-lg:scale-75 max-sm:-mb-[250px] max-sm:scale-50'
              : 'flex w-full gap-4 overflow-x-auto'
          }
          aria-label={document.gallery?.title || undefined}
        >
          {images.map((item, index) => {
            const positions = [
              'left-0 top-[50px] h-[400px] w-[320px] rounded-[24px]',
              'left-[160px] top-[25px] h-[450px] w-[360px] rounded-[32px]',
              'left-[320px] top-0 z-10 h-[500px] w-[400px] rounded-[40px]',
              'left-[520px] top-[25px] h-[450px] w-[360px] rounded-[32px]',
              'left-[720px] top-[50px] h-[400px] w-[320px] rounded-[24px]',
            ]
            return (
              <div
                className={`overflow-hidden shadow-[0_10px_32px_rgb(10_10_10/0.2)] ${stacked ? `absolute ${positions[index]}` : 'relative h-[300px] w-[240px] shrink-0 rounded-[24px]'}`}
                key={item.id || index}
              >
                <Image
                  alt={mediaAlt(item.image)}
                  className="object-cover"
                  fill
                  sizes="400px"
                  src={mediaSource(item.image)}
                />
                {stacked && index !== 2 && (
                  <div className="absolute inset-0 bg-black/10 backdrop-blur-[4px]" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ScheduleSection({ document }: EventDetailPageProps) {
  return (
    <section className="bg-neutral-50 px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 sm:gap-20">
        <SectionHeading
          description={document.schedule?.description || ''}
          title={document.schedule?.title || ''}
        />
        <div className="flex flex-col gap-8 sm:gap-10" dir="rtl">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            {(document.schedule?.buttons || [])
              .filter((button) => button.label && button.href)
              .map((button, index) => (
                <Button
                  asChild
                  key={index}
                  size="32"
                  lg="48"
                  variant={button.primary ? 'primary' : 'outline-gray'}
                >
                  <Link href={button.href!}>{button.label}</Link>
                </Button>
              ))}
          </div>
          <ol className="flex w-full flex-col gap-4 sm:gap-0">
            {(document.schedule?.items || []).map((item) => (
              <li
                className="relative flex min-w-0 flex-col items-start gap-3 sm:min-h-[120px] sm:flex-row sm:items-center sm:gap-8 sm:before:absolute sm:before:top-0 sm:before:right-[90px] sm:before:h-full sm:before:w-px sm:before:bg-brand-300"
                key={item.id}
              >
                <span className="relative z-10 flex h-12 w-36 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-500 sm:h-14 sm:w-[180px]">
                  <Typography as="span" color="primary" lg="24/bold" variant="20/bold">
                    {item.time}
                  </Typography>
                </span>
                <div className="flex min-h-[72px] w-full min-w-0 flex-col gap-2 rounded-[20px] bg-white p-4 text-right shadow-[0_0_20px_rgb(10_10_10/0.05)] sm:w-auto sm:flex-1">
                  <Typography color="neutral-600" lg="20/bold" variant="16/bold">
                    {item.title}
                  </Typography>
                  <Typography color="neutral-500" lg="16/regular" variant="14/regular">
                    {item.description}
                  </Typography>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function VenueSection({ document }: EventDetailPageProps) {
  return (
    <section className="px-4 py-20 md:px-8">
      <article
        className="mx-auto grid w-full max-w-7xl gap-10 rounded-[40px] bg-white p-5 shadow-[0_0_40px_rgb(10_10_10/0.1)] sm:p-8 lg:grid-cols-2 lg:p-10"
        dir="ltr"
      >
        <div className="relative min-h-80 overflow-hidden rounded-[20px]">
          {document.venue?.mapHref ? (
            <Link href={document.venue.mapHref} className="absolute inset-0">
              {mediaSource(document.venue?.mapImage) && (
                <Image
                  alt={mediaAlt(document.venue?.mapImage)}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  src={mediaSource(document.venue?.mapImage)}
                />
              )}
            </Link>
          ) : (
            <>
              {mediaSource(document.venue?.mapImage) && (
                <Image
                  alt={mediaAlt(document.venue?.mapImage)}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  src={mediaSource(document.venue?.mapImage)}
                />
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-10 text-right" dir="rtl">
          <Typography as="h2" color="neutral-600" lg="32/extrabold" variant="20/extrabold">
            {document.venue?.title}
          </Typography>
          {document.venue?.description && (
            <Typography color="neutral-500" lg="16/regular" variant="14/regular">
              {document.venue.description}
            </Typography>
          )}
          {[
            [document.venue?.locationLabel, document.location],
            [document.venue?.addressLabel, document.venue?.address || document.location],
            [
              document.venue?.dateLabel,
              document.metadata?.dateText || formatDateRange(document.startDate, document.endDate),
            ],
          ].map(([label, value]) => (
            <div className="flex flex-col gap-4" key={label}>
              <Typography color="neutral-600" lg="20/bold" variant="16/bold">
                {label}
              </Typography>
              <Typography color="neutral-500" lg="20/regular" variant="16/regular">
                {value}
              </Typography>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}

function RegistrationCallToAction({ document }: EventDetailPageProps) {
  const content = document.callToAction
  return (
    <section
      className="relative mx-auto flex w-[calc(100%-2rem)] max-w-280 flex-col items-center gap-8 overflow-hidden rounded-[40px] bg-brand-900 px-6 py-10 text-center md:flex-row md:px-20 md:text-right"
      dir="rtl"
    >
      {mediaSource(content?.backgroundImage) && (
        <Image
          alt={mediaAlt(content?.backgroundImage)}
          src={mediaSource(content?.backgroundImage)}
          fill
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div className="relative flex-1 space-y-4">
        <Typography as="h2" variant="24/bold" sm="32/bold" color="white">
          {content?.title}
        </Typography>
        <Typography variant="16/regular" sm="20/regular" color="white">
          {content?.description}
        </Typography>
      </div>
      {content?.buttonLabel && content.buttonHref && (
        <Button asChild variant="white" size="48" className="relative w-40 font-light">
          <Link href={content.buttonHref}>{content.buttonLabel}</Link>
        </Button>
      )}
    </section>
  )
}

function FaqSection({ document }: EventDetailPageProps) {
  return (
    <section className="bg-neutral-50 px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-[800px] flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <Typography as="h2" color="neutral-600" lg="40/extrabold" variant="34/extrabold">
            {document.faq?.title}
          </Typography>
          <Typography color="neutral-500" lg="20/regular" variant="16/regular">
            {document.faq?.description}
          </Typography>
        </div>
        <div className="flex w-full flex-col gap-4" dir="rtl">
          {(document.faq?.items || []).map((item, index) => (
            <details
              className="group rounded-2xl bg-neutral-100 p-4"
              key={index}
              open={index === 0 ? true : undefined}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                <Typography as="span" color="neutral-700" lg="16/semibold" variant="14/semibold">
                  {item.question}
                </Typography>
                <span className="flex size-8 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 group-open:bg-neutral-700 group-open:text-white">
                  <ArrowUpIcon
                    aria-hidden="true"
                    className="size-5 rotate-180 group-open:rotate-0"
                  />
                </span>
              </summary>
              <Typography
                className="mt-4 text-right"
                color="neutral-600"
                lg="16/regular"
                variant="14/regular"
              >
                {item.answer}
              </Typography>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function EventDetailPage({ document }: EventDetailPageProps) {
  return (
    <main className="overflow-x-clip bg-white">
      <DetailHero document={document} />
      {document.metadata?.enabled !== false && <EventMetadata document={document} />}
      {document.about?.enabled !== false && <AboutSection document={document} />}
      {document.opportunities?.enabled !== false && <OpportunitiesSection document={document} />}
      {document.audience?.enabled !== false && <AudienceSection document={document} />}
      {document.steps?.enabled !== false && <StepsSection document={document} />}
      {document.guests?.enabled !== false && <GuestsSection document={document} />}
      {document.sponsors?.enabled !== false && <SponsorsSection document={document} />}
      {document.gallery?.enabled !== false && <GallerySection document={document} />}
      {document.schedule?.enabled !== false && <ScheduleSection document={document} />}
      {document.venue?.enabled !== false && <VenueSection document={document} />}
      {document.callToAction?.enabled !== false && <RegistrationCallToAction document={document} />}
      {document.faq?.enabled !== false && <FaqSection document={document} />}
    </main>
  )
}
