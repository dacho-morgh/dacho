'use client'

import { usePathname } from 'next/navigation'
import React from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'

/**
 * List pages own their scrolling: the page stays fixed and only the list or
 * table region scrolls (each list wraps itself in a ScrollArea).
 */
const LIST_ROUTES = new Set([
  '/dashboard/requests',
  '/dashboard/letters',
  '/dashboard/inbox',
  '/dashboard/companies',
  '/dashboard/employees',
  '/dashboard/events',
  '/dashboard/exhibitions',
])

/** A company's detail screens fill the page; their section tabs stay put and only the open section scrolls. */
const COMPANY_DETAIL_PREFIX = '/dashboard/companies/'

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname().replace(/\/$/, '')

  if (LIST_ROUTES.has(pathname) || pathname.startsWith(COMPANY_DETAIL_PREFIX)) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
  }

  // Forms and detail pages have no list to scroll; they scroll inside the shell, never the page.
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:flex [&>div]:min-h-full [&>div]:flex-col">
      {children}
    </ScrollArea>
  )
}
