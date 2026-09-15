import React from 'react'
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import type { RecentRequestStatus } from './types'

export interface RecentRequestStatusBadgeProps {
  status: RecentRequestStatus
  className?: string
}

export function RecentRequestStatusBadge({
  status,
  className = '',
}: RecentRequestStatusBadgeProps) {
  switch (status) {
    case 'draft':
      return (
        <span className={`inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ${className}`}>
          پیش‌نویس
        </span>
      )
    case 'in_review':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200/60 ${className}`}
        >
          <Clock className="h-3 w-3 text-amber-500" />
          در حال بررسی
        </span>
      )
    case 'action_needed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 border border-rose-200/60 ${className}`}
        >
          <AlertCircle className="h-3 w-3 text-rose-500" />
          نیازمند اقدام
        </span>
      )
    case 'approved':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/60 ${className}`}
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          تأیید شده
        </span>
      )
    case 'rejected':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ${className}`}
        >
          رد شده
        </span>
      )
  }
}
