'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface RequestItem {
  id: string
  trackingCode: string
  title: string
  serviceName: string
  serviceType: 'financing' | 'event' | 'exhibition' | 'knowledge' | 'commercial'
  currentStep: string
  assignedRole: string
  status: 'in_review' | 'action_needed' | 'approved' | 'rejected'
  submissionDate: string
  updatedAt: string
}

const mockRequests: RequestItem[] = [
  {
    id: 'req-101',
    trackingCode: 'DCH-1403-8821',
    title: 'توسعه پلتفرم هوشمند پایش خوردگی خطوط انتقال نفت',
    serviceName: 'تأمین مالی و سرمایه‌گذاری',
    serviceType: 'financing',
    currentStep: 'بررسی کمیته داوران تخصصی',
    assignedRole: 'داور فنی',
    status: 'in_review',
    submissionDate: '۱۴۰۳/۰۵/۱۲',
    updatedAt: '۲ ساعت پیش',
  },
  {
    id: 'req-102',
    trackingCode: 'DCH-1403-7749',
    title: 'رزرو غرفه اختصاصی در نمایشگاه بین‌المللی نفت و گاز عسلویه',
    serviceName: 'خدمات نمایشگاهی',
    serviceType: 'exhibition',
    currentStep: 'صدور پیش‌فاکتور و پرداخت',
    assignedRole: 'واحد حسابداری',
    status: 'action_needed',
    submissionDate: '۱۴۰۳/۰۵/۱۸',
    updatedAt: 'دیروز',
  },
  {
    id: 'req-103',
    trackingCode: 'DCH-1403-6512',
    title: 'شرکت در رویداد پیچ و جذب سرمایه‌گذار خطرپذیر پتروشیمی',
    serviceName: 'رویدادها و رقابت‌ها',
    serviceType: 'event',
    currentStep: 'تأیید نهایی دبیرخانه',
    assignedRole: 'دبیرخانه رویداد',
    status: 'approved',
    submissionDate: '۱۴۰۳/۰۴/۲۹',
    updatedAt: '۳ روز پیش',
  },
  {
    id: 'req-104',
    trackingCode: 'DCH-1403-5490',
    title: 'مشاوره ارزیابی و اخذ گواهی دانش‌بنیان نوع ۱',
    serviceName: 'خدمات دانش‌بنیانی',
    serviceType: 'knowledge',
    currentStep: 'جلسه منتورینگ و تنظیم اظهارنامه',
    assignedRole: 'مشاور تخصصی',
    status: 'in_review',
    submissionDate: '۱۴۰۳/۰۴/۱۵',
    updatedAt: '۱ هفته پیش',
  },
]

export function RequestsTable() {
  const [filter, setFilter] = useState<string>('all')

  const filteredRequests = filter === 'all'
    ? mockRequests
    : mockRequests.filter((r) => r.status === filter)

  const getStatusBadge = (status: RequestItem['status']) => {
    switch (status) {
      case 'in_review':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200/60">
            <Clock className="h-3 w-3 text-amber-500" />
            در حال بررسی
          </span>
        )
      case 'action_needed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 border border-rose-200/60">
            <AlertCircle className="h-3 w-3 text-rose-500" />
            نیازمند اقدام
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/60">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            تأیید شده
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            رد شده
          </span>
        )
    }
  }

  const getServiceBadge = (type: RequestItem['serviceType']) => {
    switch (type) {
      case 'financing':
        return <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-medium">تأمین مالی</span>
      case 'exhibition':
        return <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-medium">نمایشگاه</span>
      case 'event':
        return <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-medium">رویداد</span>
      case 'knowledge':
        return <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-medium">دانش‌بنیان</span>
      default:
        return <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">عمومی</span>
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
      {/* Table Header / Filter Toolbar */}
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">آخرین درخواست‌ها و پیگیری فرآیندها</h2>
          <p className="text-xs text-slate-500 mt-0.5">وضعیت و پیشرفت طرح‌های ارسالی به دبیرخانه کارخانه نوآوری</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-medium">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه ({mockRequests.length})
            </button>
            <button
              onClick={() => setFilter('in_review')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                filter === 'in_review' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              در حال بررسی
            </button>
            <button
              onClick={() => setFilter('action_needed')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                filter === 'action_needed' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              نیازمند اقدام
            </button>
          </div>

          <Link href="/dashboard/requests">
            <Button variant="outline" size="sm" className="hidden sm:inline-flex rounded-xl text-xs gap-1.5">
              مشاهده همه
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50/75 text-xs text-slate-500 font-semibold border-b border-slate-100">
            <tr>
              <th className="px-5 py-3.5">کد رهگیری / عنوان طرح</th>
              <th className="px-5 py-3.5">نوع خدمت</th>
              <th className="px-5 py-3.5">گام جاری (مسئول رسیدگی)</th>
              <th className="px-5 py-3.5">وضعیت</th>
              <th className="px-5 py-3.5">تاریخ ثبت</th>
              <th className="px-5 py-3.5 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRequests.map((req) => (
              <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 line-clamp-1">{req.title}</span>
                    <span className="text-xs font-mono text-slate-400 mt-0.5">{req.trackingCode}</span>
                  </div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {getServiceBadge(req.serviceType)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-800">{req.currentStep}</span>
                    <span className="text-xs text-slate-400">عهده: {req.assignedRole}</span>
                  </div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {getStatusBadge(req.status)}
                </td>
                <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                  {req.submissionDate}
                </td>
                <td className="px-5 py-4 text-center whitespace-nowrap">
                  <Link href={`/dashboard/requests/${req.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <Eye className="h-3.5 w-3.5 ml-1" />
                      پیگیری
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
