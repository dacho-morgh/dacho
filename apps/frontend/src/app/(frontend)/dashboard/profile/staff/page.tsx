import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { StaffProfileView } from '@/components/dashboard/profile/staff-profile-view'
import type { DashboardOwnProfileDto } from '@/utilities/dashboard-api'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'
import { Typography } from '@/components/ui/typography'
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
    return (
      <div className="p-6" dir="rtl">
        <Typography role="alert" variant="16/regular" color="error">
          دریافت اطلاعات پروفایل انجام نشد. دوباره تلاش کنید.
        </Typography>
      </div>
    )
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
