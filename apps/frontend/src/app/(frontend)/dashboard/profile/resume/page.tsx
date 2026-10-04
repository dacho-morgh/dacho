import type { Metadata } from 'next'
import { ResumeProfileView } from '@/components/dashboard/profile/resume-profile-view'
import { redirect } from 'next/navigation'
import { getProfileSessionUser, isStaffProfileUser } from '@/utilities/profile-session'

export const metadata: Metadata = {
  title: 'رزومه',
}

export default async function ResumePage() {
  if (isStaffProfileUser(await getProfileSessionUser())) redirect('/dashboard/profile/staff')

  return <ResumeProfileView />
}
