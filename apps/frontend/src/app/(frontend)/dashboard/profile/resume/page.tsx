import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ResumeProfileView } from '@/components/dashboard/profile/resume-profile-view'
import type { DossierResponseDto, ProfileDto } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'رزومه شرکت',
}

export default async function ResumePage() {
  if (isInternalUser(await getProfileSessionUser())) redirect('/dashboard/profile/staff')

  const [profile, dossier] = await Promise.all([
    serverDashboardFetch<ProfileDto>('/profile'),
    serverDashboardFetch<DossierResponseDto>('/profile/dossier'),
  ])

  if (!profile?.companyId) throw new Error('profile_load_failed')

  return <ResumeProfileView initialDossier={dossier} companyId={profile.companyId} />
}
