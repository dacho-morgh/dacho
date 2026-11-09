import Link from 'next/link'
import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
import { CalendarBulkIcon, CompanyBuildingIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Typography } from '@/components/ui/typography'
import { formatDate } from '@/utilities/dashboard-api'
import {
  missingSectionLinks,
  type Eligibility,
  type EligibilityState,
} from '@/utilities/participation-eligibility'
import { fa } from './shared'

/** An event the company can apply to, as `GET /events` reports it. */
export interface OpenEventDto {
  id: string
  title: string
  registrationOpenAt?: string | null
  registrationCloseAt?: string | null
}

const PROFILE_HREF = '/dashboard/profile/company'
const MAX_EVENTS = 3
const MAX_MISSING = 4

const COPY: Record<EligibilityState, { title: string; description: string; action?: string }> = {
  incomplete: {
    title: 'پروفایل شرکت خود را تکمیل کنید',
    description:
      'برای ثبت‌نام در رویدادها ابتدا اطلاعات و مدارک شرکت را کامل کنید و درخواست احراز هویت بفرستید.',
    action: 'تکمیل پروفایل',
  },
  ready_to_request: {
    title: 'درخواست احراز هویت را ارسال کنید',
    description:
      'پرونده شرکت کامل است. پس از ارسال و تأیید دبیرخانه می‌توانید در رویدادها ثبت‌نام کنید.',
    action: 'ارسال برای احراز هویت',
  },
  returned: {
    title: 'پروفایل شرکت نیاز به اصلاح دارد',
    description: 'دبیرخانه پرونده را برگردانده است. موارد خواسته‌شده را اصلاح و دوباره ارسال کنید.',
    action: 'اصلاح پروفایل',
  },
  pending: {
    title: 'احراز هویت شرکت در حال بررسی است',
    description: 'ثبت‌نام در رویدادها پس از تأیید دبیرخانه فعال می‌شود.',
  },
  rejected: {
    title: 'احراز هویت شرکت رد شده است',
    description: 'تا تأیید دوباره، ثبت‌نام در رویدادها امکان‌پذیر نیست.',
    action: 'مشاهده پروفایل',
  },
  approved: {
    title: 'ثبت‌نام در رویدادها',
    description: 'شرکت شما احراز هویت شده است و می‌توانید در رویدادهای زیر درخواست ثبت کنید.',
  },
}

function registrationWindow(event: OpenEventDto): string {
  const { registrationOpenAt: open, registrationCloseAt: close } = event
  if (open && close) return `ثبت‌نام از ${formatDate(open)} تا ${formatDate(close)}`
  if (close) return `مهلت ثبت‌نام تا ${formatDate(close)}`
  if (open) return `ثبت‌نام از ${formatDate(open)}`
  return 'ثبت‌نام باز است'
}

/** Events whose registration has not closed, soonest to close first (open-ended ones last). */
export function openEvents(items: readonly OpenEventDto[], now: Date): OpenEventDto[] {
  const time = (value?: string | null) => (value ? Date.parse(value) : Number.POSITIVE_INFINITY)
  return items
    .filter((event) => time(event.registrationCloseAt) >= now.getTime())
    .sort((a, b) => time(a.registrationCloseAt) - time(b.registrationCloseAt))
}

/**
 * The company's way into events. A company that has not finished joining sees what is left on its
 * profile, and the events it can register for once that is done; an approved company sees the same
 * events as its place to start an application. The server re-checks eligibility on every submit.
 */
export function CompanyOnboardingCard({
  eligibility,
  events,
  eventsNotice,
  returnTo = '/dashboard',
}: {
  eligibility: Eligibility
  events?: OpenEventDto[]
  eventsNotice?: UnavailableReason
  returnTo?: string
}) {
  const copy = COPY[eligibility.state]
  const links = missingSectionLinks(eligibility.missingRequired, returnTo)
  const fields = links.flatMap((group) => group.fields)
  const profileHref = links[0]?.href ?? PROFILE_HREF
  const approved = eligibility.state === 'approved'

  return (
    <Card
      role="region"
      aria-label="شروع ثبت‌نام در رویدادها"
      className="grid gap-6 rounded-[10px] border-neutral-200 bg-background px-6 py-5 shadow-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
    >
      <div className="flex flex-col gap-3 rounded-[10px] bg-brand-50 p-5">
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-[10px] bg-background text-brand-600 [&_svg]:size-[22px]"
        >
          <CompanyBuildingIcon />
        </span>
        <Typography as="h2" variant="title" color="neutral-800">
          {copy.title}
        </Typography>
        <Typography as="p" variant="14/regular" color="neutral-600">
          {copy.description}
        </Typography>
        {fields.length ? (
          <ul className="flex flex-col gap-1">
            {fields.slice(0, MAX_MISSING).map((field) => (
              <li key={field.key}>
                <Typography as="span" variant="12/regular" color="neutral-600">
                  {field.label}
                </Typography>
              </li>
            ))}
            {fields.length > MAX_MISSING ? (
              <li>
                <Typography as="span" variant="12/regular" color="neutral-500">
                  و {fa(fields.length - MAX_MISSING)} مورد دیگر
                </Typography>
              </li>
            ) : null}
          </ul>
        ) : null}
        {copy.action ? (
          <Button size="40" className="mt-auto w-fit" asChild>
            <Link href={profileHref}>{copy.action}</Link>
          </Button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Typography as="h3" variant="title" color="neutral-800">
            {approved ? 'رویدادهای باز برای ثبت‌نام' : 'رویدادهای قابل ثبت‌نام پس از تکمیل پروفایل'}
          </Typography>
          <Button size="32" variant="text" className="shrink-0" asChild>
            <Link href="/dashboard/events">همه رویدادها</Link>
          </Button>
        </div>
        {eventsNotice || !events ? (
          <OfflineNotice reason={eventsNotice ?? 'unavailable'} retryHref="/dashboard" />
        ) : events.length ? (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {events.slice(0, MAX_EVENTS).map((event) => (
              <li key={event.id}>
                <Link
                  href={`/dashboard/events?eventId=${encodeURIComponent(event.id)}`}
                  className="flex items-center gap-3 rounded-md py-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-600 [@media(hover:hover)]:hover:text-brand-700"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 [&_svg]:size-5"
                  >
                    <CalendarBulkIcon />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Typography as="span" variant="14/semibold" color="neutral-800">
                      {event.title}
                    </Typography>
                    <Typography as="span" variant="12/regular" color="neutral-500">
                      {registrationWindow(event)}
                    </Typography>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Typography as="p" variant="14/regular" color="neutral-500">
            در حال حاضر رویدادی برای ثبت‌نام باز نیست.
          </Typography>
        )}
      </div>
    </Card>
  )
}
