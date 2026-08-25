'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  TrashIcon,
  FilterIcon,
  SearchNormalIcon,
  Message2Icon,
  EmptyInboxIllustration,
  MoreOptionsIcon,
} from '@/components/icons'
import { Check, X, Send, RefreshCw } from 'lucide-react'

export type LetterStatus =
  | 'rejected'
  | 'approved'
  | 'needs_fix'
  | 'official'
  | 'notification'

export interface LetterItem {
  id: string
  title: string
  status: LetterStatus
  statusLabel: string
  senderName: string
  senderRole: string
  senderAvatar?: string
  sentDate: string
  read?: boolean
  trackingCode?: string
}

const mockLetters: LetterItem[] = [
  {
    id: 'LTR-501',
    title: 'همایش نفت و گاز عسلویه',
    status: 'rejected',
    statusLabel: 'رد درخواست',
    senderName: 'نام و نام خانوادگی',
    senderRole: 'عنوان و سمت',
    sentDate: '۱۴۰۵/۰۱/۰۶',
    read: false,
    trackingCode: 'LTR-9921',
  },
  {
    id: 'LTR-502',
    title: 'همایش نفت و گاز عسلویه',
    status: 'approved',
    statusLabel: 'تایید درخواست',
    senderName: 'نام و نام خانوادگی',
    senderRole: 'عنوان و سمت',
    sentDate: '۱۴۰۵/۰۱/۰۶',
    read: true,
    trackingCode: 'LTR-9922',
  },
  {
    id: 'LTR-503',
    title: 'همایش نفت و گاز عسلویه',
    status: 'needs_fix',
    statusLabel: 'نیاز به اصلاح درخواست',
    senderName: 'نام و نام خانوادگی',
    senderRole: 'عنوان و سمت',
    sentDate: '۱۴۰۵/۰۱/۰۶',
    read: false,
    trackingCode: 'LTR-9923',
  },
  {
    id: 'LTR-504',
    title: 'همایش نفت و گاز عسلویه',
    status: 'official',
    statusLabel: 'نامه رسمی',
    senderName: 'نام و نام خانوادگی',
    senderRole: 'عنوان و سمت',
    sentDate: '۱۴۰۵/۰۱/۰۶',
    read: true,
    trackingCode: 'LTR-9924',
  },
  {
    id: 'LTR-505',
    title: 'همایش نفت و گاز عسلویه',
    status: 'notification',
    statusLabel: 'اطلاع رسانی',
    senderName: 'نام و نام خانوادگی',
    senderRole: 'عنوان و سمت',
    sentDate: '۱۴۰۵/۰۱/۰۶',
    read: true,
    trackingCode: 'LTR-9925',
  },
]

export interface InboxListViewProps {
  /** Letters read from GET /letters; the Figma sample shows when absent. */
  initialLetters?: LetterItem[]
}

export function InboxListView({ initialLetters = mockLetters }: InboxListViewProps) {
  const [letters, setLetters] = useState<LetterItem[]>(initialLetters)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewState, setViewState] = useState<'default' | 'loading' | 'empty'>('default')
  const [supportModalOpen, setSupportModalOpen] = useState(false)
  const [feedbackModalLetter, setFeedbackModalLetter] = useState<LetterItem | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Filter letters based on search and status
  const filteredLetters = useMemo(() => {
    if (viewState === 'empty') return []
    return letters.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.statusLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.senderRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sentDate.includes(searchQuery)

      const matchesStatus =
        statusFilter === 'all' || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [letters, searchQuery, statusFilter, viewState])

  const handleDelete = (id: string, title: string) => {
    setLetters((prev) => prev.filter((item) => item.id !== id))
    setActionNotice(`نامه «${title}» با موفقیت حذف گردید.`)
    setTimeout(() => setActionNotice(null), 3500)
  }

  const renderStatusBadge = (status: LetterStatus, label: string) => {
    switch (status) {
      case 'rejected':
        return (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-red-600 px-3 py-1 text-xs font-medium rounded-full shadow-none"
          >
            {label}
          </Badge>
        )
      case 'approved':
        return (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-600 px-3 py-1 text-xs font-medium rounded-full shadow-none"
          >
            {label}
          </Badge>
        )
      case 'needs_fix':
        return (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-700 px-3 py-1 text-xs font-medium rounded-full shadow-none"
          >
            {label}
          </Badge>
        )
      case 'official':
        return (
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium rounded-full shadow-none"
          >
            {label}
          </Badge>
        )
      case 'notification':
        return (
          <Badge
            variant="outline"
            className="border-slate-200 bg-slate-100 text-slate-700 px-3 py-1 text-xs font-medium rounded-full shadow-none"
          >
            {label}
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 px-3 py-1 text-xs rounded-full">
            {label}
          </Badge>
        )
    }
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

      {/* Header & Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight text-[#404040]">
          کارتابل نامه
        </h1>

        {/* Toolbar: Message to Support button + Search + Filter */}
        <div className="flex items-center gap-3">
          {/* Action: پیام به پشتیبانی */}
          <Button
            onClick={() => setSupportModalOpen(true)}
            className="h-12 px-5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-medium shadow-sm shadow-blue-600/20 inline-flex items-center gap-2"
          >
            <Message2Icon className="h-5 w-5 text-white" />
            <span>پیام به پشتیبانی</span>
          </Button>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-80">
            <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchNormalIcon className="h-5 w-5 text-[#9CA3AF]" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="درخواست خود را جست و جو کنید"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-11 pl-9 text-sm text-[#404040] placeholder:text-slate-400 transition-all focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#404040] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                  statusFilter !== 'all' ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40' : ''
                }`}
                title="فیلتر وضعیت نامه"
              >
                <FilterIcon className="h-5 w-5" />
                <span className="sr-only">فیلتر</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg"
            >
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-400">فیلتر نوع نامه</div>
              <DropdownMenuItem
                onClick={() => setStatusFilter('all')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>همه نامه‌ها</span>
                {statusFilter === 'all' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('approved')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>تایید درخواست</span>
                {statusFilter === 'approved' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('rejected')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>رد درخواست</span>
                {statusFilter === 'rejected' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('needs_fix')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>نیاز به اصلاح درخواست</span>
                {statusFilter === 'needs_fix' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('official')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>نامه رسمی</span>
                {statusFilter === 'official' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('notification')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>اطلاع رسانی</span>
                {statusFilter === 'notification' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* State Switcher for Previewing Figma Variants */}
          <div className="hidden lg:flex items-center rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setViewState('default')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                viewState === 'default'
                  ? 'bg-white text-[#2563EB] shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              لیست اصلی
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
              حالت لودینگ
            </button>
            <button
              type="button"
              onClick={() => setViewState('empty')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                viewState === 'empty'
                  ? 'bg-white text-[#2563EB] shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              حالت خالی
            </button>
          </div>
        </div>
      </div>

      {/* Main Inbox Table Card */}
      <div className="w-full rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-slate-100 text-xs font-medium text-[#A3A3A3]">
                <th className="py-4 px-4 font-normal text-[#A3A3A3] w-48">وضعیت</th>
                <th className="py-4 px-4 font-normal text-[#A3A3A3] w-auto">عنوان</th>
                <th className="py-4 px-4 font-normal text-[#A3A3A3] w-64">فرستنده</th>
                <th className="py-4 px-4 font-normal text-[#A3A3A3] w-40">تاریخ ارسال</th>
                <th className="py-4 px-3 font-normal text-[#A3A3A3] w-14 text-center">عملیات</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {/* 1. LOADING STATE */}
              {viewState === 'loading' && (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-b border-slate-50 h-[72px]">
                      <td className="py-4 px-4">
                        <Skeleton className="h-6 w-24 rounded-full bg-slate-100" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-5 w-60 rounded-md bg-slate-100" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-full bg-slate-100 shrink-0" />
                          <div className="flex flex-col gap-1.5">
                            <Skeleton className="h-4 w-28 rounded-md bg-slate-100" />
                            <Skeleton className="h-3 w-20 rounded-md bg-slate-50" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-24 rounded-md bg-slate-100" />
                      </td>
                      <td className="py-4 px-3 text-center">
                        <Skeleton className="h-8 w-8 mx-auto rounded-lg bg-slate-100" />
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* 2. DEFAULT / DATA STATE */}
              {viewState === 'default' &&
                filteredLetters.length > 0 &&
                filteredLetters.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-50 h-[72px] transition-colors hover:bg-slate-50/60 group"
                  >
                    {/* Status Badge */}
                    <td className="py-4 px-4">
                      {renderStatusBadge(item.status, item.statusLabel)}
                    </td>

                    {/* Subject / Title */}
                    <td className="py-4 px-4">
                      <Link
                        href={`/dashboard/letters/${item.id}`}
                        className="text-base font-medium text-[#525252] hover:text-[#2563EB] transition-colors"
                      >
                        {item.title}
                      </Link>
                    </td>

                    {/* Sender with Avatar & Role */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 text-blue-700 font-semibold text-xs border border-blue-200/50 shadow-xs">
                          {item.senderName.slice(0, 1) || 'ف'}
                        </div>
                        {/* Name & Role */}
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[#525252]">
                            {item.senderName}
                          </span>
                          <span className="text-xs text-slate-400">
                            {item.senderRole}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Sent Date */}
                    <td className="py-4 px-4 font-mono text-sm text-[#525252]">
                      {item.sentDate}
                    </td>

                    {/* Action Dropdown Menu (Figma Frame 81 - 53:12461) */}
                    <td className="py-4 px-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center mx-auto rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100"
                            title="عملیات نامه"
                          >
                            <MoreOptionsIcon className="h-6 w-6 text-[#525252]" />
                            <span className="sr-only">منوی عملیات</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[164px] rounded-xl border border-slate-100 bg-white p-1 shadow-[0px_2px_8px_rgba(21,21,21,0.1)] animate-in fade-in-80 zoom-in-95"
                        >
                          {/* 1. Feedback / ثبت بازخورد */}
                          <DropdownMenuItem
                            onClick={() => {
                              setFeedbackModalLetter(item)
                            }}
                            className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm font-normal text-[#404040] hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Message2Icon className="h-5 w-5 text-[#404040]" />
                              <span>ثبت بازخورد</span>
                            </div>
                          </DropdownMenuItem>

                          {/* 2. Delete / پاک کردن */}
                          <DropdownMenuItem
                            onClick={() => handleDelete(item.id, item.title)}
                            className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm font-normal text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <TrashIcon className="h-5 w-5 text-red-600" />
                              <span>پاک کردن</span>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* 3. EMPTY STATE */}
          {(viewState === 'empty' ||
            (viewState === 'default' && filteredLetters.length === 0)) && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              {/* Empty Inbox SVG Graphic */}
              <div className="relative mb-4 flex h-20 w-20 items-center justify-center">
                <EmptyInboxIllustration className="h-20 w-20" />
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-[#404040]">
                صندوق نامه‌های شما خالیست
              </h3>

              {/* Subtitle */}
              <p className="mt-1 text-sm text-[#737373] max-w-sm">
                تا کنون نامه یا پیامی برای شما ارسال نشده است
              </p>

              {/* CTA Button */}
              <div className="mt-6">
                <Button
                  onClick={() => setSupportModalOpen(true)}
                  className="h-10 px-5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-medium shadow-sm shadow-blue-600/20 inline-flex items-center gap-2"
                >
                  <Message2Icon className="h-4 w-4 text-white" />
                  ارسال پیام به پشتیبانی
                </Button>
              </div>

              {/* Reset filter helper if filtered out */}
              {(searchQuery || statusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                    setViewState('default')
                  }}
                  className="mt-4 text-xs text-[#2563EB] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  پاک کردن جستجو و فیلترها
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Support Message Dialog */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-[#404040]">ارسال پیام به پشتیبانی کارخانه نوآوری</h3>
              <button
                type="button"
                onClick={() => setSupportModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSupportModalOpen(false)
                setActionNotice('پیام شما با موفقیت به واحد پشتیبانی ارسال گردید.')
                setTimeout(() => setActionNotice(null), 3500)
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  موضوع پیام
                </label>
                <input
                  type="text"
                  required
                  placeholder="موضوع یا عنوان نامه را وارد نمایید..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-[#404040] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  متن پیام
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="شرح پیام یا درخواست خود را بنویسید..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-[#404040] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSupportModalOpen(false)}
                  className="rounded-xl border-slate-200"
                >
                  انصراف
                </Button>
                <Button type="submit" className="rounded-xl bg-[#2563EB] text-white hover:bg-blue-700 gap-1.5">
                  <Send className="h-4 w-4 rtl:rotate-180" />
                  ارسال پیام
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Dialog */}
      {feedbackModalLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-[#404040]">ثبت بازخورد</h3>
              <button
                type="button"
                onClick={() => setFeedbackModalLetter(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-500">
                بازخورد شما در مورد نامه «{feedbackModalLetter.title}» به فرستنده ارسال خواهد شد:
              </p>
              <textarea
                rows={3}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="نظر یا بازخورد خود را بنویسید..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-[#404040] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setFeedbackModalLetter(null)}
                className="rounded-xl border-slate-200"
              >
                انصراف
              </Button>
              <Button
                onClick={() => {
                  setFeedbackModalLetter(null)
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
