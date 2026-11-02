import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { DashboardReadNotice } from '@/components/dashboard/dashboard-read-notice'
import { ReturnToRegistration } from '@/components/dashboard/profile/return-to-registration'
import { CompanyProfileView } from '@/components/dashboard/profile/company-profile-view'
import type { CompanyVerificationDto, DossierResponseDto, ProfileDto } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پروفایل شرکت',
}

export default async function CompanyProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string }>
} = {}) {
  const returnTo = (await searchParams)?.returnTo
  if (isInternalUser(await getProfileSessionUser())) redirect('/dashboard/profile/staff')

  const [profile, dossier, verification] = await Promise.all([
    serverDashboardFetchResult<ProfileDto>('/profile'),
    serverDashboardFetchResult<DossierResponseDto>('/profile/dossier'),
    serverDashboardFetchResult<CompanyVerificationDto>('/profile/verification'),
  ])
  if (profile.kind === 'unavailable') throw new Error('profile_load_failed')
  if (profile.kind !== 'ok') {
    return <DashboardReadNotice reason={unavailableReasonFor(profile) ?? 'unavailable'} retryHref="/dashboard/profile/company" />
  }

  return (
    <>
      <ReturnToRegistration returnTo={returnTo} />
      <CompanyProfileView
        initialProfile={profile.data}
        initialDossier={dossier.kind === 'ok' ? dossier.data : undefined}
        initialVerification={verification.kind === 'ok' ? verification.data : undefined}
      />
    </>
  )
}
