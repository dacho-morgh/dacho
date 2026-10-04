'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

const applicantProfileRoutes = [
  { href: '/dashboard/profile/company', label: 'پروفایل شرکت' },
  { href: '/dashboard/profile/resume', label: 'رزومه' },
  { href: '/dashboard/profile/account', label: 'اطلاعات حساب کاربری' },
]

const staffProfileRoutes = [
  { href: '/dashboard/profile/staff', label: 'اطلاعات پروفایل' },
]

export function ProfileNavigation({ staffMode = false }: { staffMode?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isLogoutOpen, setIsLogoutOpen] = useState(false)
  const profileRoutes = staffMode ? staffProfileRoutes : applicantProfileRoutes

  const handleLogout = async () => {
    try {
      await fetch('/api/users/logout', { method: 'POST' })
    } finally {
      router.push('/login')
    }
  }

  return (
    <>
      <nav
        aria-label="بخش‌های پروفایل"
        className="grid shrink-0 grid-cols-2 gap-3 border-b border-neutral-100 pb-4 sm:grid-cols-4 lg:flex lg:w-52 lg:flex-col lg:gap-4 lg:border-e lg:border-b-0 lg:pe-3 lg:pb-0"
      >
        {profileRoutes.map((route) => {
          const isActive = pathname === route.href

          return (
            <Typography key={route.href} asChild variant="16/regular">
              <Link
                href={route.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 w-full items-center justify-between rounded-xl px-3 py-2 text-center transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-600'
                    : 'bg-transparent text-neutral-600 hover:bg-neutral-100',
                )}
              >
                <span className="w-full">{route.label}</span>
                {isActive && (
                  <span
                    className="hidden h-7 w-1 shrink-0 rounded-full bg-brand-500 lg:block"
                    aria-hidden="true"
                  />
                )}
              </Link>
            </Typography>
          )
        })}
        <Button
          type="button"
          variant="text-gray"
          size="40"
          className="text-error-500"
          onClick={() => setIsLogoutOpen(true)}
        >
          خروج از حساب کاربری
        </Button>
      </nav>

      {isLogoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-logout-title"
        >
          <section className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-5 shadow-xl">
            <Typography id="profile-logout-title" as="h2" variant="20/bold" color="neutral-600">
              خروج از حساب کاربری
            </Typography>
            <Typography variant="16/semibold" color="neutral-500">
              آیا می‌خواهید از حساب کاربری خود خارج شوید؟
            </Typography>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline-gray"
                className="flex-1"
                onClick={() => setIsLogoutOpen(false)}
              >
                انصراف
              </Button>
              <Button type="button" variant="destructive" className="flex-1" onClick={handleLogout}>
                خروج از حساب
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
