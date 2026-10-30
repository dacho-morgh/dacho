import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { EventsView, type EventItem } from '@/components/dashboard/events-view'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return {
    title: `مشاهده رویداد ${id}`,
    description: 'مشاهده مشخصات رویداد، دسته‌بندی‌ها، زیرعنوان‌ها و دانلود RFP',
  }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage(props: PageProps) {
  const { id } = await props.params
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const isOwner = dashboardOperationalRole(user) === 'system-owner'

  // Try finding the event by ID in Payload CMS events collection
  let eventDoc: Record<string, unknown> | null = null
  try {
    eventDoc = (await payload.findByID({
      collection: 'events',
      id,
      depth: 1,
    })) as unknown as Record<string, unknown>
  } catch {
    eventDoc = null
  }

  // If not found in Payload, create synthetic event representation with the ID
  const eventItem: EventItem = eventDoc
    ? mapEvent(eventDoc, 'events')
    : {
        id: `events-${id}`,
        rawId: id,
        serviceKey: 'events',
        title: 'رویداد انتخابی',
        badgeText: 'در حال برگزاری',
        badgeType: 'active',
        dates: 'تاریخ رویداد',
        location: 'محل برگزاری ثبت نشده است',
        hasActionButton: true,
        actionButtonText: 'ثبت درخواست',
      }

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#fafafa] px-4 pt-6 pb-12 sm:px-6 sm:pt-10 lg:px-8">
      <EventsView
        initialEventsList={[eventItem]}
        state="default"
        isOwner={isOwner}
        initialSelectedEventId={id}
      />
    </div>
  )
}

function mapEvent(
  item: Record<string, unknown>,
  serviceKey: 'events' | 'exhibitions',
): EventItem {
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
    rawId: String(item.id),
    serviceKey,
    title: String(item.title ?? ''),
    description: extractDescription(item.description),
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
  }
}

function extractDescription(desc: unknown): string {
  if (typeof desc === 'string') return desc
  if (!desc || typeof desc !== 'object') return ''
  try {
    const root = (
      desc as {
        root?: {
          children?: Array<{ text?: string; children?: Array<{ text?: string }> }>
        }
      }
    ).root
    if (root?.children) {
      return root.children
        .flatMap((c) => (c.text ? [c.text] : (c.children?.map((sub) => sub.text ?? '') ?? [])))
        .filter(Boolean)
        .join(' ')
    }
  } catch {
    return ''
  }
  return ''
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
