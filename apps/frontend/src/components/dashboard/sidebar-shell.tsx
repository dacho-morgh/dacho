'use client'
import { usePathname } from 'next/navigation'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { AdminSidebar } from '@/components/dashboard/admin-sidebar'
export function DashboardSidebar() {
  const pathname = usePathname()
  return pathname.startsWith('/dashboard/admin') ? <AdminSidebar /> : <AppSidebar />
}
