import type { Metadata } from 'next'
import { AccountProfileView } from '@/components/dashboard/profile/account-profile-view'
import type { ProfileDto } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'اطلاعات حساب کاربری',
}

export default async function AccountProfilePage() {
  const profile = await serverDashboardFetch<ProfileDto>('/profile')
  if (!profile) throw new Error('profile_load_failed')

  return <AccountProfileView initialProfile={profile} />
}
