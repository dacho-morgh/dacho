import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'

import configPromise from '@payload-config'
import { getServerSideURL } from '@dacho/cms-core/utilities'

import { RecentActivities } from '@/components/dashboard/recent-activities'
import { RequestsTable, type RecentRequestItem, type RecentRequestServiceType } from '@/components/dashboard/requests'
import { ServicesQuickAccess, type ServiceCard } from '@/components/dashboard/services-quick-access'
import { StatCards } from '@/components/dashboard/stat-cards'
import { CompanyList } from '@/components/dashboard/company-list'
import {
  formatDate,
  type ActivityDto,
  type Paginated,
  type RequestDto,
  type RequestStats,
} from '@/utilities/dashboard-api'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پیشخوان متقاضی',
  description: 'سامانه مدیریت درخواست‌ها، طرح‌ها و پیگیری فرآیندهای خدمات کارخانه نوآوری بوشهر',
}

async function proxyFetch<T>(path: string, cookie: string): Promise<T | undefined> {
  try {
    const res = await fetch(`${getServerSideURL()}/api/dashboard${path}`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return undefined
    return (await res.json()) as T
  } catch {
    return undefined
  }
}

export default async function DashboardPage() {
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()
  const { user } = await payload.auth({ headers: requestHeaders })
  if (user?.role === 'staff') return <CompanyList />

  // CMS-owned definitions read server-side via Payload's local API.
  const { docs: services } = await payload.find({ collection: 'services', limit: 100 })
  const serviceCards: ServiceCard[] = services.map((s) => ({
    key: s.key ?? '',
    title: s.title,
    description: s.excerpt ?? null,
    tag: s.tag ?? null,
  })).filter((s) => s.key)

  // Application-owned instances read through the same-origin proxy.
  const cookie = (await cookies()).toString()
  const [stats, requests, activities] = await Promise.all([
    proxyFetch<RequestStats>('/stats', cookie),
    proxyFetch<Paginated<RequestDto>>('/requests?limit=10', cookie),
    proxyFetch<Paginated<ActivityDto>>('/activities?limit=10', cookie),
  ])

  const recentRequests: RecentRequestItem[] = (requests?.items ?? []).map((r) => ({
    id: r.id,
    trackingCode: r.trackingCode,
    title: r.title,
    serviceName: r.serviceName,
    serviceType: r.serviceKey as RecentRequestServiceType,
    currentStep: r.currentStep ?? '',
    assignedRole: r.assignedRole ?? '',
    status: r.status as RecentRequestItem['status'],
    submissionDate: formatDate(r.submissionDate),
    updatedAt: formatDate(r.updatedAt),
  }))

  return (
    <div className="space-y-8 p-6 pb-12 sm:p-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              سامانه فعال و متصل به دبیرخانه مرکزی
            </div>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">سلام، {user?.name || user?.email || 'کاربر'} عزیز 👋</h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-blue-100/90 sm:text-sm">
              به پیشخوان مدیریت خدمات کارخانه نوآوری خوش آمدید. می‌توانید آخرین وضعیت پرونده‌ها و درخواست‌های فعال شرکت خود را از این بخش مدیریت و پیگیری نمایید.
            </p>
          </div>

          <div className="mt-2 flex shrink-0 items-center gap-3 sm:mt-0">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 text-center backdrop-blur-md">
              <span className="block text-xs text-blue-200">کد عضویت شرکت</span>
              <span className="mt-0.5 font-mono text-base font-bold text-white">{user?.companyNationalId || '—'}</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -top-12 -left-12 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 -bottom-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-2xl" />
      </div>

      {/* 1. Quick Stats */}
      <StatCards data={stats} />

      {/* 2. Factory Services Quick Access */}
      <ServicesQuickAccess services={serviceCards} />

      {/* 3. Requests Tracking Table */}
      <RequestsTable items={recentRequests} />

      {/* 4. Recent Activities & Upcoming Deadlines */}
      <RecentActivities activityItems={activities?.items} />
    </div>
  )
}
