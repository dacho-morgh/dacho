import { redirect } from 'next/navigation'
import { getProfileSessionUser, isStaffProfileUser } from '@/utilities/profile-session'

export default async function ProfilePage() {
  const user = await getProfileSessionUser()
  redirect(isStaffProfileUser(user) ? '/dashboard/profile/staff' : '/dashboard/profile/company')
}
