'use client'

import { useEffect, useRef } from 'react'

/** How often an open reviewer page re-asks the server whether access still stands. */
export const REVIEWER_REVALIDATE_MS = 60_000

/**
 * Re-runs `revalidate` when the tab regains focus or becomes visible, and on a
 * fixed interval while it is visible, so a reassignment or revoked access made
 * while the page is open is reflected without a reload.
 */
export function useRevalidateOnFocus(revalidate: () => void, intervalMs = REVIEWER_REVALIDATE_MS): void {
  const latest = useRef(revalidate)
  useEffect(() => {
    latest.current = revalidate
  }, [revalidate])

  useEffect(() => {
    const run = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      latest.current()
    }
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    const timer = intervalMs > 0 ? window.setInterval(run, intervalMs) : undefined
    return () => {
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [intervalMs])
}
