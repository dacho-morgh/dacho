import React from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'

import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
import { formatDate, type ActivityDto } from '@/utilities/dashboard-api'

export interface RecentActivitiesProps {
  /** Recent activity log from GET /activities. */
  activityItems?: ActivityDto[]
  /** Set when /activities could not be read. */
  notice?: UnavailableReason
}

export function RecentActivities({ activityItems, notice }: RecentActivitiesProps) {
  const activities =
    activityItems?.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description ?? '',
      time: formatDate(a.at),
      // Only activities bound to a request get a next-action link; the API has
      // already scoped the list to this actor, so the target is permitted.
      href: a.requestId ? `/dashboard/requests/${encodeURIComponent(a.requestId)}` : null,
      icon: Bell,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    })) ?? []

  const upcomingDeadlines: { id: string; title: string; date: string; urgent: boolean }[] = []

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Activity Timeline */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            رویدادها و اعلان‌های اخیر
          </h2>
          <span className="text-xs text-slate-400">{activities.length.toLocaleString('fa-IR')} اعلان</span>
        </div>

        {notice ? (
          <OfflineNotice reason={notice} retryHref="/dashboard" className="mt-5" />
        ) : activities.length === 0 ? (
          <p className="mt-5 text-xs text-slate-500">اعلان جدیدی ثبت نشده است.</p>
        ) : (
          <div className="mt-5 space-y-4">
            {activities.map((act) => {
              const Icon = act.icon
              const body = (
                <>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${act.bgColor} ${act.iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">{act.title}</h3>
                      <span className="text-[11px] text-slate-400 font-mono">{act.time}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{act.description}</p>
                    {act.href && (
                      <span className="mt-1 inline-block text-[11px] font-semibold text-blue-700">
                        مشاهده و اقدام
                      </span>
                    )}
                  </div>
                </>
              )
              const className = 'flex items-start gap-4 rounded-xl p-3 hover:bg-slate-50 transition-colors'
              return act.href ? (
                <Link key={act.id} href={act.href} className={className}>
                  {body}
                </Link>
              ) : (
                <div key={act.id} className={className}>
                  {body}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming deadlines */}
      <div className="space-y-6">
        {/* Deadlines */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            سررسیدها و جلسات پیش‌رو
          </h2>
          <div className="mt-4 space-y-3">
            {upcomingDeadlines.length === 0 ? <p className="text-xs text-slate-400">سررسید ثبت نشده است.</p> : upcomingDeadlines.map((d) => (
              <div
                key={d.id}
                className={`rounded-xl border p-3 ${
                  d.urgent ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-slate-50/50'
                }`}
              >
                <p className="text-xs font-bold text-slate-800 leading-snug">{d.title}</p>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={d.urgent ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                    {d.date}
                  </span>
                  {d.urgent && (
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800 text-[10px]">
                      فوری
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
