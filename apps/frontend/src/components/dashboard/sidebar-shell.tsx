'use client'

import { AppSidebar, type SidebarUser } from '@/components/dashboard/app-sidebar'

export interface DashboardNavigation {
  role: string
  roleLabel: string
  responsibilities: string[]
  destinations: string[]
}

export function DashboardSidebar({
  user,
  navigation,
}: {
  user?: SidebarUser | null
  navigation: DashboardNavigation
}) {
  return <AppSidebar user={user} navigation={navigation} />
}
