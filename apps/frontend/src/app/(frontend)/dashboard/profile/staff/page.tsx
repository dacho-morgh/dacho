import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { StaffProfileView } from '@/components/dashboard/profile/staff-profile-view'
import type { DashboardOwnProfileDto } from '@/utilities/dashboard-api'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'
import { DashboardReadNotice } from '@/components/dashboard/dashboard-read-notice'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import type { DashboardNavigation } from '@/components/dashboard/sidebar-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'اطلاعات پروفایل',
}

export default async function StaffProfilePage() {
  const user = await getProfileSessionUser()
  if (!user || !isInternalUser(user)) redirect('/dashboard/profile/company')

  const [result, capabilityResult] = await Promise.all([
    serverDashboardFetchResult<DashboardOwnProfileDto>('/profile/me'),
    serverDashboardFetchResult<DashboardNavigation>('/capabilities'),
  ])
  if (result.kind === 'unauthenticated') redirect('/login?expired=1')
  if (result.kind !== 'ok') {
    return <DashboardReadNotice reason={unavailableReasonFor(result) ?? 'unavailable'} retryHref="/dashboard/profile/staff" />
  }

  return (
    <StaffProfileView
      initialProfile={result.data}
      name={user.name ?? ''}
      position={user.position ?? ''}
      accessLabel={capabilityResult.kind === 'ok' ? capabilityResult.data.roleLabel : '—'}
    />
  )
}
