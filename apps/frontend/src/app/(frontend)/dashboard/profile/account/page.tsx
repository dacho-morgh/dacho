import type { Metadata } from 'next'
import { DashboardReadNotice } from '@/components/dashboard/dashboard-read-notice'
import { AccountProfileView } from '@/components/dashboard/profile/account-profile-view'
import type { ProfileDto } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'اطلاعات حساب کاربری',
}

export default async function AccountProfilePage() {
  if (isInternalUser(await getProfileSessionUser())) redirect('/dashboard/profile/staff')

  const profile = await serverDashboardFetchResult<ProfileDto>('/profile')
  if (profile.kind === 'unavailable') throw new Error('profile_load_failed')
  if (profile.kind !== 'ok') {
    return <DashboardReadNotice reason={unavailableReasonFor(profile) ?? 'unavailable'} retryHref="/dashboard/profile/account" />
  }

  return <AccountProfileView initialProfile={profile.data} />
}
