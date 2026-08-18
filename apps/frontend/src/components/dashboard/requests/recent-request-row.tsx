import React from 'react'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RecentRequestStatusBadge } from './recent-request-status-badge'
import { RecentRequestServiceBadge } from './recent-request-service-badge'
import type { RecentRequestItem } from './types'

export interface RecentRequestRowProps {
  item: RecentRequestItem
}

export function RecentRequestRow({ item }: RecentRequestRowProps) {
  return (
    <tr className="hover:bg-slate-50/60 transition-colors">
      {/* Column 1: Tracking code & Title */}
      <td className="px-5 py-4">
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 line-clamp-1">{item.title}</span>
          <span className="text-xs font-mono text-slate-400 mt-0.5">{item.trackingCode}</span>
        </div>
      </td>

      {/* Column 2: Service Type */}
      <td className="px-5 py-4 whitespace-nowrap">
        <RecentRequestServiceBadge type={item.serviceType} />
      </td>

      {/* Column 3: Current step & role */}
      <td className="px-5 py-4">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800">{item.currentStep}</span>
          <span className="text-xs text-slate-400">عهده: {item.assignedRole}</span>
        </div>
      </td>

      {/* Column 4: Status */}
      <td className="px-5 py-4 whitespace-nowrap">
        <RecentRequestStatusBadge status={item.status} />
      </td>

      {/* Column 5: Submission Date */}
      <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
        {item.submissionDate}
      </td>

      {/* Column 6: Operations */}
      <td className="px-5 py-4 text-center whitespace-nowrap">
        <Link href={`/dashboard/requests/${item.id}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg px-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <Eye className="h-3.5 w-3.5 ml-1" />
            پیگیری
          </Button>
        </Link>
      </td>
    </tr>
  )
}
