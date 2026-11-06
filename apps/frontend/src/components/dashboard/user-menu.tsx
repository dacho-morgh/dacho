'use client'

import Link from 'next/link'
import React from 'react'
import { toast } from 'sonner'
import {
  LogoutIcon,
  MoreOptionsIcon,
  ProfileUserIcon,
  ThemeMoonIcon,
  ThemeSunIcon,
  ThemeSystemIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Typography } from '@/components/ui/typography'
import { useTheme } from '@/providers/Theme'
import type { ThemePreference } from '@/providers/Theme/types'

const themeOptions: {
  value: ThemePreference
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}[] = [
  { value: 'system', label: 'سیستم', icon: ThemeSystemIcon },
  { value: 'light', label: 'روشن', icon: ThemeSunIcon },
  { value: 'dark', label: 'تاریک', icon: ThemeMoonIcon },
]

export function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { preference, setPreference } = useTheme()
  const [open, setOpen] = React.useState(false)
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const response = await fetch('/api/users/logout', { method: 'POST', cache: 'no-store' })
      if (!response.ok) throw new Error('logout_failed')
      window.location.replace('/login?loggedOut=1')
    } catch {
      toast.error('خروج از حساب انجام نشد. ارتباط را بررسی کنید و دوباره تلاش کنید.')
      setIsLoggingOut(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="text-gray"
          size="icon-32"
          title="تنظیمات و گزینه‌ها"
          className="shrink-0 group-data-[collapsible=icon]:hidden"
        >
          <MoreOptionsIcon aria-hidden="true" className="size-6" />
          <span className="sr-only">گزینه‌های بیشتر</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent side="top" align="end" className="flex flex-col gap-1">
        <Button
          asChild
          variant="text-gray"
          size="40"
          className="w-full justify-start px-3"
        >
          <Link
            href="/dashboard/profile"
            onClick={() => {
              setOpen(false)
              onNavigate?.()
            }}
          >
            <ProfileUserIcon aria-hidden="true" />
            <Typography as="span" variant="14/regular">
              پروفایل
            </Typography>
          </Link>
        </Button>

        <div className="flex min-h-10 items-center justify-between gap-3 ps-3 pe-1">
          <Typography as="span" variant="14/regular" color="neutral-600">
            تم
          </Typography>
          <div
            role="group"
            aria-label="تم نمایش"
            className="flex items-center gap-0.5 rounded-full bg-neutral-100 p-0.5"
          >
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                variant="segment"
                size="icon-32"
                aria-pressed={preference === value}
                aria-label={label}
                title={label}
                className="rounded-full"
                onClick={() => setPreference(value)}
              >
                <Icon aria-hidden="true" className="size-4" />
              </Button>
            ))}
          </div>
        </div>

        <div className="my-0.5 h-px bg-neutral-200" aria-hidden="true" />

        <Button
          type="button"
          variant="text-destructive"
          size="40"
          loading={isLoggingOut}
          className="w-full justify-start px-3"
          onClick={handleLogout}
        >
          <LogoutIcon aria-hidden="true" />
          <Typography as="span" variant="14/regular">
            خروج از حساب
          </Typography>
        </Button>
      </PopoverContent>
    </Popover>
  )
}
