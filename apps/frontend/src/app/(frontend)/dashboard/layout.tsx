import configPromise from '@payload-config'
import { GeistMono } from 'geist/font/mono'
import { Menu } from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import { DashboardSidebar } from '@/components/dashboard/sidebar-shell'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import {
  DASHBOARD_RETURN_URL_HEADER,
  getLoginUrl,
  getSafeReturnUrl,
} from '@/utilities/auth-return-url'
import { isSeniorManagerUser } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'
import { cn } from '@/utilities/ui'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const returnUrl = getSafeReturnUrl(requestHeaders.get(DASHBOARD_RETURN_URL_HEADER))
  const payload = await getPayload({ config: configPromise })

  let user = null
  try {
    user = (await payload.auth({ headers: getPayloadAuthHeaders(requestHeaders) })).user
  } catch {
    // Invalid, expired, or otherwise unreadable sessions are unauthenticated.
  }

  if (!user) redirect(getLoginUrl(returnUrl))

  const isSeniorManager = await isSeniorManagerUser(payload, user)

  return (
    <SidebarProvider defaultOpen={true}>
      <div className={cn('flex min-h-screen w-full bg-[#F8FAFC] text-slate-800 antialiased', GeistMono.variable)} dir="rtl">
        <DashboardSidebar user={user} isSeniorManager={isSeniorManager} />
        <SidebarInset className="flex min-w-0 flex-1 flex-col bg-[#F8FAFC]">
          <SidebarTrigger
            aria-label="باز کردن منو"
            className="absolute top-6 left-6 z-30 size-10 rounded-[10px] text-black md:hidden"
          >
            <Menu aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </SidebarTrigger>
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
