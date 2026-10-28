import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { EventsView, type EventItem } from '@/components/dashboard/events-view'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'رویدادها و نمایشگاه‌ها',
  description: 'مشاهده، ثبت‌نام و رزرو پاویون‌های اختصاصی در رویدادها و نمایشگاه‌های صنعتی و نوآوری',
}

interface PageProps {
  searchParams?: Promise<{ state?: 'default' | 'loading' | 'empty' }>
}

export default async function EventsPage(props: PageProps) {
  const searchParams = await props.searchParams
  const state = searchParams?.state ?? 'default'
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const isOwner = dashboardOperationalRole(user) === 'system-owner'

  const [eventResult, exhibitionResult] = await Promise.all([
    payload.find({ collection: 'events', limit: 100, depth: 1, sort: 'startDate' }),
    payload.find({ collection: 'exhibitions', limit: 100, depth: 1, sort: 'startDate' }),
  ])
  const events = [
    ...eventResult.docs.map((item) => mapEvent(item, 'events')),
    ...exhibitionResult.docs.map((item) => mapEvent(item, 'exhibitions')),
  ].sort((left, right) => left.startTimestamp - right.startTimestamp)

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#fafafa] px-4 pt-6 pb-12 sm:px-6 sm:pt-10 lg:px-8">
      <EventsView initialEventsList={events} state={state} isOwner={isOwner} />
    </div>
  )
}

function mapEvent(
  item: {
    id: number | string
    title?: unknown
    status?: unknown
    startDate?: unknown
    endDate?: unknown
    location?: unknown
    featuredImage?: unknown
  },
  serviceKey: 'events' | 'exhibitions',
): EventItem & { startTimestamp: number } {
  const status =
    item.status === 'past' ? 'ended' : item.status === 'ongoing' ? 'active' : 'upcoming'
  const startDate = typeof item.startDate === 'string' ? item.startDate : ''
  const endDate = typeof item.endDate === 'string' ? item.endDate : ''
  const media =
    item.featuredImage && typeof item.featuredImage === 'object'
      ? (item.featuredImage as { url?: unknown; sizes?: { small?: { url?: unknown } } })
      : null
  return {
    id: `${serviceKey}-${item.id}`,
    serviceKey,
    title: String(item.title ?? ''),
    badgeText: status === 'ended' ? 'تمام شده' : status === 'active' ? 'در حال برگزاری' : 'پیش رو',
    badgeType: status as 'ended' | 'active' | 'upcoming',
    dates: formatDateRange(startDate, endDate),
    location: String(item.location ?? 'محل برگزاری ثبت نشده است'),
    imageSrc:
      typeof media?.sizes?.small?.url === 'string'
        ? media.sizes.small.url
        : typeof media?.url === 'string'
          ? media.url
          : undefined,
    hasActionButton: status !== 'ended',
    actionButtonText: 'ثبت درخواست',
    startTimestamp: startDate ? new Date(startDate).getTime() : Number.MAX_SAFE_INTEGER,
  }
}

function formatDateRange(start: string, end: string): string {
  if (!start) return 'تاریخ ثبت نشده است'
  const formatter = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const first = formatter.format(new Date(start))
  if (!end) return first
  return `${first} تا ${formatter.format(new Date(end))}`
}
