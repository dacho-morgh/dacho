import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PersonalInfoSection } from '@/components/dashboard/profile/personal-info-section'
import { ownAccountOf } from '@/utilities/own-account'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'اطلاعات حساب کاربری',
}

export default async function AccountProfilePage() {
  const user = await getProfileSessionUser()
  if (!user) redirect('/login?expired=1')
  if (isInternalUser(user)) redirect('/dashboard/profile/staff')

  return (
    <PersonalInfoSection
      initialAccount={ownAccountOf(user)}
      readOnlyFields={[{ label: 'سمت در شرکت', value: user.position ?? '' }]}
    />
  )
}
