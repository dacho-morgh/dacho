'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { AppSidebar, type SidebarUser } from '@/components/dashboard/app-sidebar'

export interface DashboardNavigation {
  role: string
  roleLabel: string
  responsibilities: string[]
  destinations: string[]
}

/** What waits on the person, by destination: unread mail, requests to act on, events not opened yet. */
export interface DashboardNavCounts {
  letters?: number
  requests?: number
  events?: number
}

/** A page that changed what the numbers count (an event opened, a ticket read) asks the sidebar to read them again. */
export const NAV_COUNTS_STALE_EVENT = 'dacho:nav-counts-stale'

const REFRESH_INTERVAL_MS = 60_000

export function DashboardSidebar({
  user,
  navigation,
  counts: initialCounts,
}: {
  user?: SidebarUser | null
  navigation: DashboardNavigation
  counts?: DashboardNavCounts
}) {
  const pathname = usePathname()
  const [counts, setCounts] = useState(initialCounts)

  // A layout is not rendered again when the person moves between pages, so the numbers are read
  // here: after each navigation, when a page says they changed, and now and then while it stays open.
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/nav-counts', { cache: 'no-store' })
      if (response.ok) setCounts((await response.json()) as DashboardNavCounts)
    } catch {
      // Keep the numbers on screen; they are a hint, not the data of the page.
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [pathname, refresh])

  useEffect(() => {
    const onStale = () => void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener(NAV_COUNTS_STALE_EVENT, onStale)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(onVisible, REFRESH_INTERVAL_MS)
    return () => {
      window.removeEventListener(NAV_COUNTS_STALE_EVENT, onStale)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [refresh])

  return <AppSidebar user={user} navigation={navigation} counts={counts} />
}
