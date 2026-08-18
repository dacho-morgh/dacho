import React from 'react'
import type { RecentRequestServiceType } from './types'

export interface RecentRequestServiceBadgeProps {
  type: RecentRequestServiceType
  className?: string
}

export function RecentRequestServiceBadge({
  type,
  className = '',
}: RecentRequestServiceBadgeProps) {
  switch (type) {
    case 'financing':
      return (
        <span
          className={`text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-medium ${className}`}
        >
          تأمین مالی
        </span>
      )
    case 'exhibition':
      return (
        <span
          className={`text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-medium ${className}`}
        >
          نمایشگاه
        </span>
      )
    case 'event':
      return (
        <span
          className={`text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-medium ${className}`}
        >
          رویداد
        </span>
      )
    case 'knowledge':
      return (
        <span
          className={`text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-medium ${className}`}
        >
          دانش‌بنیان
        </span>
      )
    default:
      return (
        <span
          className={`text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md ${className}`}
        >
          عمومی
        </span>
      )
  }
}
