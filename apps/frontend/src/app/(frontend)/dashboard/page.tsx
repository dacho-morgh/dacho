import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'
import { Typography } from '@/components/ui/typography'
import { AdminRequestList } from '@/components/dashboard/admin-request-list'
import { CompanyList } from '@/components/dashboard/company-list'
import { OfflineNotice } from '@/components/dashboard/offline-notice'
import { RecentActivities } from '@/components/dashboard/recent-activities'
import {
  RequestsStatusFilter,
  RequestsTable,
  parseRequestStatus,
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
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { dashboardOperationalRole, dashboardWorkspace, serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پیشخوان متقاضی',
  description: 'سامانه مدیریت درخواست‌ها، طرح‌ها و پیگیری فرآیندهای خدمات کارخانه نوآوری بوشهر',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string; status?: string }>
}) {
  const params = await searchParams
  const showDeniedNotice = params.access === 'denied'
  /** Status filter lives in the URL so back navigation and refresh keep it. */
  const status = parseRequestStatus(params.status)
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(requestHeaders) })
  const workspace = dashboardWorkspace(dashboardOperationalRole(user))
  if (workspace === 'company-dossiers') {
    return <>{showDeniedNotice && <DeniedNotice />}<CompanyList /></>
  }
  if (workspace === 'internal-queue') {
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

  // Application-owned instances read through the same-origin proxy. Results keep
  // permission/transport failures separate from genuinely empty queues.
  const [statsResult, requestsResult, activitiesResult] = await Promise.all([
    serverDashboardFetchResult<RequestStats>('/stats'),
    serverDashboardFetchResult<Paginated<RequestDto>>(
      `/requests?limit=10${status ? `&status=${status}` : ''}`,
    ),
    serverDashboardFetchResult<Paginated<ActivityDto>>('/activities?limit=10'),
  ])

  const stats = statsResult.kind === 'ok' ? statsResult.data : undefined
  const requests = requestsResult.kind === 'ok' ? requestsResult.data : undefined
  const activities = activitiesResult.kind === 'ok' ? activitiesResult.data : undefined
  const statsNotice = unavailableReasonFor(statsResult)
  const queueNotice = unavailableReasonFor(requestsResult)
  const activityNotice = unavailableReasonFor(activitiesResult)

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
      <StatCards data={stats} notice={statsNotice} activeStatus={status} />

      {/* 2. Factory Services Quick Access */}
      <ServicesQuickAccess services={serviceCards} />

      {/* 3. Requests Tracking Table — scoped by the URL status filter */}
      <section className="space-y-3" aria-label="صف درخواست‌ها">
        <RequestsStatusFilter
          basePath="/dashboard"
          active={status ?? 'all'}
          counts={{
            all: stats?.total,
            in_review: stats?.in_review,
            action_needed: stats?.action_needed,
            approved: stats?.approved,
            rejected: stats?.rejected,
          }}
        />
        {queueNotice ? (
          <OfflineNotice reason={queueNotice} retryHref="/dashboard" />
        ) : (
          <RequestsTable items={recentRequests} showFilterTabs={false} />
        )}
      </section>

      {/* 4. Recent Activities & Upcoming Deadlines */}
      <RecentActivities activityItems={activities?.items} notice={activityNotice} />
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
