import { redirect } from 'next/navigation'
import { getProfileSessionUser, isInternalUser } from '@/utilities/profile-session'

export default async function ProfilePage() {
  const user = await getProfileSessionUser()
  redirect(isInternalUser(user) ? '/dashboard/profile/staff' : '/dashboard/profile/company')
}
