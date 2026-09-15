import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ProfileNavigation } from '@/components/dashboard/profile/profile-navigation'
import { Typography } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: 'صفحه پروفایل',
  description: 'مدیریت اطلاعات حساب کاربری، اطلاعات شرکت و رزومه متقاضی',
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="flex min-h-screen w-full flex-col gap-6 bg-neutral-50 p-4 sm:p-6 lg:p-10"
      dir="rtl"
    >
      <Typography as="h1" variant="24/bold" color="neutral-800">
        صفحه پروفایل
      </Typography>
      <div className="flex min-h-[880px] flex-col items-stretch gap-6 rounded-2xl border border-neutral-100 bg-white p-4 shadow-xs sm:p-6 lg:flex-row lg:gap-8">
        <ProfileNavigation />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </main>
  )
}
