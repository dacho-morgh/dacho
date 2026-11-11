'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
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
  SidebarCollapseIcon,
  SidebarExpandIcon,
  type SidebarIconProps,
  BrandSandoqLogomark,
  BrandSandoqLogotype,
} from '@/components/icons'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { UserMenu } from './user-menu'
import type { DashboardNavCounts, DashboardNavigation } from './sidebar-shell'

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
  '/dashboard/letters': { title: 'کارتابل نامه', icon: LettersIcon },
  '/dashboard/events': { title: 'رویدادها و نمایشگاه‌ها', icon: EventsIcon },
  '/dashboard/exhibitions': { title: 'مدیریت نمایشگاه‌ها', icon: EventsIcon },
}

export interface SidebarUser {
  name?: string | null
  email?: string | null
}

/** The destinations that carry a number, and which count belongs to each. */
const COUNT_KEY: Record<string, keyof DashboardNavCounts> = {
  '/dashboard/letters': 'letters',
  '/dashboard/requests': 'requests',
  '/dashboard/events': 'events',
}

const MAX_SHOWN_COUNT = 99

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: SidebarUser | null
  navigation: DashboardNavigation
  counts?: DashboardNavCounts
  companyName?: string
}

export function AppSidebar({
  user,
  navigation,
  counts,
  companyName,
  className,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const isCollapsed = !isMobile && state === 'collapsed'
  const navItems = navigation.destinations.flatMap((href) => {
    const item = knownDestinations[href]
    return item ? [{ ...item, href }] : []
  })
  useGSAP(
    () => {
      gsap.fromTo(
        '[data-sidebar-anim]',
        { autoAlpha: 0, x: 8 },
        { autoAlpha: 1, x: 0, duration: 0.25, ease: 'power2.out', stagger: 0.03, delay: 0.08 },
      )
    },
    { scope: rootRef, dependencies: [isCollapsed] },
  )
  const displayName = companyName || user?.name || user?.email || 'حساب کاربری'
  const responsibility = navigation.responsibilities[0]

  return (
    <Sidebar
      side="right"
      variant="sidebar"
      collapsible="icon"
      className={`border-l border-neutral-200 bg-background font-sans ${className || ''}`}
      {...props}
    >
      <div
        ref={rootRef}
        className="flex h-full w-full min-w-0 flex-col justify-between overflow-hidden px-4 py-10 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <div className="flex flex-col gap-6">
          <SidebarHeader className="flex flex-row items-center justify-between gap-2 p-0 group-data-[collapsible=icon]:justify-center">
            {isCollapsed ? (
              <Button
                type="button"
                variant="text-gray"
                size="icon-40"
                onClick={toggleSidebar}
                aria-label="باز کردن سایدبار"
                aria-expanded={false}
                aria-keyshortcuts="Control+B Meta+B"
                title="باز کردن سایدبار (Ctrl+B)"
                className="group/logo relative"
              >
                <BrandSandoqLogomark className="h-8 w-[37px] shrink-0 dark:brightness-0 dark:invert transition-opacity group-hover/logo:opacity-0 group-focus-visible/logo:opacity-0" />
                <SidebarExpandIcon
                  aria-hidden="true"
                  className="absolute size-6 scale-x-[-1] text-neutral-600 opacity-0 transition-opacity group-hover/logo:opacity-100 group-focus-visible/logo:opacity-100"
                />
              </Button>
            ) : (
              <Link
                href="/dashboard"
                className="flex items-center justify-start gap-2 px-1 transition-opacity hover:opacity-90"
                title="صفحه اصلی داشبورد"
              >
                <BrandSandoqLogomark className="h-8 w-[37px] shrink-0 dark:brightness-0 dark:invert" />
                <BrandSandoqLogotype data-sidebar-anim className="h-8 w-[90px] shrink-0 dark:brightness-0 dark:invert" />
              </Link>
            )}
            {isMobile || isCollapsed ? null : (
              <SidebarTrigger
                aria-label="جمع کردن سایدبار"
                aria-expanded
                aria-keyshortcuts="Control+B Meta+B"
                title="جمع کردن سایدبار (Ctrl+B)"
                data-sidebar-anim
                className="size-8 shrink-0 rounded-lg text-neutral-600"
              >
                <SidebarCollapseIcon aria-hidden="true" className="size-6 scale-x-[-1]" />
              </SidebarTrigger>
            )}
          </SidebarHeader>

          <div className="h-px w-full bg-neutral-200" />

          <SidebarContent className="overflow-visible p-0">
            <SidebarMenu className="flex flex-col gap-4">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon
                const key = COUNT_KEY[item.href]
                const count = key ? (counts?.[key] ?? 0) : 0
                const countLabel = count > MAX_SHOWN_COUNT ? `+${MAX_SHOWN_COUNT.toLocaleString('fa-IR')}` : count.toLocaleString('fa-IR')

                return (
                  <SidebarMenuItem key={item.href} className="relative">
                    <div className="flex w-full items-center gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
                      <span
                        className={`h-7 w-1 shrink-0 group-data-[collapsible=icon]:hidden rounded-full ${isActive ? 'bg-brand-500' : 'bg-transparent'}`}
                        aria-hidden="true"
                      />
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={isActive}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false)
                        }}
                        className={`group relative flex h-10 w-full flex-1 items-center rounded-xl p-2 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:rounded-xl transition-colors ${
                          isActive
                            ? 'bg-brand-50 font-normal text-brand-600 hover:bg-brand-100 hover:text-brand-600 active:bg-brand-200'
                            : 'bg-transparent font-normal text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                        }`}
                      >
                        <Link
                          href={item.href}
                          className="flex w-full items-center gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                          aria-label={
                            isCollapsed
                              ? count > 0
                                ? `${item.title}، ${countLabel} مورد`
                                : item.title
                              : undefined
                          }
                        >
                          <Icon
                            variant={isActive ? 'bulk' : 'linear'}
                            className={`size-6 shrink-0 transition-colors ${
                              isActive ? 'text-brand-600' : 'text-neutral-600'
                            }`}
                          />
                          <Typography
                            as="span"
                            variant="16/regular"
                            // Typography defaults to text-foreground; inherit so the active label takes the button's brand-600.
                            className="truncate text-inherit group-data-[collapsible=icon]:hidden"
                            data-sidebar-anim
                          >
                            {item.title}
                          </Typography>
                          {count > 0 && (
                            <>
                              {/* Expanded: the number sits at the end of the row. Collapsed: a dot on the icon. */}
                              <span
                                data-testid={`nav-count-${key}`}
                                className="ms-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-500 px-1.5 group-data-[collapsible=icon]:hidden"
                              >
                                <Typography as="span" variant="12/regular" className="leading-none text-white">
                                  {countLabel}
                                </Typography>
                                <span className="sr-only"> مورد جدید</span>
                              </span>
                              <span
                                aria-hidden="true"
                                className="absolute end-1 top-1 hidden size-2.5 rounded-full bg-brand-500 ring-2 ring-background group-data-[collapsible=icon]:block"
                              />
                            </>
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

        <SidebarFooter className="p-0">
          <div className="flex min-h-10 w-full items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
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
              <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                <Typography
                  as="span"
                  variant="14/semibold"
                  color="neutral-600"
                  className="truncate"
                >
                  {displayName}
                </Typography>
                <Typography as="span" variant="12/regular" color="neutral-400" className="truncate">
                  {navigation.roleLabel}
                  {responsibility ? ` · ${responsibility}` : ''}
                </Typography>
              </span>
            </Link>

            <UserMenu onNavigate={() => isMobile && setOpenMobile(false)} />
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}
