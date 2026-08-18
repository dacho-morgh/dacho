import React from 'react'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-[#F8FAFC] text-slate-800 antialiased" dir="rtl">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col bg-[#F8FAFC]">
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
