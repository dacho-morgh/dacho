import type { Metadata } from 'next'
import {
  EventDetailRoute,
  generateEventDetailMetadata,
} from '@/components/landing/event-detail/event-detail-route'

type Args = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function EventPage({ params }: Args) {
  const { id } = await params
  return <EventDetailRoute collection="events" id={decodeURIComponent(id)} />
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { id } = await params
  return generateEventDetailMetadata({ collection: 'events', id: decodeURIComponent(id) })
}
