import React from 'react'
import Link from 'next/link'
import {
  Coins,
  Calendar,
  Store,
  GraduationCap,
  TrendingUp,
  ArrowLeft,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface ServiceCard {
  key: string
  title: string
  description?: string | null
  tag?: string | null
}

export interface ServicesQuickAccessProps {
  /** Services read server-side from Payload; the sample set is shown when absent. */
  services?: ServiceCard[]
}

const SAMPLE: ServiceCard[] = [
  {
    key: 'financing',
    title: 'تأمین مالی و سرمایه‌گذاری',
    description: 'جذب سرمایه، تسهیلات قرض‌الحسنه و صدور انواع ضمانت‌نامه‌های بانکی',
    tag: 'سرمایه‌گذاری',
  },
  { key: 'events', title: 'رویدادها و رقابت‌ها', description: 'ثبت‌نام در رویدادهای تخصصی نفت و گاز، ارائه به داوران و جذب حامی', tag: 'رویداد / داوری' },
  { key: 'exhibitions', title: 'خدمات نمایشگاهی', description: 'رزرو غرفه، طراحی و ساخت سازه، تبلیغات و خدمات پذیرایی در نمایشگاه‌ها', tag: 'غرفه و سازه' },
  { key: 'knowledge', title: 'خدمات دانش‌بنیانی', description: 'ارزیابی پرونده، مشاوره حقوقی، اخذ گرید دانش‌بنیانی و معافیت‌ها', tag: 'مشاوره و ارزیابی' },
  { key: 'commercialization', title: 'تجاری‌سازی و ورود به بازار', description: 'هم‌رسانی فناوری با صنایع پتروشیمی عسلویه و انعقاد قراردادهای پایلوت', tag: 'بازار هدف' },
]

const ICONS: Record<string, LucideIcon> = {
  coins: Coins,
  calendar: Calendar,
  store: Store,
  'graduation-cap': GraduationCap,
  'trending-up': TrendingUp,
  sparkles: Sparkles,
}

const GRADIENTS: Record<string, string> = {
  financing: 'from-blue-600 to-cyan-600',
  events: 'from-indigo-600 to-purple-600',
  exhibitions: 'from-fuchsia-600 to-rose-600',
  knowledge: 'from-emerald-600 to-teal-600',
  commercialization: 'from-amber-600 to-orange-600',
}

export function ServicesQuickAccess({ services = SAMPLE }: ServicesQuickAccessProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            درخواست خدمات کارخانه نوآوری
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">برای شروع فرآیند، خدمت مورد نظر خود را انتخاب کنید</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {services.map((svc) => {
          const Icon = ICONS[svc.key] ?? Sparkles
          const gradient = GRADIENTS[svc.key] ?? 'from-slate-600 to-slate-700'
          return (
            <Link
              key={svc.key}
              href={`/dashboard/new-request?service=${svc.key}`}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-xs`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {svc.tag && (
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                      {svc.tag}
                    </span>
                  )}
                </div>

                <h3 className="mt-4 text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {svc.title}
                </h3>
                {svc.description && (
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2">{svc.description}</p>
                )}
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:gap-2 transition-all">
                <span>ثبت درخواست</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}