'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  EyeIcon,
  EditIcon,
  TrashIcon,
  FilterIcon,
  SearchNormalIcon,
  EmptyInboxIllustration,
} from '@/components/dashboard/icons/request-icons'
import { MoreOptionsIcon } from '@/components/dashboard/icons/sidebar-icons'
import { Check, X, PlusCircle, RefreshCw } from 'lucide-react'

export type RequestStatus = 'in_review' | 'rejected' | 'draft' | 'approved'

export interface RequestItem {
  id: string
  title: string
  status: RequestStatus
  statusLabel: string
  dueDate: string
  createdDate: string
  category?: string
  trackingCode?: string
}

const initialRequests: RequestItem[] = [
  {
    id: 'REQ-1001',
    title: 'همایش نفت و گاز عسلویه',
    status: 'in_review',
    statusLabel: 'درحال بررسی',
    dueDate: '۱۴۰۵/۰۱/۰۶',
    createdDate: '۱۴۰۵/۰۱/۰۶',
    category: 'رویداد و نمایشگاه',
    trackingCode: 'TRK-88219',
  },
  {
    id: 'REQ-1002',
    title: 'همایش نفت و گاز عسلویه',
    status: 'rejected',
    statusLabel: 'رد شده',
    dueDate: '۱۴۰۵/۰۱/۰۶',
    createdDate: '۱۴۰۵/۰۱/۰۶',
    category: 'رویداد و نمایشگاه',
    trackingCode: 'TRK-88220',
  },
  {
    id: 'REQ-1003',
    title: 'همایش نفت و گاز عسلویه',
    status: 'draft',
    statusLabel: 'درخواست داده نشده',
    dueDate: '۱۴۰۵/۰۱/۰۶',
    createdDate: '۱۴۰۵/۰۱/۰۶',
    category: 'رویداد و نمایشگاه',
    trackingCode: 'TRK-88221',
  },
  {
    id: 'REQ-1004',
    title: 'تخصیص فضای آزمایشگاهی پتروشیمی پارس',
    status: 'approved',
    statusLabel: 'تایید شده',
    dueDate: '۱۴۰۴/۱۲/۲۰',
    createdDate: '۱۴۰۴/۱۱/۱۵',
    category: 'فضا و تجهیزات',
    trackingCode: 'TRK-88222',
  },
  {
    id: 'REQ-1005',
    title: 'دریافت تسهیلات توسعه فناوری نمونه تجاری',
    status: 'in_review',
    statusLabel: 'درحال بررسی',
    dueDate: '۱۴۰۵/۰۲/۱۵',
    createdDate: '۱۴۰۵/۰۱/۱۰',
    category: 'تسهیلات و مالی',
    trackingCode: 'TRK-88223',
  },
]

export function RequestsListView() {
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewState, setViewState] = useState<'default' | 'loading' | 'empty'>('default')
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Filter requests based on search query and status filter
  const filteredRequests = useMemo(() => {
    if (viewState === 'empty') return []
    return requests.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.statusLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.createdDate.includes(searchQuery) ||
        item.dueDate.includes(searchQuery)

      const matchesStatus =
        statusFilter === 'all' || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [requests, searchQuery, statusFilter, viewState])

  const handleDelete = (id: string, title: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id))
    setActionNotice(`درخواست «${title}» با موفقیت لغو شد.`)
    setTimeout(() => setActionNotice(null), 3500)
  }

  const renderStatusBadge = (status: RequestStatus, label: string) => {
    switch (status) {
      case 'in_review':
        return (
          <Badge
            variant="outline"
            className="border-[#BFDBFE] bg-[#EEF2FF] text-[#2563EB] px-3 py-1 text-xs font-medium rounded-full shadow-none"
          >
            {label}
          </Badge>
        )
      case 'rejected':
        return (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-red-600 px-3 py-1 text-xs font-medium rounded-full shadow-none"
          >
            {label}
          </Badge>
        )
      case 'draft':
        return (
          <Badge
            variant="outline"
            className="border-slate-200 bg-slate-100 text-slate-600 px-3 py-1 text-xs font-medium rounded-full shadow-none"
          >
            {label}
          </Badge>
        )
      case 'approved':
        return (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-medium rounded-full shadow-none"
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

      {/* Page Header & Top Toolbar (Search, Filter, Actions) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight text-[#404040]">
          لیست درخواست ها
        </h1>

        {/* Toolbar: Search input + Filter button */}
        <div className="flex items-center gap-3">
          {/* Search Input (Frame 42:4336) */}
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

          {/* Filter Dropdown Button (Frame 42:4335) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#404040] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                  statusFilter !== 'all' ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40' : ''
                }`}
                title="فیلتر وضعیت"
              >
                <FilterIcon className="h-5 w-5" />
                <span className="sr-only">فیلتر</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg"
            >
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-400">فیلتر وضعیت</div>
              <DropdownMenuItem
                onClick={() => setStatusFilter('all')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>همه وضعیت‌ها</span>
                {statusFilter === 'all' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('in_review')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>درحال بررسی</span>
                {statusFilter === 'in_review' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('approved')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>تایید شده</span>
                {statusFilter === 'approved' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('rejected')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>رد شده</span>
                {statusFilter === 'rejected' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStatusFilter('draft')}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>درخواست داده نشده</span>
                {statusFilter === 'draft' && <Check className="h-4 w-4 text-[#2563EB]" />}
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

      {/* Main Table Card (Frame 6 - 42:4337) */}
      <div className="w-full rounded-2xl border border-slate-100 bg-white p-4 sm:p-6 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-slate-100 text-xs font-medium text-[#A3A3A3]">
                <th className="py-4 px-4 font-normal text-[#A3A3A3] w-auto">درخواست</th>
                <th className="py-4 px-4 font-normal text-[#A3A3A3] w-48">وضعیت</th>
                <th className="py-4 px-4 font-normal text-[#A3A3A3] w-40">تاریخ سررسید</th>
                <th className="py-4 px-4 font-normal text-[#A3A3A3] w-40">تاریخ ثبت</th>
                <th className="py-4 px-3 font-normal text-[#A3A3A3] w-14 text-center">عملیات</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {/* 1. LOADING STATE (Figma Variant 13) */}
              {viewState === 'loading' && (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-slate-50 h-[72px]">
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-2">
                          <Skeleton className="h-5 w-56 rounded-md bg-slate-100" />
                          <Skeleton className="h-3 w-28 rounded-md bg-slate-50" />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-6 w-24 rounded-full bg-slate-100" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-24 rounded-md bg-slate-100" />
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

              {/* 2. DEFAULT / DATA STATE (Figma Variant 6 & 15) */}
              {viewState === 'default' &&
                filteredRequests.length > 0 &&
                filteredRequests.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-50 h-[72px] transition-colors hover:bg-slate-50/60 group"
                  >
                    {/* Request Title */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="text-base font-medium text-[#525252] group-hover:text-slate-900 transition-colors">
                          {item.title}
                        </span>
                        {item.category && (
                          <span className="text-xs text-slate-400 mt-0.5">
                            {item.category} • {item.trackingCode}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4">
                      {renderStatusBadge(item.status, item.statusLabel)}
                    </td>

                    {/* Due Date */}
                    <td className="py-4 px-4 font-mono text-sm text-[#525252]">
                      {item.dueDate}
                    </td>

                    {/* Created Date */}
                    <td className="py-4 px-4 font-mono text-sm text-[#525252]">
                      {item.createdDate}
                    </td>

                    {/* Action Dropdown Menu (Figma Frame 81 - 53:10769) */}
                    <td className="py-4 px-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center mx-auto rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100"
                            title="عملیات بیشتر"
                          >
                            <MoreOptionsIcon className="h-6 w-6 text-[#525252]" />
                            <span className="sr-only">منوی عملیات</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[164px] rounded-xl border border-slate-100 bg-white p-1 shadow-[0px_2px_8px_rgba(21,21,21,0.1)] animate-in fade-in-80 zoom-in-95"
                        >
                          {/* 1. View / مشاهده */}
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRequest(item)
                              setActionNotice(`نمایش اطلاعات پرونده «${item.title}»`)
                            }}
                            className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm font-normal text-[#404040] hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <EyeIcon className="h-5 w-5 text-[#404040]" />
                              <span>مشاهده</span>
                            </div>
                          </DropdownMenuItem>

                          {/* 2. Edit / ویرایش */}
                          <DropdownMenuItem
                            onClick={() => {
                              setActionNotice(`فرم ویرایش درخواست «${item.title}» باز شد.`)
                            }}
                            className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm font-normal text-[#404040] hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <EditIcon className="h-5 w-5 text-[#404040]" />
                              <span>ویرایش</span>
                            </div>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="my-1 bg-slate-100" />

                          {/* 3. Cancel / لغو درخواست */}
                          <DropdownMenuItem
                            onClick={() => handleDelete(item.id, item.title)}
                            className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm font-normal text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <TrashIcon className="h-5 w-5 text-red-600" />
                              <span>لغو درخواست</span>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* 3. EMPTY STATE (Figma Variant 14 - 53:10470) */}
          {(viewState === 'empty' ||
            (viewState === 'default' && filteredRequests.length === 0)) && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              {/* Empty Inbox SVG Graphic */}
              <div className="relative mb-4 flex h-20 w-20 items-center justify-center">
                <EmptyInboxIllustration className="h-20 w-20" />
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-[#404040]">
                درخواستی در این صفحه موجود نیست
              </h3>

              {/* Subtitle */}
              <p className="mt-1 text-sm text-[#737373] max-w-sm">
                در رویداد جدید درخواست خود را ثبت کنید
              </p>

              {/* CTA Button */}
              <div className="mt-6">
                <Link href="/dashboard/new-request">
                  <Button className="h-10 px-5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-medium shadow-sm shadow-blue-600/20 inline-flex items-center gap-2">
                    <PlusCircle className="h-4 w-4" />
                    ارسال درخواست
                  </Button>
                </Link>
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

      {/* Detail Modal / Drawer Dialog when a request is clicked */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-[#404040]">جزئیات درخواست</h3>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-[#525252]">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">عنوان پرونده:</span>
                <span className="font-semibold text-slate-900">{selectedRequest.title}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">کد رهگیری:</span>
                <span className="font-mono font-medium text-[#2563EB]">{selectedRequest.trackingCode}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">وضعیت فعلی:</span>
                {renderStatusBadge(selectedRequest.status, selectedRequest.statusLabel)}
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">تاریخ ثبت:</span>
                <span className="font-mono">{selectedRequest.createdDate}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">تاریخ سررسید:</span>
                <span className="font-mono">{selectedRequest.dueDate}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setSelectedRequest(null)}
                className="rounded-xl border-slate-200"
              >
                بستن
              </Button>
              <Link href={`/dashboard/requests/${selectedRequest.id}`}>
                <Button className="rounded-xl bg-[#2563EB] text-white hover:bg-blue-700">
                  مشاهده صفحه کامل
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
