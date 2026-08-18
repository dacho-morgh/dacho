'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type RecentRequestsFilterType = 'all' | 'in_review' | 'action_needed'

export interface RecentRequestsFilterTabsProps {
  filter: RecentRequestsFilterType
  onFilterChange: (filter: RecentRequestsFilterType) => void
  totalCount: number
  className?: string
}

export function RecentRequestsFilterTabs({
  filter,
  onFilterChange,
  totalCount,
  className = '',
}: RecentRequestsFilterTabsProps) {
  return (
    <div
      className={`flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div>
        <h2 className="text-base font-bold text-slate-900">
          آخرین درخواست‌ها و پیگیری فرآیندها
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          وضعیت و پیشرفت طرح‌های ارسالی به دبیرخانه کارخانه نوآوری
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              filter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            همه ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('in_review')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              filter === 'in_review'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            در حال بررسی
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('action_needed')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              filter === 'action_needed'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            نیازمند اقدام
          </button>
        </div>

        <Link href="/dashboard/requests">
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex rounded-xl text-xs gap-1.5"
          >
            مشاهده همه
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
