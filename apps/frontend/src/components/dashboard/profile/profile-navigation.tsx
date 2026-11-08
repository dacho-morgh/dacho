'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
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
  const [isLogoutOpen, setIsLogoutOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const profileRoutes = staffMode ? staffProfileRoutes : applicantProfileRoutes

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setLogoutError(null)
    try {
      const response = await fetch('/api/users/logout', { method: 'POST', cache: 'no-store' })
      if (!response.ok) throw new Error('logout_failed')
      window.location.replace('/login?loggedOut=1')
    } catch {
      setLogoutError('خروج از حساب انجام نشد. ارتباط را بررسی کنید و دوباره تلاش کنید.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <Sheet open={isLogoutOpen} onOpenChange={setIsLogoutOpen}>
      <nav
        aria-label="بخش‌های پروفایل"
        dir="rtl"
        className="grid shrink-0 grid-cols-2 gap-3 border-b border-neutral-100 pb-4 sm:grid-cols-4 lg:sticky lg:top-10 lg:flex lg:w-52 lg:flex-col lg:gap-4 lg:self-start lg:border-e lg:border-b-0 lg:pe-2 lg:pb-0"
      >
        {profileRoutes.map((route) => {
          const isActive = pathname === route.href

          return (
            <div key={route.href} className="flex w-full items-center gap-2">
              <span
                className={cn(
                  'hidden h-7 w-1 shrink-0 rounded-full lg:block',
                  isActive ? 'bg-brand-500' : 'bg-transparent',
                )}
                aria-hidden="true"
              />
              <Typography
                asChild
                variant="16/regular"
                color={isActive ? 'brand-600' : 'neutral-600'}
                className="min-w-0 flex-1"
              >
                <Link
                  href={route.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-h-10 w-full items-center rounded-xl px-3 py-2 text-start transition-colors',
                    isActive
                      ? 'bg-brand-50 hover:bg-brand-100'
                      : 'bg-transparent hover:bg-neutral-100 hover:text-neutral-900',
                  )}
                >
                  {route.label}
                </Link>
              </Typography>
            </div>
          )
        })}
        <div className="flex w-full items-center gap-2">
          <span className="hidden h-7 w-1 shrink-0 lg:block" aria-hidden="true" />
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="text-destructive"
              size="40"
              className="flex-1 justify-start rounded-xl px-3 text-start text-error-600"
              onClick={() => setLogoutError(null)}
            >
              خروج از حساب کاربری
            </Button>
          </SheetTrigger>
        </div>
      </nav>

      <SheetContent side="center" showCloseButton={false} overlayClassName="bg-black/40" className="gap-5">
        <SheetTitle asChild>
          <Typography as="h2" variant="20/bold" color="neutral-600">
            خروج از حساب کاربری
          </Typography>
        </SheetTitle>
        <SheetDescription asChild>
          <Typography variant="16/semibold" color="neutral-500">
            آیا می‌خواهید از حساب کاربری خود خارج شوید؟
          </Typography>
        </SheetDescription>
        {logoutError && (
          <Typography role="alert" variant="14/regular" color="error" className="rounded-lg bg-error-50 p-3">
            {logoutError}
          </Typography>
        )}
        <div className="flex gap-2">
          <Button size="40"
            type="button"
            variant="outline-gray"
            className="flex-1"
            disabled={isLoggingOut}
            onClick={() => setIsLogoutOpen(false)}
          >
            انصراف
          </Button>
          <Button size="40" type="button" variant="destructive" className="flex-1" loading={isLoggingOut} onClick={handleLogout}>
            خروج از حساب
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
