import { getServerSideURL } from '@dacho/cms-core/utilities'
import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'
import { CompanyList } from '@/components/dashboard/company-list'
import { RecentActivities } from '@/components/dashboard/recent-activities'
import {
  RequestsTable,
  type RecentRequestItem,
  type RecentRequestServiceType,
} from '@/components/dashboard/requests'
import { ServicesQuickAccess, type ServiceCard } from '@/components/dashboard/services-quick-access'
import { StatCards } from '@/components/dashboard/stat-cards'
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
  const serviceCards: ServiceCard[] = services
    .map((s) => ({
      key: s.key ?? '',
      title: s.title,
      description: s.excerpt ?? null,
      tag: s.tag ?? null,
    }))
    .filter((s) => s.key)

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
