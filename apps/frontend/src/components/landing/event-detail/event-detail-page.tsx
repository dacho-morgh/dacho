import type { Event, Exhibition } from '@dacho/cms-core'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import Image from 'next/image'
import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'
import {
  EventClockIcon,
  EventMapIcon,
  EventTypeGridIcon,
  EventsCalendarIcon,
  ShapeIcon,
} from '@/components/icons'
import SectionHeading from '@/components/landing/home/section-heading'
import { Media } from '@/components/Media'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Typography } from '@/components/ui/typography'
import {
  ABOUT_PARAGRAPHS,
  AUDIENCES,
  COPY_BY_KIND,
  EVENT_DETAIL_IMAGES,
  type EventDetailKind,
  OPPORTUNITIES,
  REGISTRATION_STEPS,
  SECTION_DESCRIPTION,
} from './content'

type EventDetailPageProps = {
  document: Event | Exhibition
  kind: EventDetailKind
}

type MetaItem = {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  value: string
}

const dateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('fa-IR', {
  hour: 'numeric',
  minute: '2-digit',
})

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)

  return start.toDateString() === end.toDateString()
    ? dateFormatter.format(start)
    : dateFormatter.formatRange(start, end)
}

function formatTimeRange(startDate: string, endDate: string) {
  return `${timeFormatter.format(new Date(startDate))} تا ${timeFormatter.format(new Date(endDate))}`
}

function getCountdown(startDate: string) {
  const remaining = new Date(startDate).getTime() - Date.now()
  if (remaining <= 0) return null

  const totalHours = Math.floor(remaining / 3_600_000)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  return {
    days: days.toLocaleString('fa-IR'),
    hours: hours.toLocaleString('fa-IR'),
  }
}

function DetailHero({ document, kind }: EventDetailPageProps) {
  const copy = COPY_BY_KIND[kind]
  const hasFeaturedImage =
    typeof document.featuredImage === 'object' && document.featuredImage !== null
  const description = document.description
    ? convertLexicalToPlaintext({ data: document.description }).replace(/\s+/gu, ' ').trim()
    : 'فرصتی برای ارائه راهکارهای فناورانه و ایجاد ارتباط مستقیم میان شرکت‌های دانش‌بنیان و صنایع بزرگ انرژی.'
  const countdown = kind === 'exhibition' ? getCountdown(document.startDate) : null

  return (
    <section
      className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 md:px-8 lg:min-h-180 lg:grid-cols-2 lg:px-0 lg:py-20"
      dir="ltr"
    >
      <div className="relative aspect-8/7 w-full overflow-hidden rounded-[32px] bg-neutral-100 lg:h-140 lg:rounded-[40px]">
        {hasFeaturedImage ? (
          <Media
            fill
            priority
            resource={document.featuredImage}
            size="(min-width: 1024px) 640px, 100vw"
            pictureClassName="absolute inset-0 block"
            imgClassName="object-cover"
          />
        ) : (
          <Image
            alt=""
            className="object-cover"
            fill
            priority
            sizes="(min-width: 1024px) 640px, 100vw"
            src={EVENT_DETAIL_IMAGES.hero}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col items-end gap-8 text-right" dir="rtl">
        <div className="flex w-full flex-col gap-4">
          <Typography as="h1" color="neutral-700" lg="48/black" variant="32/extrabold">
            {document.title}
          </Typography>
          <Typography color="neutral-500" lg="20/regular" variant="16/regular">
            {description}
          </Typography>
        </div>

        {countdown ? (
          <div className="flex items-baseline gap-2 text-secondary-500" aria-label="زمان باقی‌مانده">
            <Typography as="span" color="warning" variant="40/extrabold">
              {countdown.days}
            </Typography>
            <Typography as="span" color="warning" variant="24/bold">
              روز و
            </Typography>
            <Typography as="span" color="warning" variant="40/extrabold">
              {countdown.hours}
            </Typography>
            <Typography as="span" color="warning" variant="24/bold">
              ساعت مانده
            </Typography>
          </div>
        ) : null}

        <Button asChild className="w-full sm:w-50" size="48">
          <Link href="/dashboard/events">{copy.registrationLabel}</Link>
        </Button>
      </div>
    </section>
  )
}

function EventMetadata({ document, kind }: EventDetailPageProps) {
  const items: MetaItem[] = [
    {
      icon: EventsCalendarIcon,
      label: 'تاریخ برگزاری',
      value: formatDateRange(document.startDate, document.endDate),
    },
    {
      icon: EventClockIcon,
      label: 'ساعت برگزاری',
      value: formatTimeRange(document.startDate, document.endDate),
    },
    { icon: EventMapIcon, label: 'محل برگزاری', value: document.location },
    { icon: EventTypeGridIcon, label: 'نوع برنامه', value: COPY_BY_KIND[kind].typeLabel },
  ]

  return (
    <section
      aria-label="مشخصات برنامه"
      className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 lg:px-0"
    >
      <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {items.map(({ icon: Icon, label, value }) => (
          <div className="flex min-w-0 flex-col gap-5 border-r-4 border-brand-200 px-6" key={label}>
            <div className="flex items-center gap-4">
              <Icon aria-hidden="true" className="size-9 shrink-0 text-brand-500" />
              <Typography as="dt" color="primary" variant="20/bold">
                {label}
              </Typography>
            </div>
            <Typography
              as="dd"
              className="line-clamp-2"
              color="neutral-500"
              variant="20/bold"
              lg="24/bold"
            >
              {value}
            </Typography>
          </div>
        ))}
      </dl>
    </section>
  )
}

function AboutSection({ kind }: { kind: EventDetailKind }) {
  return (
    <section className="px-4 pt-20 pb-24 md:px-8 lg:pt-20 lg:pb-40">
      <article
        className="mx-auto grid w-full max-w-7xl gap-10 rounded-[40px] bg-white p-5 shadow-[0_0_20px_rgb(10_10_10/0.1)] sm:p-8 lg:min-h-160 lg:grid-cols-2 lg:rounded-[80px] lg:p-10"
        dir="ltr"
      >
        <div className="flex flex-col justify-center gap-4 lg:py-10" dir="rtl">
          <Typography as="h2" color="neutral-800" variant="24/bold">
            {COPY_BY_KIND[kind].aboutTitle}
          </Typography>
          {ABOUT_PARAGRAPHS.map((paragraph) => (
            <Typography color="neutral-500" key={paragraph} variant="16/regular">
              {paragraph}
            </Typography>
          ))}
        </div>
        <div className="relative min-h-88 overflow-hidden rounded-[28px] lg:min-h-140 lg:rounded-[40px]">
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            src={EVENT_DETAIL_IMAGES.about}
          />
        </div>
      </article>
    </section>
  )
}

function OpportunitiesSection({ kind }: { kind: EventDetailKind }) {
  return (
    <section className="px-4 py-20 md:px-8 lg:py-20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <SectionHeading
          description={SECTION_DESCRIPTION}
          title={COPY_BY_KIND[kind].opportunityTitle}
        />
        <div className="grid items-center gap-10 lg:grid-cols-2" dir="ltr">
          <ul className="flex flex-col" dir="rtl">
            {OPPORTUNITIES.map((opportunity) => (
              <li
                className="border-b border-neutral-200 py-4 last:border-b-0"
                key={opportunity.title}
              >
                <Typography color="neutral-600" variant="20/bold">
                  {opportunity.title}
                </Typography>
                {opportunity.description ? (
                  <Typography className="mt-2" color="neutral-500" variant="16/regular">
                    {opportunity.description}
                  </Typography>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="relative aspect-square overflow-hidden rounded-[32px] lg:h-150 lg:rounded-[40px]">
            <Image
              alt=""
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              src={EVENT_DETAIL_IMAGES.opportunities}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function AudienceSection({ kind }: { kind: EventDetailKind }) {
  const copy = COPY_BY_KIND[kind]

  return (
    <section className="bg-neutral-50 px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <SectionHeading description={copy.audienceDescription} title={copy.audienceTitle} />
        <ul className="flex flex-wrap items-center justify-end gap-y-4" dir="rtl">
          {AUDIENCES.map((audience) => (
            <li className="border-r-4 border-neutral-300 px-8 first:pr-4" key={audience}>
              <Typography as="span" color="neutral-600" variant="20/bold">
                {audience}
              </Typography>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function StepsSection({ kind }: { kind: EventDetailKind }) {
  return (
    <section className="px-4 py-24 md:px-8 lg:py-40">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-16 text-center">
        <div className="flex flex-col gap-2">
          <Typography as="h2" color="neutral-600" variant="32/extrabold" sm="40/extrabold">
            {COPY_BY_KIND[kind].stepsTitle}
          </Typography>
          <Typography color="neutral-500" variant="16/regular" sm="20/regular">
            {SECTION_DESCRIPTION}
          </Typography>
        </div>

        <ol className="relative grid w-full gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-0" dir="rtl">
          <span
            aria-hidden="true"
            className="absolute top-[23px] right-[12.5%] left-[12.5%] hidden h-px bg-brand-200 lg:block"
          />
          {REGISTRATION_STEPS.map((step, index) => (
            <li className="relative flex flex-col items-center gap-6 px-4" key={step.title}>
              <span className="relative z-10 flex size-12 items-center justify-center rounded-full bg-brand-100">
                <Typography as="span" color="primary" variant="24/bold">
                  {(index + 1).toLocaleString('fa-IR')}
                </Typography>
              </span>
              <div className="flex flex-col gap-2">
                <Typography color="neutral-600" variant="20/bold">
                  {step.title}
                </Typography>
                <Typography color="neutral-500" variant="16/regular">
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

function GuestsSection({ kind }: { kind: EventDetailKind }) {
  return (
    <section className="px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <SectionHeading description={SECTION_DESCRIPTION} title={COPY_BY_KIND[kind].guestTitle} />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {EVENT_DETAIL_IMAGES.guests.map((image, index) => (
            <li
              className="flex min-w-0 items-center gap-4 rounded-[32px] bg-white p-4 shadow-[0_0_20px_rgb(10_10_10/0.05)]"
              key={`${image}-${index}`}
            >
              <Image
                alt=""
                className="size-20 rounded-2xl object-cover"
                height={80}
                src={image}
                width={80}
              />
              <div className="min-w-0 text-right">
                <Typography className="truncate" color="neutral-600" variant="20/bold">
                  نام و نام خانوادگی
                </Typography>
                <Typography color="neutral-500" variant="20/regular">
                  سمت
                </Typography>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function BoothSection() {
  return (
    <section className="px-4 py-24 md:px-8 lg:py-40">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-2" dir="ltr">
        <div className="flex min-h-120 flex-col justify-center gap-8" dir="rtl">
          <Typography as="h2" color="neutral-600" variant="32/extrabold" sm="40/extrabold">
            غرفه‌ها
          </Typography>
          <div className="flex flex-col gap-2">
            <Typography as="label" color="neutral-600" variant="20/bold">
              شماره غرفه
            </Typography>
            <Select dir="rtl">
              <SelectTrigger className="h-12 rounded-lg border-neutral-100 bg-white px-2 shadow-none">
                <SelectValue
                  placeholder={
                    <Typography as="span" color="neutral-400" variant="20/regular">
                      شماره غرفه خود را انتخاب کنید
                    </Typography>
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {['۱۰۱', '۱۰۲', '۱۰۳', '۱۰۴'].map((booth) => (
                  <SelectItem key={booth} value={booth}>
                    <Typography as="span" color="neutral-600" variant="16/regular">
                      غرفه {booth}
                    </Typography>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Typography color="neutral-600" variant="20/bold">
              مساحت
            </Typography>
            <Typography color="neutral-500" variant="20/regular">
              ۱۲ متر مربع
            </Typography>
          </div>
          <div className="flex flex-col gap-2">
            <Typography color="neutral-600" variant="20/bold">
              قیمت
            </Typography>
            <Typography color="neutral-500" variant="20/regular">
              بازه ۱۰ تا ۲۰ میلیون ریال
            </Typography>
          </div>
        </div>
        <div
          aria-label="پیش‌نمایش غرفه"
          className="aspect-square rounded-[40px] bg-neutral-100"
          role="img"
        />
      </div>
    </section>
  )
}

function VenueSection({ document }: { document: Event | Exhibition }) {
  return (
    <section className="px-4 py-20 md:px-8">
      <article
        className="mx-auto grid w-full max-w-7xl gap-10 rounded-[40px] bg-white p-5 shadow-[0_0_20px_rgb(10_10_10/0.1)] sm:p-8 lg:grid-cols-2 lg:p-10"
        dir="ltr"
      >
        <div className="relative min-h-80 overflow-hidden rounded-[20px]">
          <Image
            alt="نقشه محل برگزاری"
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            src={EVENT_DETAIL_IMAGES.venueMap}
          />
        </div>
        <div className="flex flex-col gap-10 text-right" dir="rtl">
          <Typography as="h2" color="neutral-600" variant="32/extrabold">
            اطلاعات برگزاری
          </Typography>
          <div className="flex flex-col gap-4">
            <Typography color="neutral-600" variant="20/bold">
              محل
            </Typography>
            <Typography color="neutral-500" variant="20/regular">
              {document.location}
            </Typography>
          </div>
          <div className="flex flex-col gap-4">
            <Typography color="neutral-600" variant="20/bold">
              آدرس
            </Typography>
            <Typography color="neutral-500" variant="20/regular">
              {document.location}
            </Typography>
          </div>
          <div className="flex flex-col gap-4">
            <Typography color="neutral-600" variant="20/bold">
              تاریخ برگزاری
            </Typography>
            <Typography color="neutral-500" variant="20/regular">
              {formatDateRange(document.startDate, document.endDate)}
            </Typography>
          </div>
        </div>
      </article>
    </section>
  )
}

function RegistrationCallToAction({ kind }: { kind: EventDetailKind }) {
  const copy = COPY_BY_KIND[kind]

  return (
    <section className="relative mt-20 overflow-hidden bg-linear-to-r from-brand-600 to-brand-900 px-4 py-20 md:px-8 lg:py-40">
      <ShapeIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-0 h-[520px] w-[940px] -translate-y-1/2 text-brand-50 opacity-20"
      />
      <div
        className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10"
        dir="ltr"
      >
        <Button asChild className="w-full" size="48" variant="white">
          <Link href="/dashboard/events">{copy.registrationLabel}</Link>
        </Button>
        <div className="flex flex-col gap-4 text-right" dir="rtl">
          <Typography as="h2" color="white" variant="24/bold" sm="32/bold">
            {copy.ctaTitle}
          </Typography>
          <Typography color="white" variant="16/regular" sm="20/regular">
            {copy.ctaDescription}
          </Typography>
        </div>
      </div>
    </section>
  )
}

export default function EventDetailPage({ document, kind }: EventDetailPageProps) {
  return (
    <main className="overflow-x-clip bg-white pt-[74px]">
      <DetailHero document={document} kind={kind} />
      <EventMetadata document={document} kind={kind} />
      <AboutSection kind={kind} />
      <OpportunitiesSection kind={kind} />
      <AudienceSection kind={kind} />
      <StepsSection kind={kind} />
      <GuestsSection kind={kind} />
      {kind === 'exhibition' ? <BoothSection /> : null}
      <VenueSection document={document} />
      <RegistrationCallToAction kind={kind} />
    </main>
  )
}
