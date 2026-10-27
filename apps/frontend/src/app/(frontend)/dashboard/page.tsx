import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'
import { Typography } from '@/components/ui/typography'
import { AdminRequestList } from '@/components/dashboard/admin-request-list'
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
import { dashboardOperationalRole, serverDashboardFetch } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پیشخوان متقاضی',
  description: 'سامانه مدیریت درخواست‌ها، طرح‌ها و پیگیری فرآیندهای خدمات کارخانه نوآوری بوشهر',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string }>
}) {
  const showDeniedNotice = (await searchParams).access === 'denied'
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(requestHeaders) })
  const role = dashboardOperationalRole(user)
  if (role === 'system-owner' || role === 'central-secretariat') {
    return <>{showDeniedNotice && <DeniedNotice />}<CompanyList /></>
  }
  if (role && role !== 'representative') {
    return <>{showDeniedNotice && <DeniedNotice />}<AdminRequestList /></>
  }

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
  const [stats, requests, activities] = await Promise.all([
    serverDashboardFetch<RequestStats>('/stats'),
    serverDashboardFetch<Paginated<RequestDto>>('/requests?limit=10'),
    serverDashboardFetch<Paginated<ActivityDto>>('/activities?limit=10'),
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
      {showDeniedNotice && <DeniedNotice />}
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

function DeniedNotice() {
  return (
    <Typography role="status" variant="14/regular" color="warning" className="rounded-lg border border-warning-500 bg-warning-50 p-3">
      به نشانی درخواستی دسترسی ندارید؛ پیشخوان نقش فعلی شما نمایش داده شده است.
    </Typography>
  )
}
