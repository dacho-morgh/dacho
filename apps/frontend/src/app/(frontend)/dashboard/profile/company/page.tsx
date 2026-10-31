import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { DashboardReadNotice } from '@/components/dashboard/dashboard-read-notice'
import { CompanyProfileView } from '@/components/dashboard/profile/company-profile-view'
import type { DossierResponseDto, ProfileDto } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پروفایل شرکت',
}

export default async function CompanyProfilePage() {
  if (isInternalUser(await getProfileSessionUser())) redirect('/dashboard/profile/staff')

  const [profile, dossier] = await Promise.all([
    serverDashboardFetchResult<ProfileDto>('/profile'),
    serverDashboardFetchResult<DossierResponseDto>('/profile/dossier'),
  ])
  if (profile.kind === 'unavailable') throw new Error('profile_load_failed')
  if (profile.kind !== 'ok') {
    return <DashboardReadNotice reason={unavailableReasonFor(profile) ?? 'unavailable'} retryHref="/dashboard/profile/company" />
  }

  return (
    <CompanyProfileView
      initialProfile={profile.data}
      initialDossier={dossier.kind === 'ok' ? dossier.data : undefined}
    />
  )
}
