import React from 'react'
import { FileText, Clock, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react'

import type { RequestStats } from '@/utilities/dashboard-api'

export interface StatCardsProps {
  /** Real aggregates from GET /stats; falls back to the Figma sample when absent. */
  data?: RequestStats
}

function card(value: number, sample: string) {
  return value > 0 ? value.toLocaleString('fa-IR') : sample
}

export function StatCards({ data }: StatCardsProps) {
  const stats = [
    {
      title: 'کل درخواست‌های ثبت شده',
      value: card(data?.total ?? 0, '۸'),
      change: '+۲ در این ماه',
      changeType: 'increase' as const,
      icon: FileText,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-100',
    },
    {
      title: 'در حال بررسی و داوری',
      value: card(data?.in_review ?? 0, '۳'),
      change: '۲ مورد در مرحله دبیرخانه',
      changeType: 'neutral' as const,
      icon: Clock,
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-100',
    },
    {
      title: 'تأیید و تصویب شده',
      value: card(data?.approved ?? 0, '۴'),
      change: 'مجموع ۵۰ میلیارد ریال تسهیلات',
      changeType: 'success' as const,
      icon: CheckCircle2,
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderColor: 'border-emerald-100',
    },
    {
      title: 'نیازمند اقدام / رفع نقص',
      value: card(data?.action_needed ?? 0, '۱'),
      change: 'بارگذاری مدارک ثبتی',
      changeType: 'warning' as const,
      icon: AlertTriangle,
      bgColor: 'bg-rose-50',
      iconColor: 'text-rose-600',
      borderColor: 'border-rose-100',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon
        return (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl border ${stat.borderColor} bg-white p-5 shadow-xs transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">{stat.title}</span>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bgColor} ${stat.iconColor}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{stat.value}</span>
              <span className="text-xs text-slate-400">مورد</span>
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              {stat.changeType === 'increase' && <TrendingUp className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
              {stat.changeType === 'warning' && <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />}
              {stat.changeType === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
              <span className="truncate">{stat.change}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}