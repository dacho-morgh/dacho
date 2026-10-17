import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { StaffProfileView } from '@/components/dashboard/profile/staff-profile-view'
import type { ProfileDto } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'اطلاعات پروفایل',
}

export default async function StaffProfilePage() {
  const user = await getProfileSessionUser()
  if (!user || !isInternalUser(user)) redirect('/dashboard/profile/company')

  const profile = await serverDashboardFetch<ProfileDto>('/profile')
  if (!profile) throw new Error('profile_load_failed')

  return (
    <StaffProfileView
      initialProfile={profile}
      name={user.name ?? ''}
      position={user.position ?? ''}
      accessLabel={(user.roles ?? []).includes('admin') ? 'مدیر سامانه' : 'کارمند سامانه'}
    />
  )
}
