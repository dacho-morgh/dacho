import type { Metadata } from 'next'
import {
  EventDetailRoute,
  generateEventDetailMetadata,
} from '@/components/landing/event-detail/event-detail-route'

export default function ExhibitionsPage() {
  return <EventDetailRoute collection="exhibitions" />
}

export function generateMetadata(): Promise<Metadata> {
  return generateEventDetailMetadata({ collection: 'exhibitions' })
}
