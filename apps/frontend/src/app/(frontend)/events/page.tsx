import type { Metadata } from 'next'
import {
  EventDetailRoute,
  generateEventDetailMetadata,
} from '@/components/landing/event-detail/event-detail-route'

export default function EventsPage() {
  return <EventDetailRoute collection="events" />
}

export function generateMetadata(): Promise<Metadata> {
  return generateEventDetailMetadata({ collection: 'events' })
}
