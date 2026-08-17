'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
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
} from '@/components/dashboard/icons/sidebar-icons'

export interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
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
  fundName = 'نام صندوق',
  className,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar
      side="right"
      variant="sidebar"
      collapsible="offcanvas"
      className={`border-l border-slate-100 bg-white font-sans ${className || ''}`}
      {...props}
    >
      <div className="flex h-full w-[268px] flex-col justify-between px-4 py-10">
        {/* Top Section: Header & Menu */}
        <div className="flex flex-col gap-5">
          {/* Header / Fund Brand (Frame 38) */}
          <SidebarHeader className="p-0">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2.5 transition-opacity hover:opacity-90"
            >
              {/* Fund Logo Badge */}
              <div className="relative flex h-7 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <Image
                  src="/figma/dashboard/fund-logo.png"
                  alt={fundName}
                  width={40}
                  height={28}
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    // Fallback to vector icon if image fails to render
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>

              {/* Fund Name */}
              <span className="text-xl font-bold tracking-tight text-[#2563EB]">
                {fundName}
              </span>
            </Link>
          </SidebarHeader>

          {/* Divider Line (Vector 1) */}
          <div className="h-px w-full bg-slate-100" />

          {/* Navigation Menu (Frame 2) */}
          <SidebarContent className="p-0 overflow-visible">
            <SidebarMenu className="flex flex-col gap-3">
              {defaultNavItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.href} className="relative">
                    <div className="flex w-full items-center gap-2">
                      {/* Active Indicator Bar (Rectangle 2 - 4x28px rounded) */}
                      <span
                        className={`h-7 w-1 shrink-0 rounded-full transition-all duration-200 ${
                          isActive ? 'bg-[#3B82F6] opacity-100' : 'bg-transparent opacity-0'
                        }`}
                        aria-hidden="true"
                      />

                      {/* Menu Button Container */}
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={`group relative flex h-10 w-full flex-1 items-center justify-between rounded-xl px-3 transition-all duration-150 ${
                          isActive
                            ? 'bg-[#EEF2FF] text-[#2563EB] font-medium shadow-none'
                            : 'bg-transparent text-[#525252] font-normal hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Link href={item.href} className="flex w-full items-center justify-between">
                          {/* Right: Icon & Label */}
                          <div className="flex items-center gap-2">
                            <Icon
                              className={`h-6 w-6 shrink-0 transition-colors ${
                                isActive ? 'text-[#2563EB]' : 'text-[#525252] group-hover:text-slate-900'
                              }`}
                            />
                            <span className="text-base leading-7 truncate">{item.title}</span>
                          </div>

                          {/* Left: Chevron / Accessory for active item */}
                          {isActive ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[#2563EB]" />
                          ) : (
                            <span className="w-4" />
                          )}
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
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg shadow-sm border border-slate-100/80">
                <Image
                  src="/figma/dashboard/company-avatar.png"
                  alt={companyName}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="truncate text-sm font-semibold text-[#525252] leading-6">
                {companyName}
              </span>
            </div>

            {/* Left: Three Dots Action Button */}
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="تنظیمات و خروج"
            >
              <MoreOptionsIcon className="h-6 w-6 text-[#525252]" />
              <span className="sr-only">گزینه‌های بیشتر</span>
            </button>
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}
