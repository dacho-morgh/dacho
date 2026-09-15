import type { Metadata } from 'next'
import { CompanyProfileView } from '@/components/dashboard/profile/company-profile-view'
import type { ProfileDto } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پروفایل شرکت',
}

export default async function CompanyProfilePage() {
  const profile = await serverDashboardFetch<ProfileDto>('/profile')
  if (!profile) throw new Error('profile_load_failed')

  return <CompanyProfileView initialProfile={profile} />
}
