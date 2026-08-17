'use client'

import React from 'react'
import Link from 'next/link'
import {
  Bell,
  Search,
  PlusCircle,
  Award,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-[#F8FAFC] text-slate-800 antialiased" dir="rtl">
        {/* Main App Sidebar (matching Figma node 42:4331) */}
        <AppSidebar />

        {/* Main Content Inset */}
        <SidebarInset className="flex min-w-0 flex-1 flex-col bg-[#F8FAFC]">
          {/* Top Navbar */}
          <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-6 sm:px-8 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-slate-600 hover:bg-slate-100" />

              <div className="relative hidden md:block w-72 lg:w-96">
                <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجو در طرح‌ها، خدمات و اسناد..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                <Award className="h-3.5 w-3.5 text-amber-600" />
                شرکت فناور و نوآور سطح یک
              </div>

              {/* Notifications Button */}
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                title="اعلان‌ها"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 left-2 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
                </span>
              </button>

              {/* Quick Action: New Request */}
              <Link href="/dashboard/new-request">
                <Button className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20">
                  <PlusCircle className="h-4 w-4" />
                  ثبت درخواست جدید
                </Button>
              </Link>

              {/* User Avatar */}
              <div className="flex items-center gap-3 border-r border-slate-200 pr-3 mr-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-bold text-sm shadow-inner">
                  س‌د
                </div>
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-bold text-slate-800">مهندس سجادی</span>
                  <span className="text-xs text-slate-500">نماینده شرکت</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-6 sm:p-8">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
