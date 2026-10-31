import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { DashboardReadNotice } from '@/components/dashboard/dashboard-read-notice'
import { ResumeProfileView } from '@/components/dashboard/profile/resume-profile-view'
import type { DossierResponseDto, ProfileDto } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'رزومه شرکت',
}

export default async function ResumePage() {
  if (isInternalUser(await getProfileSessionUser())) redirect('/dashboard/profile/staff')

  const [profile, dossier] = await Promise.all([
    serverDashboardFetchResult<ProfileDto>('/profile'),
    serverDashboardFetchResult<DossierResponseDto>('/profile/dossier'),
  ])

  if (profile.kind === 'unavailable') throw new Error('profile_load_failed')
  if (profile.kind !== 'ok') {
    return <DashboardReadNotice reason={unavailableReasonFor(profile) ?? 'unavailable'} retryHref="/dashboard/profile/resume" />
  }
  if (!profile.data.companyId) throw new Error('profile_load_failed')

  return (
    <ResumeProfileView
      initialDossier={dossier.kind === 'ok' ? dossier.data : undefined}
      companyId={profile.data.companyId}
    />
  )
}
