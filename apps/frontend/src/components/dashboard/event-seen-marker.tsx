'use client'

import { useEffect } from 'react'

import { NAV_COUNTS_STALE_EVENT } from '@/components/dashboard/sidebar-shell'

/**
 * Tells the server a company opened this event, then asks the sidebar to read its numbers again so
 * the count of new events drops. A failed call only leaves the event counted as new; nothing on the page depends on it.
 */
export function EventSeenMarker({ eventId }: { eventId: string }) {
  useEffect(() => {
    let active = true
    fetch(`/api/dashboard/events/${encodeURIComponent(eventId)}/seen`, { method: 'POST' })
      .then((response) => {
        if (active && response.ok) window.dispatchEvent(new Event(NAV_COUNTS_STALE_EVENT))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [eventId])
  return null
}
