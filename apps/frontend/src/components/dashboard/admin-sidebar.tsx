'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  MoreOptionsIcon,
  PeopleIcon,
  BrandSandoqLogomark,
  BrandSandoqLogotype,
  DashboardIcon,
  EventsIcon,
  RequestsIcon,
  LettersIcon,
} from '@/components/icons'
import { Typography } from '@/components/ui/typography'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
const items = [
  { label: 'داشبورد', href: '/dashboard', icon: DashboardIcon },
  { label: 'شرکت ها', href: '/dashboard/admin/companies', icon: EventsIcon },
  { label: 'کارکنان', href: '/dashboard/admin/employees', icon: PeopleIcon },
  { label: 'درخواست ها', href: '/dashboard/admin/requests', icon: RequestsIcon },
  { label: 'نامه‌ها', href: '/dashboard/admin/letters', icon: LettersIcon },
  { label: 'پشتیبانی', href: '/dashboard/admin/support', icon: LettersIcon },
]
export function AdminSidebar({ user }: { user?: { name?: string | null; email?: string | null } }) {
  const pathname = usePathname()
  return (
    <Sidebar
      side="right"
      variant="sidebar"
      collapsible="offcanvas"
      className="border-l border-neutral-200 bg-white"
      dir="rtl"
    >
      <div className="flex h-full w-[268px] flex-col justify-between px-4 py-10">
        <div className="flex flex-col gap-5">
          <SidebarHeader className="p-0">
            <Link href="/dashboard" className="flex items-center justify-start gap-3 pr-2">
              <BrandSandoqLogomark className="h-10 w-[46px]" />
              <BrandSandoqLogotype className="h-10 w-[113px]" />
            </Link>
          </SidebarHeader>
          <div className="h-px w-full bg-neutral-200" />
          <SidebarContent className="p-0">
            <SidebarMenu className="flex flex-col gap-2">
              {items.map(({ label, href, icon: Icon }) => {
                const active =
                  href === '/dashboard' ? pathname === href : pathname.startsWith(href)
                return (
                  <SidebarMenuItem key={href} className="relative">
                    <div className="flex w-full items-center gap-2">
                      <span
                        className={`h-7 w-1 shrink-0 rounded-full ${active ? 'bg-brand-500' : 'bg-transparent'}`}
                      />
                      <SidebarMenuButton
                        asChild
                        className={`flex h-10 flex-1 rounded-xl px-2 ${active ? 'bg-brand-50 text-brand-600' : 'text-neutral-600 hover:bg-neutral-100'}`}
                      >
                        <Link
                          href={href}
                          className={`flex h-10 items-center gap-2 rounded-xl px-2 ${active ? 'bg-brand-50 text-brand-600' : 'text-neutral-600 hover:bg-neutral-100'}`}
                        >
                          <Icon variant={active ? 'bulk' : 'linear'} className="size-6 shrink-0" />
                          <Typography
                            variant="16/regular"
                            color={active ? 'brand-600' : 'secondary'}
                          >
                            {label}
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
          <div className="flex items-center justify-between">
            <Link href="/dashboard/profile" className="flex items-center gap-2.5">
              <Image
                src="/figma/dashboard/company-avatar.png"
                alt={user?.name || user?.email || 'کاربر'}
                width={40}
                height={40}
                className="size-10 rounded-lg object-cover"
              />
              <Typography variant="14/semibold" color="secondary">
                {user?.name || user?.email || 'کاربر'}
              </Typography>
            </Link>
            <MoreOptionsIcon className="size-6 text-neutral-600" />
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}
