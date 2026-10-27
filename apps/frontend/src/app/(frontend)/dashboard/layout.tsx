import { isActiveAccount } from '@cms-core/access/roles'
import configPromise from '@payload-config'
import { GeistMono } from 'geist/font/mono'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import { MenuIcon } from '@/components/icons'
import { DashboardSidebar, type DashboardNavigation } from '@/components/dashboard/sidebar-shell'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Typography } from '@/components/ui/typography'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  DASHBOARD_RETURN_URL_HEADER,
  getLoginUrl,
  getSafeReturnUrl,
} from '@/utilities/auth-return-url'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'
import { cn } from '@/utilities/ui'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

function AccessState({ denied, href = '/dashboard' }: { denied: boolean; href?: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-neutral-50 p-5" dir="rtl">
      <section className="w-full max-w-lg space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <Typography as="h1" variant="24/bold" color="neutral-800">
          {denied ? 'دسترسی به این بخش مجاز نیست' : 'دریافت دسترسی انجام نشد'}
        </Typography>
        <Typography as="p" variant="16/regular" color="neutral-600">
          {denied
            ? 'این نشانی در محدوده دسترسی فعلی حساب شما نیست.'
            : 'ارتباط با سرویس دسترسی برقرار نشد. دوباره تلاش کنید یا به پیشخوان برگردید.'}
        </Typography>
        <Button asChild>
          <Link href={href}>{denied ? 'رفتن به پیشخوان' : 'تلاش دوباره'}</Link>
        </Button>
      </section>
    </main>
  )
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

  const hasSessionCookie = requestHeaders.get('cookie')?.split(';').some((part) => part.trim().startsWith('payload-token=')) ?? false
  if (!user || !isActiveAccount(user) || user.backendService) {
    redirect(getLoginUrl(returnUrl, { expired: hasSessionCookie }))
  }

  if (!user.operationalRole && user.contentEditor === true) redirect('/admin')

  const capabilityResult = await serverDashboardFetchResult<DashboardNavigation>('/capabilities')
  if (capabilityResult.kind === 'unauthenticated') redirect(getLoginUrl(returnUrl, { expired: true }))
  if (capabilityResult.kind === 'denied') return <AccessState denied />
  if (capabilityResult.kind === 'unavailable') return <AccessState denied={false} />

  const requestedPath = requestHeaders.get('x-dacho-dashboard-path') || '/dashboard'
  const accessResult = await serverDashboardFetchResult<{ allowed: boolean }>(
    `/access?path=${encodeURIComponent(requestedPath)}`,
  )
  if (accessResult.kind === 'unauthenticated') redirect(getLoginUrl(returnUrl, { expired: true }))
  if (accessResult.kind === 'denied') return <AccessState denied />
  if (accessResult.kind === 'unavailable') return <AccessState denied={false} />
  if (!accessResult.data.allowed) {
    return <AccessState denied href={capabilityResult.data.destinations[0] || '/dashboard'} />
  }

  const navigation = capabilityResult.data

  return (
    <SidebarProvider defaultOpen={true}>
      <div
        className={cn(
          'flex min-h-svh w-full overflow-x-clip bg-neutral-50 text-neutral-800 antialiased',
          GeistMono.variable,
        )}
        dir="rtl"
      >
        <DashboardSidebar
          user={{ name: user.name, email: user.email }}
          navigation={navigation}
        />
        <SidebarInset className="flex min-w-0 flex-1 flex-col bg-neutral-50">
          <SidebarTrigger
            aria-label="باز کردن منو"
            className="absolute top-6 left-6 z-30 size-10 rounded-[10px] text-black md:hidden"
          >
            <MenuIcon aria-hidden="true" className="size-6" />
          </SidebarTrigger>
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
