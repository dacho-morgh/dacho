import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PersonalInfoSection } from '@/components/dashboard/profile/personal-info-section'
import type { DashboardNavigation } from '@/components/dashboard/sidebar-shell'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { ownAccountOf } from '@/utilities/own-account'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'اطلاعات پروفایل',
}

export default async function StaffProfilePage() {
  const user = await getProfileSessionUser()
  if (!user || !isInternalUser(user)) redirect('/dashboard/profile/company')

  const capabilities = await serverDashboardFetchResult<DashboardNavigation>('/capabilities')

  return (
    <PersonalInfoSection
      initialAccount={ownAccountOf(user)}
      readOnlyFields={[
        { label: 'سمت', value: user.position ?? '' },
        { label: 'نوع دسترسی', value: capabilities.kind === 'ok' ? capabilities.data.roleLabel : '—' },
      ]}
    />
  )
}
