'use client'
import { usePathname } from 'next/navigation'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { AdminSidebar } from '@/components/dashboard/admin-sidebar'
export function DashboardSidebar({ user }: { user?: { role?: string | null; cmsRole?: string | null; name?: string | null; email?: string | null; companyName?: string | null } }) {
  const pathname = usePathname()
  return pathname.startsWith('/dashboard/admin') || user?.role === 'staff' ? <AdminSidebar user={user} /> : <AppSidebar companyName={user?.companyName || user?.name || 'پروفایل شرکت'} />
}
