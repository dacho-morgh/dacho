import type { EventItem } from '@/components/dashboard/events-view'

/** An operational event and the public CMS page it is shown by (`GET /events`, S5). */
export type OperationalEvent = { id: string; publicEventId: string | null }

export function operationalEventIds(items: OperationalEvent[] | undefined): Map<string, string> {
  return new Map(
    (items ?? []).flatMap((item) => (item.publicEventId ? [[item.publicEventId, item.id] as const] : [])),
  )
}

/**
 * A company chooses an event by its public page but applies to the operational
 * event behind it (S5). A page with no operational event takes no applications.
 */
export function withOperationalId<T extends EventItem>(item: T, ids: Map<string, string>): T {
  const operationalId = item.rawId ? ids.get(item.rawId) : undefined
  return operationalId ? { ...item, rawId: operationalId } : { ...item, hasActionButton: false }
}
