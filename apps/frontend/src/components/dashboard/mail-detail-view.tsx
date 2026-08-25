'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Message2Icon,
  TrashIcon,
  CalendarBulkIcon,
  ClockBulkIcon,
} from '@/components/icons'
import {
  ChevronLeft,
  FileText,
  Download,
  Send,
  X,
} from 'lucide-react'

export interface MailData {
  id: string
  title: string
  category: string
  senderName: string
  senderRole: string
  senderEmail?: string
  senderAvatar?: string
  datePersian: string
  dayOfWeek: string
  timeStr: string
  body: string
  attachments?: {
    name: string
    size: string
    ext: string
  }[]
}

const defaultMail: MailData = {
  id: 'LTR-501',
  title: 'همایش نفت و گاز عسلویه',
  category: 'رویدادها و نمایشگاه‌ها',
  senderName: 'نام و نام خانوادگی',
  senderRole: 'عنوان و سمت',
  senderEmail: 'support@dacho.ir',
  datePersian: '1405/01/01',
  dayOfWeek: 'دوشنبه',
  timeStr: 'ساعت 14:50',
  body: 'به‌عنوان بزرگ‌ترین رویداد صنعتی و تجاری منطقه در حوزه انرژی، هر ساله با حضور بیش از ۲۰۰ شرکت توانمند داخلی و خارجی برگزار می‌شود. این نمایشگاه، بستری مؤثر برای معرفی توانمندی‌ها، نوآوری‌ها و آخرین دستاوردهای صنعت نفت، گاز، پالایش و پتروشیمی فراهم می‌کند.',
  attachments: [
    {
      name: 'دعوت‌نامه رسمی و ضوابط حضور در همایش.pdf',
      size: '۲.۴ مگابایت',
      ext: 'PDF',
    },
    {
      name: 'فرم ثبت‌نام و جدول تخصیص غرفه‌ها.xlsx',
      size: '۸۴۰ کیلوبایت',
      ext: 'XLSX',
    },
  ],
}

interface MailDetailViewProps {
  mail?: MailData
}

export function MailDetailView({ mail = defaultMail }: MailDetailViewProps) {
  const router = useRouter()
  const [viewState, setViewState] = useState<'default' | 'loading'>('default')
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [replyText, setReplyText] = useState('')
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const handleDelete = () => {
    setActionNotice('نامه با موفقیت حذف گردید.')
    setTimeout(() => {
      router.push('/dashboard/letters')
    }, 1200)
  }

  return (
    <div className="flex w-full flex-col gap-6" dir="rtl">
      {/* Toast Alert */}
      {actionNotice && (
        <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900 shadow-sm animate-in fade-in slide-in-from-top-2">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-blue-500 hover:text-blue-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Header: Breadcrumb & State Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Breadcrumbs (Figma Breadcrumb: 56:12543) */}
        {viewState === 'loading' ? (
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-24 rounded-md bg-slate-100" />
            <span className="text-slate-300">/</span>
            <Skeleton className="h-6 w-28 rounded-md bg-slate-100" />
            <span className="text-slate-300">/</span>
            <Skeleton className="h-6 w-36 rounded-md bg-slate-100" />
          </div>
        ) : (
          <nav className="flex items-center gap-2 text-sm text-[#737373]">
            <Link
              href="/dashboard/letters"
              className="hover:text-[#2563EB] transition-colors font-medium"
            >
              کارتابل نامه
            </Link>
            <span className="text-slate-300 font-normal">/</span>
            <Link
              href="/dashboard/letters"
              className="hover:text-[#2563EB] transition-colors"
            >
              {mail.category || 'صفحه دوم'}
            </Link>
            <span className="text-slate-300 font-normal">/</span>
            <span className="font-bold text-[#404040]">{mail.title}</span>
          </nav>
        )}

        {/* State Switcher for Previewing Default / Loading Variants */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setViewState('default')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                viewState === 'default'
                  ? 'bg-white text-[#2563EB] shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              نمایش اصلی
            </button>
            <button
              type="button"
              onClick={() => setViewState('loading')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                viewState === 'loading'
                  ? 'bg-white text-[#2563EB] shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              حالت لودینگ (Skeleton)
            </button>
          </div>

          <Link href="/dashboard/letters">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 text-xs h-9 gap-1 text-[#525252]"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              بازگشت به کارتابل
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Mail Card (Figma Frame 63 - 56:12545) */}
      <div className="w-full rounded-2xl border border-slate-100 bg-white p-6 md:p-8 shadow-xs">
        {viewState === 'loading' ? (
          /* SKELETON LOADING VIEW (Figma Variant 20 - 56:13027) */
          <div className="space-y-6">
            {/* Top Sender & Buttons Skeleton */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full bg-slate-100" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36 rounded-md bg-slate-100" />
                  <Skeleton className="h-3 w-24 rounded-md bg-slate-50" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-xl bg-slate-100" />
                <Skeleton className="h-10 w-32 rounded-xl bg-slate-100" />
              </div>
            </div>

            {/* Date & Time Skeleton */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-md bg-slate-100" />
                <Skeleton className="h-4 w-28 rounded-md bg-slate-100" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-md bg-slate-100" />
                <Skeleton className="h-4 w-20 rounded-md bg-slate-100" />
              </div>
            </div>

            <div className="h-px w-full bg-slate-100" />

            {/* Title Skeleton */}
            <Skeleton className="h-7 w-64 rounded-md bg-slate-100" />

            {/* Body Lines Skeleton */}
            <div className="space-y-3 pt-2">
              <Skeleton className="h-4 w-full rounded-md bg-slate-100" />
              <Skeleton className="h-4 w-full rounded-md bg-slate-100" />
              <Skeleton className="h-4 w-4/5 rounded-md bg-slate-100" />
              <Skeleton className="h-4 w-3/5 rounded-md bg-slate-100" />
            </div>
          </div>
        ) : (
          /* DEFAULT MAIL VIEW (Figma Variant 19 - 56:12541) */
          <div>
            {/* 1. Card Top Bar (Frame 89 - 56:13003) */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Sender Details (Frame 86) */}
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 text-blue-700 font-semibold text-sm border border-blue-200/50 shadow-xs">
                  {mail.senderName.slice(0, 1) || 'ف'}
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold text-[#404040]">
                    {mail.senderName}
                  </span>
                  <span className="text-xs text-[#737373]">
                    {mail.senderRole}
                  </span>
                </div>
              </div>

              {/* Actions: Feedback & Delete (Frame 81 - 56:12942) */}
              <div className="flex items-center gap-2.5">
                {/* Delete Button (56:12943) */}
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-100"
                  title="پاک کردن نامه"
                >
                  <TrashIcon className="h-5 w-5 text-current" />
                  <span className="sr-only">حذف نامه</span>
                </button>

                {/* Submit Feedback Button (59:14131) */}
                <Button
                  onClick={() => setFeedbackModalOpen(true)}
                  variant="outline"
                  className="h-10 px-4 rounded-xl border-slate-200 text-sm font-medium text-[#404040] hover:bg-slate-50 hover:text-slate-900 inline-flex items-center gap-2"
                >
                  <Message2Icon className="h-5 w-5 text-[#404040]" />
                  <span>ثبت بازخورد</span>
                </Button>
              </div>
            </div>

            {/* 2. Date & Time Meta Row (Frame 88 - 56:12939) */}
            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-[#A3A3A3]">
              {/* Calendar Block (Frame 85) */}
              <div className="flex items-center gap-2">
                <CalendarBulkIcon className="h-5 w-5 text-[#A3A3A3]" />
                <span className="font-medium text-[#A3A3A3]">{mail.dayOfWeek}</span>
                <span className="font-mono text-[#A3A3A3]">{mail.datePersian}</span>
              </div>

              {/* Clock Block (Frame 87) */}
              <div className="flex items-center gap-2">
                <ClockBulkIcon className="h-5 w-5 text-[#A3A3A3]" />
                <span className="font-mono text-[#A3A3A3]">{mail.timeStr}</span>
              </div>
            </div>

            {/* 3. Divider (Vector 4 - 56:12940) */}
            <hr className="my-6 border-slate-100" />

            {/* 4. Subject / Title (56:12563) */}
            <h2 className="text-xl font-bold tracking-tight text-[#1F2937]">
              {mail.title}
            </h2>

            {/* 5. Letter Body (56:12559) */}
            <div className="mt-4 text-base leading-relaxed text-[#525252] text-justify space-y-4">
              <p>{mail.body}</p>
              <p>
                خواهشمند است جهت تکمیل فرآیند و هماهنگی‌های لازم پیرامون اختصاص غرفه،
                اطلاعات نمایندگان و فایل‌های مورد نیاز را از طریق بخش پیوست‌ها بارگذاری
                نموده و در صورت نیاز به هرگونه راهنمایی، بازخورد خود را در همین بخش ارسال
                فرمایید.
              </p>
            </div>

            {/* 6. Attachments Section */}
            {mail.attachments && mail.attachments.length > 0 && (
              <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#2563EB]" />
                  <span>پیوست‌های نامه ({mail.attachments.length})</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mail.attachments.map((att, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-xl bg-white border border-slate-200/80 p-3 shadow-2xs hover:border-blue-200 transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-xs">
                          {att.ext}
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {att.name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {att.size}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActionNotice(`دانلود فایل «${att.name}» آغاز گردید.`)
                          setTimeout(() => setActionNotice(null), 3000)
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                        title="دانلود فایل"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Quick Reply Section */}
            <div className="mt-8 rounded-xl border border-slate-100 p-5 bg-white">
              <h4 className="text-sm font-bold text-[#404040] mb-3">
                پاسخ سریع به این نامه
              </h4>
              <textarea
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="متن پاسخ خود را اینجا بنویسید..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-[#404040] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={() => {
                    if (!replyText.trim()) return
                    setActionNotice('پاسخ شما با موفقیت ارسال گردید.')
                    setReplyText('')
                    setTimeout(() => setActionNotice(null), 3500)
                  }}
                  className="rounded-xl bg-[#2563EB] text-white hover:bg-blue-700 gap-2 h-10 px-5"
                >
                  <Send className="h-4 w-4 rtl:rotate-180" />
                  ارسال پاسخ
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Dialog */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-[#404040]">ثبت بازخورد</h3>
              <button
                type="button"
                onClick={() => setFeedbackModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-500">
                بازخورد یا نظر خود را در رابطه با نامه «{mail.title}» ثبت نمایید:
              </p>
              <textarea
                rows={4}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="نظر یا توضیحات خود را وارد کنید..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-[#404040] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setFeedbackModalOpen(false)}
                className="rounded-xl border-slate-200"
              >
                انصراف
              </Button>
              <Button
                onClick={() => {
                  setFeedbackModalOpen(false)
                  setFeedbackText('')
                  setActionNotice('بازخورد شما با موفقیت ثبت شد.')
                  setTimeout(() => setActionNotice(null), 3500)
                }}
                className="rounded-xl bg-[#2563EB] text-white hover:bg-blue-700"
              >
                ثبت و ارسال
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
