'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import {
  DashboardIcon,
  RequestsIcon,
  LettersIcon,
  EventsIcon,
  MoreOptionsIcon,
  FundLogoMark,
  FundLogoType,
  type SidebarIconProps,
} from '@/components/dashboard/icons/sidebar-icons'

export interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<SidebarIconProps>
  exact?: boolean
}

const defaultNavItems: NavItem[] = [
  {
    title: 'داشبورد',
    href: '/dashboard',
    icon: DashboardIcon,
    exact: true,
  },
  {
    title: 'درخواست ها',
    href: '/dashboard/requests',
    icon: RequestsIcon,
  },
  {
    title: 'کارتابل نامه',
    href: '/dashboard/letters',
    icon: LettersIcon,
  },
  {
    title: 'رویدادها و نمایشگاه‌ها',
    href: '/dashboard/events',
    icon: EventsIcon,
  },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  companyName?: string
  fundName?: string
}

export function AppSidebar({
  companyName = 'نام شرکت نمونه',
  className,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar
      side="right"
      variant="sidebar"
      collapsible="offcanvas"
      className={`border-l border-neutral-200 bg-white font-sans ${className || ''}`}
      {...props}
    >
      <div className="flex h-full w-[268px] flex-col justify-between px-4 py-10">
        {/* Top Section: Header / Logo & Navigation Menu */}
        <div className="flex flex-col gap-6">
          {/* Header / Brand Logo & Logotype */}
          <SidebarHeader className="p-0">
            <Link
              href="/dashboard"
              className="flex items-center justify-start gap-2.5 px-1 transition-opacity hover:opacity-90"
              title="صفحه اصلی داشبورد"
            >
              {/* Logomark (46x40) */}
              <FundLogoMark className="h-10 w-[46px] shrink-0" />
              {/* Logotype (113x40) */}
              <FundLogoType className="h-10 w-[113px] shrink-0" />
            </Link>
          </SidebarHeader>

          {/* Divider Line (Vector 1) */}
          <div className="h-px w-full bg-neutral-200" />

          {/* Navigation Menu (Frame 2) */}
          <SidebarContent className="p-0 overflow-visible">
            <SidebarMenu className="flex flex-col gap-2">
              {defaultNavItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.href} className="relative">
                    <div className="flex w-full items-center gap-2">
                      {/* Active Indicator Bar (Rectangle 2 - 4x28px rounded pill) on right side in RTL */}
                      <span
                        className={`h-7 w-1 shrink-0 rounded-full transition-all duration-200 ${
                          isActive ? 'bg-[#2563EB] opacity-100' : 'bg-transparent opacity-0'
                        }`}
                        aria-hidden="true"
                      />

                      {/* Menu Button Container: active selected is #2563EB, active hover bg is #DBEAFE */}
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={`group relative flex h-10 w-full flex-1 items-center rounded-[12px] px-3 py-2 transition-all duration-150 ${
                          isActive
                            ? 'bg-[#EEF2FF] text-[#2563EB] font-semibold hover:bg-[#DBEAFE] hover:text-[#2563EB] active:bg-[#BFDBFE]'
                            : 'bg-transparent text-[#525252] font-normal hover:bg-neutral-100 hover:text-neutral-900'
                        }`}
                      >
                        <Link href={item.href} className="flex w-full items-center gap-2.5">
                          {/* Icon (24x24px): Bulk/Fill when active (#2563EB), Linear when inactive */}
                          <Icon
                            variant={isActive ? 'bulk' : 'linear'}
                            className={`size-6 shrink-0 transition-colors ${
                              isActive
                                ? 'text-[#2563EB] group-hover:text-[#2563EB]'
                                : 'text-[#525252] group-hover:text-neutral-900'
                            }`}
                          />
                          <span className="text-base leading-7 truncate">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </div>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarContent>
        </div>

        {/* Bottom Section: User / Company Card (Frame 41) */}
        <SidebarFooter className="p-0">
          <div className="flex h-10 w-full items-center justify-between">
            {/* Right: Company Avatar & Name (Frame 40) */}
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-neutral-200/80 shadow-2xs">
                <Image
                  src="/figma/dashboard/company-avatar.png"
                  alt={companyName}
                  width={40}
                  height={40}
                  className="size-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <span className="truncate text-sm font-semibold text-[#525252] leading-6">
                {companyName}
              </span>
            </div>

            {/* Left: Three Dots Action Button */}
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer"
              title="تنظیمات و گزینه‌ها"
            >
              <MoreOptionsIcon className="size-6 text-[#525252]" />
              <span className="sr-only">گزینه‌های بیشتر</span>
            </button>
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}
