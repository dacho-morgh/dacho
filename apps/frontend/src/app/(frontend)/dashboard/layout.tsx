import type { Metadata } from 'next'
import React from 'react'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
