import type { Metadata } from 'next'
import { CompanyProfileView } from '@/components/dashboard/profile/company-profile-view'
import type { ProfileDto } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پروفایل شرکت',
}

export default async function CompanyProfilePage() {
  if (isInternalUser(await getProfileSessionUser())) redirect('/dashboard/profile/staff')

  const profile = await serverDashboardFetch<ProfileDto>('/profile')
  if (!profile) throw new Error('profile_load_failed')

  return <CompanyProfileView initialProfile={profile} />
}
