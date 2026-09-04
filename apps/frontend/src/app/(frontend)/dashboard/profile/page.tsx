import type { Metadata } from 'next'
import React from 'react'

import { ProfileView } from '@/components/dashboard/profile/profile-view'
import { type ProfileDto } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'صفحه پروفایل',
  description: 'مدیریت اطلاعات حساب کاربری، اطلاعات شرکت و آدرس‌های متقاضی',
}

export default async function ProfilePage() {
  const profile = await serverDashboardFetch<ProfileDto>('/profile')

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#fafafa]">
      <ProfileView initialProfile={profile ?? undefined} />
    </div>
  )
}
