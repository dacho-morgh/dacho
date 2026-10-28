import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { CompanyProfileView } from '@/components/dashboard/profile/company-profile-view'
import type { DossierResponseDto, ProfileDto } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پروفایل شرکت',
}

export default async function CompanyProfilePage() {
  if (isInternalUser(await getProfileSessionUser())) redirect('/dashboard/profile/staff')

  const [profile, dossier] = await Promise.all([
    serverDashboardFetch<ProfileDto>('/profile'),
    serverDashboardFetch<DossierResponseDto>('/profile/dossier'),
  ])
  if (!profile) throw new Error('profile_load_failed')

  return <CompanyProfileView initialProfile={profile} initialDossier={dossier} />
}
