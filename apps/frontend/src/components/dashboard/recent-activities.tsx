import React from 'react'
import { Bell } from 'lucide-react'

import { formatDate, type ActivityDto } from '@/utilities/dashboard-api'

export interface RecentActivitiesProps {
  /** Recent activity log from GET /activities. */
  activityItems?: ActivityDto[]
}

export function RecentActivities({ activityItems }: RecentActivitiesProps) {
  const activities =
    activityItems?.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description ?? '',
      time: formatDate(a.at),
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

        <div className="mt-5 space-y-4">
          {activities.map((act) => {
            const Icon = act.icon
            return (
              <div key={act.id} className="flex items-start gap-4 rounded-xl p-3 hover:bg-slate-50 transition-colors">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${act.bgColor} ${act.iconColor}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">{act.title}</h3>
                    <span className="text-[11px] text-slate-400 font-mono">{act.time}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{act.description}</p>
                </div>
              </div>
            )
          })}
        </div>
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
