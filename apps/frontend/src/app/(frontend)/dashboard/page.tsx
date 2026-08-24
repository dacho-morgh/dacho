import type { Metadata } from 'next'
import React from 'react'
import { RecentActivities } from '@/components/dashboard/recent-activities'
import { RequestsTable } from '@/components/dashboard/requests'
import { ServicesQuickAccess } from '@/components/dashboard/services-quick-access'
import { StatCards } from '@/components/dashboard/stat-cards'

export const metadata: Metadata = {
  title: 'پیشخوان متقاضی',
  description: 'سامانه مدیریت درخواست‌ها، طرح‌ها و پیگیری فرآیندهای خدمات کارخانه نوآوری بوشهر',
}

export default function DashboardPage() {
  return (
    <div className="space-y-8 p-6 pb-12 sm:p-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              سامانه فعال و متصل به دبیرخانه مرکزی
            </div>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">
              سلام، مهندس سجادی عزیز 👋
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-blue-100/90 sm:text-sm">
              به پیشخوان مدیریت خدمات کارخانه نوآوری خوش آمدید. می‌توانید آخرین وضعیت پرونده‌ها،
              امتیازات داوری و درخواست‌های فعال شرکت «پترو داده‌آوران پارس» را از این بخش مدیریت و
              پیگیری نمایید.
            </p>
          </div>

          <div className="mt-2 flex shrink-0 items-center gap-3 sm:mt-0">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 text-center backdrop-blur-md">
              <span className="block text-xs text-blue-200">کد عضویت شرکت</span>
              <span className="mt-0.5 font-mono text-base font-bold text-white">DCH-CORP-9402</span>
            </div>
          </div>
        </div>

        {/* Decorative subtle background shapes */}
        <div className="pointer-events-none absolute -top-12 -left-12 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
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
  )
}
