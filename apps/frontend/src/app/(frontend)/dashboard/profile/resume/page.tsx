import type { Metadata } from 'next'
import { ResumeProfileView } from '@/components/dashboard/profile/resume-profile-view'

export const metadata: Metadata = {
  title: 'رزومه',
}

export default function ResumePage() {
  return <ResumeProfileView />
}
