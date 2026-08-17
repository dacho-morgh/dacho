import type { Metadata } from 'next'
import React from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { StatCards } from '@/components/dashboard/stat-cards'
import { ServicesQuickAccess } from '@/components/dashboard/services-quick-access'
import { RequestsTable } from '@/components/dashboard/requests-table'
import { RecentActivities } from '@/components/dashboard/recent-activities'

export const metadata: Metadata = {
  title: 'پیشخوان متقاضی | کارخانه نوآوری تخصصی نفت، گاز و پتروشیمی',
  description: 'سامانه مدیریت درخواست‌ها، طرح‌ها و پیگیری فرآیندهای خدمات کارخانه نوآوری بوشهر',
}

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-6 sm:p-8 text-white shadow-xl shadow-blue-900/10">
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md mb-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                سامانه فعال و متصل به دبیرخانه مرکزی
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                سلام، مهندس سجادی عزیز 👋
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-2xl">
                به پیشخوان مدیریت خدمات کارخانه نوآوری خوش آمدید. می‌توانید آخرین وضعیت پرونده‌ها، امتیازات داوری و درخواست‌های فعال شرکت «پترو داده‌آوران پارس» را از این بخش مدیریت و پیگیری نمایید.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 mt-2 sm:mt-0">
              <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-md border border-white/15 text-center">
                <span className="block text-xs text-blue-200">کد عضویت شرکت</span>
                <span className="text-base font-bold font-mono text-white mt-0.5">DCH-CORP-9402</span>
              </div>
            </div>
          </div>

          {/* Decorative subtle background shapes */}
          <div className="pointer-events-none absolute -left-12 -top-12 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute right-1/4 -bottom-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-2xl" />
        </div>

        {/* 1. Quick Stats */}
        <StatCards />

        {/* 2. Factory Services Quick Access */}
        <ServicesQuickAccess />

        {/* 3. Requests Tracking Table */}
        <RequestsTable />

        {/* 4. Recent Activities & Upcoming Deadlines */}
        <RecentActivities />
      </div>
    </DashboardLayout>
  )
}
