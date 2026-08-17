import React from 'react'
import {
  Bell,
  CheckCircle,
  FileEdit,
  MessageSquare,
  UploadCloud,
} from 'lucide-react'

export function RecentActivities() {
  const activities = [
    {
      id: 1,
      title: 'امتیازدهی داور تخصصی ثبت شد',
      description: 'داور فنی برای طرح «پلتفرم هوشمند پایش خوردگی» امتیاز ۸۲/۱۰۰ را ثبت نمود.',
      time: '۲ ساعت پیش',
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
    },
    {
      id: 2,
      title: 'صدور پیش‌فاکتور غرفه نمایشگاه',
      description: 'پیش‌فاکتور خدمات نمایشگاهی عسلویه با شماره فاکتور INV-892 صادر گردید.',
      time: 'دیروز، ساعت ۱۴:۳۰',
      icon: FileEdit,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      id: 3,
      title: 'پیام از دبیرخانه کارخانه',
      description: '«لطفاً نسخه دارای مهر و امضای دیجیتال پروپوزال را مجدداً بارگذاری فرمایید.»',
      time: '۲ روز پیش',
      icon: MessageSquare,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
  ]

  const upcomingDeadlines = [
    {
      id: 1,
      title: 'مهلت تکمیل پروپوزال رویداد سرمایه‌گذاری',
      date: 'تا ۲۵ مرداد ۱۴۰۳',
      urgent: true,
    },
    {
      id: 2,
      title: 'جلسه دفاع آنلاین با کمیته علمی و داوران',
      date: '۲۸ مرداد ۱۴۰۳ - ساعت ۱۰:۰۰',
      urgent: false,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Activity Timeline */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            رویدادها و اعلان‌های اخیر
          </h2>
          <span className="text-xs text-slate-400">۳ اعلان جدید</span>
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

      {/* Upcoming Deadlines & Profile completion status */}
      <div className="space-y-6">
        {/* Profile Completion Box */}
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-indigo-50/60 p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700">تکمیل پروفایل حقوقی</span>
            <span className="text-xs font-bold text-blue-800">۸۵٪</span>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: '85%' }} />
          </div>

          <p className="mt-3 text-xs text-slate-600 leading-relaxed">
            برای تسریع در فرآیند تسهیلات، لطفا آخرین آگهی تغییرات روزنامه رسمی را بارگذاری کنید.
          </p>

          <button className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white border border-blue-200 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors shadow-xs">
            <UploadCloud className="h-4 w-4" />
            تکمیل مدارک ثبتی
          </button>
        </div>

        {/* Deadlines */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            سررسیدها و جلسات پیش‌رو
          </h2>
          <div className="mt-4 space-y-3">
            {upcomingDeadlines.map((d) => (
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
