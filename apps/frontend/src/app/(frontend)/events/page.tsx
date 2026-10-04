import configPromise from '@payload-config'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { EventsCalendarIcon, EventsLocationIcon } from '@/components/icons/generated'
import { Typography } from '@/components/ui/typography'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createPageMetadata({ title: 'رویدادها', path: '/events' })

const dateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Tehran',
})

export default async function EventsPage() {
  const payload = await getPayload({ config: configPromise })
  const { docs: events } = await payload.find({
    collection: 'events',
    depth: 1,
    overrideAccess: false,
    pagination: false,
    sort: ['-showOnEventsPage', 'startDate'],
    select: {
      title: true,
      description: true,
      featuredImage: true,
      startDate: true,
      endDate: true,
      location: true,
      metadata: true,
    },
  })

  if (events.length === 1) {
    redirect(`/events/${events[0].id}`)
  }

  return (
    <main className="overflow-x-clip bg-white" dir="rtl">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pt-28 pb-20 sm:px-6">
        <Typography as="h1" variant="24/bold" lg="40/bold" color="neutral-600">
          رویدادها
        </Typography>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const image =
              event.featuredImage && typeof event.featuredImage === 'object'
                ? event.featuredImage
                : null
            const imageUrl = image ? getMediaUrl(image.url, image.updatedAt) : ''
            const description = event.description
              ? convertLexicalToPlaintext({ data: event.description }).replace(/\s+/gu, ' ').trim()
              : ''
            return (
              <article key={event.id} className="h-full">
                <Link
                  href={`/events/${event.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-[32px] border border-neutral-200 bg-white focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  {imageUrl && (
                    <div className="relative aspect-[4/3] bg-neutral-100">
                      <Image
                        alt={image?.alt || ''}
                        src={imageUrl}
                        fill
                        sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-4 p-6">
                    {event.metadata?.eventType && (
                      <Typography as="span" variant="14/regular" color="primary">
                        {event.metadata.eventType}
                      </Typography>
                    )}
                    <Typography as="h2" variant="20/bold" lg="24/bold" color="neutral-800">
                      {event.title}
                    </Typography>
                    {description && (
                      <Typography
                        variant="14/regular"
                        lg="16/regular"
                        color="neutral-500"
                        className="line-clamp-3"
                      >
                        {description}
                      </Typography>
                    )}
                    <div className="mt-auto flex flex-col gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <EventsCalendarIcon
                          aria-hidden="true"
                          className="size-6 shrink-0 text-brand-500"
                        />
                        <Typography variant="14/regular" color="neutral-600">
                          {event.metadata?.dateText ||
                            dateFormatter.format(new Date(event.startDate))}
                        </Typography>
                      </div>
                      <div className="flex items-center gap-2">
                        <EventsLocationIcon
                          aria-hidden="true"
                          className="size-6 shrink-0 text-brand-500"
                        />
                        <Typography variant="14/regular" color="neutral-600">
                          {event.location}
                        </Typography>
                      </div>
                    </div>
                  </div>
                </Link>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
