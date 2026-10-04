import type { Event, Exhibition } from '@dacho/cms-core'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

export type EventDetailCollection = 'events' | 'exhibitions'
export type EventDetailDocument = Event | Exhibition

function parseDocumentId(id?: string) {
  if (!id) return undefined

  const parsed = Number(id)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export const queryEventDetail = cache(
  async (collection: EventDetailCollection, id?: string): Promise<EventDetailDocument | null> => {
    const documentId = parseDocumentId(id)
    if (documentId === null) return null

    const payload = await getPayload({ config: configPromise })

    if (collection === 'events') {
      const result = await payload.find({
        collection: 'events',
        depth: 1,
        limit: 1,
        overrideAccess: false,
        pagination: false,
        sort: ['-showOnEventsPage', 'startDate'],
        ...(documentId ? { where: { id: { equals: documentId } } } : {}),
      })

      return result.docs[0] || null
    }

    const result = await payload.find({
      collection: 'exhibitions',
      depth: 1,
      limit: 1,
      overrideAccess: false,
      pagination: false,
      sort: 'startDate',
      ...(documentId ? { where: { id: { equals: documentId } } } : {}),
    })

    return result.docs[0] || null
  },
)
