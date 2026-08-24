import { Menu } from 'lucide-react'
import type { Metadata } from 'next'
import React from 'react'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'

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
          <SidebarTrigger
            aria-label="باز کردن منو"
            className="absolute top-6 left-6 z-30 size-10 rounded-[10px] text-black md:hidden"
          >
            <Menu aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </SidebarTrigger>
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
