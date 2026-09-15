'use client'

import { AppSidebar, type SidebarUser } from '@/components/dashboard/app-sidebar'

export function DashboardSidebar({
  user,
  isSeniorManager,
}: {
  user?: SidebarUser | null
  isSeniorManager?: boolean
}) {
  return <AppSidebar user={user} isSeniorManager={isSeniorManager} />
}
