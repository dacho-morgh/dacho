'use client'

import React, { useState } from 'react'
import {
  RecentRequestsFilterTabs,
  type RecentRequestsFilterType,
} from './recent-requests-filter-tabs'
import { RecentRequestRow } from './recent-request-row'
import type { RecentRequestItem } from './types'

export interface RequestsTableProps {
  items?: RecentRequestItem[]
  className?: string
  /** False when the page owns the filter in the URL (server-side scoped queue). */
  showFilterTabs?: boolean
}

export function RequestsTable({
  items = [],
  className = '',
  showFilterTabs = true,
}: RequestsTableProps) {
  const [filter, setFilter] = useState<RecentRequestsFilterType>('all')

  const filteredRequests =
    filter === 'all'
      ? items
      : items.filter((r) => r.status === filter)

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-xs ${className}`}
    >
      {/* Table Header / Filter Toolbar */}
      {showFilterTabs ? (
        <RecentRequestsFilterTabs
          filter={filter}
          onFilterChange={setFilter}
          totalCount={items.length}
        />
      ) : (
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-base font-bold text-slate-900">
            آخرین درخواست‌ها و پیگیری فرآیندها
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            وضعیت و پیشرفت طرح‌های ارسالی به دبیرخانه کارخانه نوآوری
          </p>
        </div>
      )}

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
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                  درخواستی در این وضعیت موجود نیست؛ وضعیت دیگری را انتخاب کنید.
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => (
                <RecentRequestRow key={req.id} item={req} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
