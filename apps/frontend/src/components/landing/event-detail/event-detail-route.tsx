import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EventDetailPage from './event-detail-page'
import { type EventDetailCollection, queryEventDetail } from './query'

type EventDetailRouteProps = {
  collection: EventDetailCollection
  id?: string
}

export async function EventDetailRoute({ collection, id }: EventDetailRouteProps) {
  const document = await queryEventDetail(collection, id)
  if (!document) notFound()

  return (
    <EventDetailPage document={document} kind={collection === 'events' ? 'event' : 'exhibition'} />
  )
}

export async function generateEventDetailMetadata({
  collection,
  id,
}: EventDetailRouteProps): Promise<Metadata> {
  const document = await queryEventDetail(collection, id)

  if (!document) return {}

  const description = document.description
    ? convertLexicalToPlaintext({ data: document.description }).replace(/\s+/gu, ' ').trim()
    : 'جزئیات، زمان و محل برگزاری برنامه در کارخانه نوآوری صنایع انرژی بوشهر.'

  return {
    description,
    title: document.title,
  }
}
