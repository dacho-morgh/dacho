'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import {
  DashboardIcon,
  RequestsIcon,
  LettersIcon,
  EventsIcon,
  PeopleIcon,
  MoreOptionsIcon,
  type SidebarIconProps,
  BrandSandoqLogomark,
  BrandSandoqLogotype,
} from '@/components/icons'
import { Typography } from '@/components/ui/typography'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import type { DashboardNavigation } from './sidebar-shell'

export interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<SidebarIconProps>
  exact?: boolean
}

const knownDestinations: Record<string, Omit<NavItem, 'href'>> = {
  '/dashboard': { title: 'داشبورد', icon: DashboardIcon, exact: true },
  '/dashboard/companies': { title: 'شرکت‌ها', icon: EventsIcon },
  '/dashboard/employees': { title: 'کارکنان', icon: PeopleIcon },
  '/dashboard/requests': { title: 'درخواست‌ها', icon: RequestsIcon },
  '/dashboard/letters': { title: 'نامه‌ها', icon: LettersIcon },
  '/dashboard/events': { title: 'رویدادها و نمایشگاه‌ها', icon: EventsIcon },
  '/dashboard/profile': { title: 'پروفایل', icon: MoreOptionsIcon },
}

export interface SidebarUser {
  name?: string | null
  email?: string | null
}

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: SidebarUser | null
  navigation: DashboardNavigation
  companyName?: string
}

export function AppSidebar({ user, navigation, companyName, className, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const navItems = navigation.destinations.flatMap((href) => {
    const item = knownDestinations[href]
    return item ? [{ ...item, href }] : []
  })
  const displayName = companyName || user?.name || user?.email || 'حساب کاربری'
  const responsibility = navigation.responsibilities[0]

  return (
    <Sidebar
      side="right"
      variant="sidebar"
      collapsible="offcanvas"
      className={`border-l border-neutral-200 bg-white font-sans ${className || ''}`}
      {...props}
    >
      <div className="flex h-full w-[268px] flex-col justify-between px-4 py-10">
        <div className="flex flex-col gap-6">
          <SidebarHeader className="p-0">
            <Link
              href="/dashboard"
              className="flex items-center justify-start gap-2.5 px-1 transition-opacity hover:opacity-90"
              title="صفحه اصلی داشبورد"
            >
              <BrandSandoqLogomark className="h-10 w-[46px] shrink-0" />
              <BrandSandoqLogotype className="h-10 w-[113px] shrink-0" />
            </Link>
          </SidebarHeader>

          <div className="h-px w-full bg-neutral-200" />

          <SidebarContent className="overflow-visible p-0">
            <SidebarMenu className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.href} className="relative">
                    <div className="flex w-full items-center gap-2">
                      <span
                        className={`h-7 w-1 shrink-0 rounded-full ${isActive ? 'bg-brand-500' : 'bg-transparent'}`}
                        aria-hidden="true"
                      />
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={`group relative flex h-10 w-full flex-1 items-center rounded-xl px-3 py-2 transition-colors ${
                          isActive
                            ? 'bg-brand-50 font-normal text-brand-600 hover:bg-brand-100 hover:text-brand-600 active:bg-brand-200'
                            : 'bg-transparent font-normal text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                        }`}
                      >
                        <Link href={item.href} className="flex w-full items-center gap-2.5">
                          <Icon
                            variant={isActive ? 'bulk' : 'linear'}
                            className={`size-6 shrink-0 transition-colors ${
                              isActive ? 'text-brand-600' : 'text-neutral-600'
                            }`}
                          />
                          <Typography as="span" variant="16/regular" className="truncate leading-7">
                            {item.title}
                          </Typography>
                        </Link>
                      </SidebarMenuButton>
                    </div>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarContent>
        </div>

        <SidebarFooter className="p-0">
          <div className="flex min-h-10 w-full items-center justify-between gap-2">
            <Link
              href="/dashboard/profile"
              className="flex min-w-0 items-center gap-2.5 overflow-hidden transition-opacity hover:opacity-85"
              title="مشاهده پروفایل"
            >
              <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-neutral-200/80 shadow-2xs">
                <Image
                  src="/figma/dashboard/company-avatar.png"
                  alt=""
                  width={40}
                  height={40}
                  className="size-full object-cover"
                  onError={(event) => event.currentTarget.remove()}
                />
              </div>
              <span className="flex min-w-0 flex-col">
                <Typography as="span" variant="14/semibold" color="neutral-600" className="truncate">
                  {displayName}
                </Typography>
                <Typography as="span" variant="12/regular" color="neutral-400" className="truncate">
                  {navigation.roleLabel}{responsibility ? ` · ${responsibility}` : ''}
                </Typography>
              </span>
            </Link>

            <Link
              href="/dashboard/profile"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              title="تنظیمات و گزینه‌ها"
            >
              <MoreOptionsIcon className="size-6 text-neutral-600" />
              <span className="sr-only">گزینه‌های بیشتر</span>
            </Link>
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}
