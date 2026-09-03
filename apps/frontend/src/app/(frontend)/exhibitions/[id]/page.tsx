import type { Metadata } from 'next'
import {
  EventDetailRoute,
  generateEventDetailMetadata,
} from '@/components/landing/event-detail/event-detail-route'

type Args = {
  params: Promise<{ id: string }>
}

export default async function ExhibitionPage({ params }: Args) {
  const { id } = await params
  return <EventDetailRoute collection="exhibitions" id={decodeURIComponent(id)} />
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { id } = await params
  return generateEventDetailMetadata({ collection: 'exhibitions', id: decodeURIComponent(id) })
}
