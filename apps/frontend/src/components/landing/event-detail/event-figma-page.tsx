import type { Event, Exhibition } from '@dacho/cms-core'
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
  ShapeIcon,
} from '@/components/icons'
import SectionHeading from '@/components/landing/home/section-heading'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import RecruitmentSection from '../home/recruitment-section'
import {
  EVENT_ABOUT_PARAGRAPHS,
  AUDIENCES,
  COPY_BY_KIND,
  EVENT_DETAIL_IMAGES,
  EVENT_FAQ,
  EVENT_SCHEDULE,
  type EventDetailKind,
  OPPORTUNITIES,
  REGISTRATION_STEPS,
  SECTION_DESCRIPTION,
  SPONSORS,
} from './content'
import EventCountdown from './event-countdown'

type EventDetailPageProps = { document: Event | Exhibition; kind: EventDetailKind }
type MetaItem = { icon: ComponentType<SVGProps<SVGSVGElement>>; label: string; value: string }

const dateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('fa-IR', { hour: 'numeric', minute: '2-digit' })

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return start.toDateString() === end.toDateString()
    ? dateFormatter.format(start)
    : dateFormatter.formatRange(start, end)
}

function registerButton(kind: EventDetailKind) {
  return (
    <Button asChild className="w-full font-[325]! sm:w-[200px]" size="48" variant="white">
      <Link href="/dashboard/events">{COPY_BY_KIND[kind].registrationLabel}</Link>
    </Button>
  )
}

function DetailHero({ document, kind }: EventDetailPageProps) {
  const description = document.description
    ? convertLexicalToPlaintext({ data: document.description }).replace(/\s+/gu, ' ').trim()
    : 'فرصتی برای ارائه راهکارهای فناورانه و ایجاد ارتباط مستقیم میان شرکت‌های دانش‌بنیان و صنایع بزرگ انرژی.'

  return (
    <section
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-20 md:min-h-screen md:justify-end md:px-20"
      dir="ltr"
    >
      <Image
        alt=""
        className="object-cover"
        fill
        priority
        sizes="100vw"
        src={EVENT_DETAIL_IMAGES.hero}
      />
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
          <EventCountdown startDate={document.startDate} />
          {registerButton(kind)}
        </div>
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
      value: `${timeFormatter.format(new Date(document.startDate))} تا ${timeFormatter.format(new Date(document.endDate))}`,
    },
    { icon: EventMapIcon, label: 'محل برگزاری', value: document.location },
    { icon: EventTypeGridIcon, label: 'نوع رویداد', value: COPY_BY_KIND[kind].typeLabel },
  ]
  return (
    <section
      aria-label="مشخصات رویداد"
      className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8 lg:px-0"
    >
      <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4" dir="rtl">
        {items.map(({ icon: Icon, label, value }) => (
          <div className="min-w-0 border-r-4 border-brand-200 px-6" key={label}>
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

function AboutSection({ kind }: { kind: EventDetailKind }) {
  return (
    <section className="px-4 md:px-8 md:py-10">
      <article
        className="mx-auto grid w-full max-w-7xl rounded-[40px] bg-white p-5 shadow-[0_0_40px_rgb(10_10_10/0.1)] sm:p-8 lg:h-[640px] lg:grid-cols-[520px_640px] lg:gap-10 lg:rounded-[80px] lg:p-10"
        dir="ltr"
      >
        <div
          className="order-2 flex flex-col justify-start gap-4 pt-10 text-right lg:order-1"
          dir="rtl"
        >
          <Typography as="h2" color="neutral-800" lg="24/bold" variant="20/bold">
            {COPY_BY_KIND[kind].aboutTitle}
          </Typography>
          {EVENT_ABOUT_PARAGRAPHS.map((paragraph) => (
            <Typography color="neutral-500" key={paragraph} lg="16/regular" variant="14/regular">
              {paragraph}
            </Typography>
          ))}
        </div>
        <div className="relative order-1 min-h-80 overflow-hidden rounded-[40px] lg:order-2 lg:min-h-0">
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
    <section className="px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <SectionHeading
          description={SECTION_DESCRIPTION}
          title={COPY_BY_KIND[kind].opportunityTitle}
        />
        <div className="grid items-center gap-10 lg:grid-cols-[640px_600px]" dir="ltr">
          <ul className="flex flex-col justify-center" dir="rtl">
            {OPPORTUNITIES.map((opportunity, index) => (
              <li className="border-y border-neutral-200 py-6 text-right" key={opportunity.title}>
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
            <Image
              alt=""
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 600px, 100vw"
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
    <section className="bg-neutral-50 px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <SectionHeading description={copy.audienceDescription} title={copy.audienceTitle} />
        <ul className="flex flex-wrap items-center justify-start gap-5" dir="rtl">
          {AUDIENCES.map((audience) => (
            <li className="border-r-[6px] border-neutral-300 py-2 pr-5 pl-10" key={audience}>
              <Typography as="span" color="neutral-500" lg="24/bold" variant="20/bold">
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
    <section className="px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-20 text-center">
        <div className="flex flex-col gap-2">
          <Typography as="h2" color="neutral-600" lg="40/extrabold" variant="34/extrabold">
            {COPY_BY_KIND[kind].stepsTitle}
          </Typography>
          <Typography color="neutral-500" lg="20/regular" variant="16/regular">
            {SECTION_DESCRIPTION}
          </Typography>
        </div>
        <ol className="grid w-full gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0" dir="rtl">
          {REGISTRATION_STEPS.map((step, index) => (
            <li className="relative flex flex-col items-center gap-8" key={step.title}>
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

function GuestsSection({ kind }: { kind: EventDetailKind }) {
  return (
    <section className="overflow-hidden px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <SectionHeading description={SECTION_DESCRIPTION} title={COPY_BY_KIND[kind].guestTitle} />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" dir="rtl">
          {EVENT_DETAIL_IMAGES.guests.map((image, index) => (
            <li
              className="flex min-w-0 items-center gap-4 rounded-[32px] bg-white p-4 shadow-[0_0_20px_rgb(10_10_10/0.05)] lg:shrink-0"
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
                <Typography className="truncate" color="neutral-600" lg="20/bold" variant="16/bold">
                  نام و نام خانوادگی
                </Typography>
                <Typography color="neutral-500" lg="20/regular" variant="16/regular">
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

function SponsorsSection() {
  return (
    <section className="bg-neutral-50 px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <SectionHeading description="حامیان پیشرو در صنعت کشور" title="حامیان" />
        <ul className="flex flex-wrap justify-start gap-x-5 gap-y-10" dir="rtl">
          {SPONSORS.map((name, index) => (
            <li
              className="flex items-center gap-4 border-r-[6px] border-neutral-300 py-2 pr-5 pl-10"
              key={`${name}-${index}`}
            >
              <EventAwardIcon aria-hidden="true" className="size-10 text-neutral-500" />
              <Typography as="span" color="neutral-500" lg="24/bold" variant="20/bold">
                {name}
              </Typography>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function GallerySection() {
  return (
    <section className="overflow-hidden px-4 py-40 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-20 text-center">
        <div className="flex flex-col gap-2">
          <Typography as="h2" color="neutral-600" lg="40/extrabold" variant="34/extrabold">
            گالری تصاویر
          </Typography>
          <Typography color="neutral-500" lg="20/regular" variant="16/regular">
            لحظاتی از رویداد های پیشین
          </Typography>
        </div>
        <div
          className="relative h-[500px] w-[1040px] shrink-0 max-lg:-mb-[125px] max-lg:origin-top max-lg:scale-75 max-sm:-mb-[250px] max-sm:scale-50"
          aria-label="گالری تصاویر رویداد"
        >
          {EVENT_DETAIL_IMAGES.gallery.map((image, index) => {
            const positions = [
              'left-0 top-[50px] h-[400px] w-[320px] rounded-[24px]',
              'left-[160px] top-[25px] h-[450px] w-[360px] rounded-[32px]',
              'left-[320px] top-0 z-10 h-[500px] w-[400px] rounded-[40px]',
              'left-[520px] top-[25px] h-[450px] w-[360px] rounded-[32px]',
              'left-[720px] top-[50px] h-[400px] w-[320px] rounded-[24px]',
            ]
            return (
              <div
                className={`absolute overflow-hidden shadow-[0_10px_32px_rgb(10_10_10/0.2)] ${positions[index]}`}
                key={image}
              >
                <Image
                  alt={`تصویر ${index + 1} از گالری رویداد`}
                  className="object-cover"
                  fill
                  sizes="400px"
                  src={image}
                />
                {index !== 2 && (
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

function ScheduleSection({ kind }: { kind: EventDetailKind }) {
  return (
    <section className="bg-neutral-50 px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 sm:gap-20">
        <SectionHeading description="این رویداد برای شرکت‌های دانش‌بنیان،" title="برنامه رویداد" />
        <div className="flex flex-col gap-8 sm:gap-10" dir="rtl">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            {[0, 1, 2].map((index) => (
              <Button
                asChild
                key={index}
                size="32"
                lg="48"
                variant={index === 0 ? 'primary' : 'outline-gray'}
              >
                <Link href="#">{COPY_BY_KIND[kind].registrationLabel}</Link>
              </Button>
            ))}
          </div>
          <ol className="flex w-full flex-col gap-4 sm:gap-0">
            {EVENT_SCHEDULE.map((item) => (
              <li
                className="relative flex min-w-0 flex-col items-start gap-3 sm:min-h-[120px] sm:flex-row sm:items-center sm:gap-8 sm:before:absolute sm:before:top-0 sm:before:right-[90px] sm:before:h-full sm:before:w-px sm:before:bg-brand-300"
                key={item.time}
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
                    اطلاعات شرکت و نماینده خود را ثبت کنید
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

function VenueSection({ document }: { document: Event | Exhibition }) {
  return (
    <section className="px-4 py-20 md:px-8">
      <article
        className="mx-auto grid w-full max-w-7xl gap-10 rounded-[40px] bg-white p-5 shadow-[0_0_40px_rgb(10_10_10/0.1)] sm:p-8 lg:grid-cols-2 lg:p-10"
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
          <Typography as="h2" color="neutral-600" lg="32/extrabold" variant="20/extrabold">
            اطلاعات برگزاری
          </Typography>
          {[
            ['محل', document.location],
            ['آدرس', document.location],
            ['تاریخ برگزاری', formatDateRange(document.startDate, document.endDate)],
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

function RegistrationCallToAction({ kind }: { kind: EventDetailKind }) {
  return <RecruitmentSection />
}

function FaqSection() {
  return (
    <section className="bg-neutral-50 px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-[800px] flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <Typography as="h2" color="neutral-600" lg="40/extrabold" variant="34/extrabold">
            سوالات پر تکرار
          </Typography>
          <Typography color="neutral-500" lg="20/regular" variant="16/regular">
            از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای
            یکپارچه مدیریت می‌شود.
          </Typography>
        </div>
        <div className="flex w-full flex-col gap-4" dir="rtl">
          {EVENT_FAQ.map((item, index) => (
            <details
              className="group rounded-2xl bg-neutral-100 p-4"
              key={index}
              open={index === 0 ? true : undefined}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                <Typography as="span" color="neutral-700" lg="16/semibold" variant="14/semibold">
                  {item.title}
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
                {item.description}
              </Typography>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function EventDetailPage({ document, kind }: EventDetailPageProps) {
  return (
    <main className="overflow-x-clip bg-white">
      <DetailHero document={document} kind={kind} />
      <EventMetadata document={document} kind={kind} />
      <AboutSection kind={kind} />
      <OpportunitiesSection kind={kind} />
      <AudienceSection kind={kind} />
      <StepsSection kind={kind} />
      <GuestsSection kind={kind} />
      <SponsorsSection />
      <GallerySection />
      <ScheduleSection kind={kind} />
      <VenueSection document={document} />
      <RegistrationCallToAction kind={kind} />
      <FaqSection />
    </main>
  )
}
