import type { Event, Exhibition } from '@dacho/cms-core'
import configPromise from '@payload-config'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import { getPayload } from 'payload'
import { Typography } from '@/components/ui/typography'
import { buildSafe } from '@/utilities/buildSafe'
import type { EventCardData } from './event-card'
import EventsCarousel from './events-carousel'

const persianDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)

  return start.toDateString() === end.toDateString()
    ? persianDateFormatter.format(start)
    : persianDateFormatter.formatRange(start, end)
}

const getCountdown = (startDate: string, endDate: string) => {
  const now = Date.now()
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()

  if (now > end) return { countdown: '', countdownLabel: 'برگزار شده' }
  if (now >= start) return { countdown: '', countdownLabel: 'در حال برگزاری' }

  return {
    countdown: String(Math.max(1, Math.ceil((start - now) / 86_400_000))),
    countdownLabel: 'روز مانده به برگزاری',
  }
}

const toCardData = (item: Event | Exhibition, kind: 'event' | 'exhibition'): EventCardData => ({
  id: `${kind}-${item.id}`,
  href: `/${kind === 'event' ? 'events' : 'exhibitions'}/${item.id}`,
  featuredImage: item.featuredImage,
  fallbackImage: kind === 'event' ? '/figma/events/event-2.jpeg' : '/figma/events/event-1.jpeg',
  tag: kind === 'event' ? 'رویداد' : 'نمایشگاه',
  title: item.title,
  description: item.description
    ? convertLexicalToPlaintext({ data: item.description }).replace(/\s+/g, ' ').trim()
    : '',
  date: formatDateRange(item.startDate, item.endDate),
  location: item.location,
  ...getCountdown(item.startDate, item.endDate),
})

const EventsSection = async () => {
  const results = await buildSafe('home events', async () => {
    const payload = await getPayload({ config: configPromise })
    return Promise.all([
      payload.find({
        collection: 'events',
        depth: 1,
        limit: 20,
        overrideAccess: false,
        sort: 'startDate',
      }),
      payload.find({
        collection: 'exhibitions',
        depth: 1,
        limit: 20,
        overrideAccess: false,
        sort: 'startDate',
      }),
    ])
  })

  if (!results) return null

  const [eventsResult, exhibitionsResult] = results

  const items = [
    ...eventsResult.docs.map((event) => toCardData(event, 'event')),
    ...exhibitionsResult.docs.map((exhibition) => toCardData(exhibition, 'exhibition')),
  ]

  if (items.length === 0) return null

  return (
    <section className="relative z-10 flex w-full flex-col items-center gap-8 px-4 py-4 lg:gap-8 lg:px-0 lg:py-10">
      <Typography as="h2" variant="32/extrabold" lg="40/extrabold" color="neutral-600">
        نمایشگاه و رویداد ها
      </Typography>
      <EventsCarousel items={items} />
    </section>
  )
}

export default EventsSection
