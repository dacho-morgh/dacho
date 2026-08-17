'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  FilterIcon,
  SearchNormalIcon,
  CalendarBulkIcon,
  LocationBulkIcon,
  CheckSquareIcon,
  EmptyInboxIllustration,
} from '@/components/dashboard/icons/request-icons'
import { Check, X, Send } from 'lucide-react'

export interface EventItem {
  id: string
  title: string
  badgeText: string
  badgeType: 'ended' | 'active' | 'upcoming'
  dates: string
  location: string
  imageSrc: string
  hasActionButton?: boolean
  actionButtonText?: string
}

const initialEvents: EventItem[] = [
  {
    id: 'EVT-01',
    title: 'نمایشگاه بین‌المللی نفت، گاز، پالایش و پتروشیمی پارس جنوبی (عسلویه)',
    badgeText: 'تمام شده',
    badgeType: 'ended',
    dates: '۱۲-۱۵ بهمن ۱۴۰۵',
    location: 'عسلویه، بلوار سیراف، محل دائمی برگزاری همایش‌ها و نمایشگاه‌های بین‌المللی',
    imageSrc: '/images/dashboard/event-stage.png',
    hasActionButton: false,
  },
  {
    id: 'EVT-02',
    title: 'نمایشگاه بین‌المللی نفت، گاز، پالایش و پتروشیمی پارس جنوبی (عسلویه)',
    badgeText: 'تمام شده',
    badgeType: 'ended',
    dates: '۱۲-۱۵ بهمن ۱۴۰۵',
    location: 'عسلویه، بلوار سیراف، محل دائمی برگزاری همایش‌ها و نمایشگاه‌های بین‌المللی',
    imageSrc: '/images/dashboard/event-stage.png',
    hasActionButton: true,
    actionButtonText: 'ثبت درخواست',
  },
  {
    id: 'EVT-03',
    title: 'نمایشگاه بین‌المللی نفت، گاز، پالایش و پتروشیمی پارس جنوبی (عسلویه)',
    badgeText: 'تمام شده',
    badgeType: 'ended',
    dates: '۱۲-۱۵ بهمن ۱۴۰۵',
    location: 'عسلویه، بلوار سیراف، محل دائمی برگزاری همایش‌ها و نمایشگاه‌های بین‌المللی',
    imageSrc: '/images/dashboard/event-stage.png',
    hasActionButton: false,
  },
]

export function EventsView() {
  const [events, setEvents] = useState<EventItem[]>(initialEvents)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [viewState, setViewState] = useState<'default' | 'loading' | 'empty'>('default')
  const [registerModalEvent, setRegisterModalEvent] = useState<EventItem | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Registration modal form state
  const [companyName, setCompanyName] = useState('شرکت دانش‌بنیان نمونه')
  const [delegatesCount, setDelegatesCount] = useState('2')
  const [needsBooth, setNeedsBooth] = useState(true)

  const filteredEvents = useMemo(() => {
    if (viewState === 'empty') return []
    return events.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.dates.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesFilter = filterType === 'all' || item.badgeType === filterType

      return matchesSearch && matchesFilter
    })
  }, [events, searchQuery, filterType, viewState])

  return (
    <div className="flex w-full flex-col gap-6" dir="rtl">
      {/* Toast Alert */}
      {actionNotice && (
        <div className="flex items-center justify-between rounded-2xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900 shadow-sm animate-in fade-in slide-in-from-top-2">
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

      {/* Header & Top Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight text-[#262626]">
          رویدادها و نمایشگاه‌ها
        </h1>

        {/* Top Controls: Filter & Search + State Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#404040] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                  filterType !== 'all' ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/50' : ''
                }`}
                title="فیلتر رویدادها"
              >
                <FilterIcon className="h-5 w-5" />
                <span className="sr-only">فیلتر</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg"
            >
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-400">فیلتر وضعیت</div>
              <DropdownMenuItem
                onClick={() => setFilterType('all')}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>همه رویدادها</span>
                {filterType === 'all' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterType('ended')}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>تمام شده</span>
                {filterType === 'ended' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterType('active')}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-[#404040] hover:bg-slate-50 cursor-pointer"
              >
                <span>در حال ثبت‌نام</span>
                {filterType === 'active' && <Check className="h-4 w-4 text-[#2563EB]" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="درخواست خود را جست و جو کنید"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pr-4 pl-10 text-sm text-[#404040] placeholder:text-[#A3A3A3] transition-all focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchNormalIcon className="h-5 w-5 text-[#A3A3A3]" />
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Figma State Switcher */}
          <div className="hidden xl:flex items-center rounded-2xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setViewState('default')}
              className={`rounded-xl px-3 py-1.5 transition-all ${
                viewState === 'default'
                  ? 'bg-white text-[#2563EB] shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              لیست رویدادها
            </button>
            <button
              type="button"
              onClick={() => setViewState('loading')}
              className={`rounded-xl px-3 py-1.5 transition-all ${
                viewState === 'loading'
                  ? 'bg-white text-[#2563EB] shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              اسکلتون (لودینگ)
            </button>
            <button
              type="button"
              onClick={() => setViewState('empty')}
              className={`rounded-xl px-3 py-1.5 transition-all ${
                viewState === 'empty'
                  ? 'bg-white text-[#2563EB] shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              حالت خالی (Empty)
            </button>
          </div>
        </div>
      </div>

      {/* Main Content White Container */}
      <div className="w-full rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xs">
        {/* 1. SKELETON LOADING STATE */}
        {viewState === 'loading' && (
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                {/* Right side in RTL: Image skeleton & content skeletons */}
                <div className="flex flex-col sm:flex-row items-start gap-5 flex-1 w-full">
                  {/* Square thumbnail skeleton */}
                  <Skeleton className="h-40 w-44 rounded-2xl bg-[#F5F5F5] shrink-0" />

                  {/* Text lines skeleton */}
                  <div className="space-y-3 flex-1 pt-1 w-full">
                    {/* Badge skeleton */}
                    <Skeleton className="h-5 w-20 rounded-full bg-[#F5F5F5]" />
                    {/* Title skeleton */}
                    <Skeleton className="h-6 w-3/4 max-w-md rounded-md bg-[#F5F5F5]" />
                    {/* Date skeleton */}
                    <Skeleton className="h-4 w-36 rounded-md bg-[#F5F5F5]" />
                    {/* Location skeleton */}
                    <Skeleton className="h-4 w-4/5 max-w-lg rounded-md bg-[#F5F5F5]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. EMPTY STATE */}
        {(viewState === 'empty' ||
          (viewState === 'default' && filteredEvents.length === 0)) && (
          <div className="flex flex-col items-center justify-center py-28 px-4 text-center">
            {/* Empty Box Illustration */}
            <div className="relative mb-5 flex h-24 w-24 items-center justify-center">
              <EmptyInboxIllustration className="h-24 w-24" />
            </div>

            {/* Empty Heading */}
            <h3 className="text-base font-bold text-[#262626]">
              رویداد و نمایشگاهی در سیستم موجود نیست
            </h3>

            {/* Empty Subtitle */}
            <p className="mt-2 text-xs text-[#8C8C8C]">
              در صورت ایجاد رویداد یا نمایشگاه به شما اطلاع رسانی خواهیم کرد
            </p>

            {(searchQuery || filterType !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setFilterType('all')
                  setViewState('default')
                }}
                className="mt-5 text-xs text-[#2563EB] hover:underline font-medium"
              >
                پاک کردن جستجو و فیلترها
              </button>
            )}
          </div>
        )}

        {/* 3. DEFAULT STATE (EVENTS LIST) */}
        {viewState === 'default' && filteredEvents.length > 0 && (
          <div className="space-y-8">
            {filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                {/* Event Thumbnail & Details (Right in RTL) */}
                <div className="flex flex-col sm:flex-row items-start gap-5 flex-1">
                  {/* Event Thumbnail */}
                  <div className="relative h-40 w-44 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                    <Image
                      src={evt.imageSrc}
                      alt={evt.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 180px"
                    />
                  </div>

                  {/* Event Info */}
                  <div className="flex flex-col items-start gap-2.5 pt-1">
                    {/* Badge */}
                    <span className="rounded-full bg-[#F5F5F5] px-3.5 py-1 text-xs font-medium text-[#737373]">
                      {evt.badgeText}
                    </span>

                    {/* Title */}
                    <h3 className="text-base sm:text-lg font-bold text-[#262626] leading-snug">
                      {evt.title}
                    </h3>

                    {/* Dates */}
                    <div className="flex items-center gap-2 text-xs text-[#737373]">
                      <CalendarBulkIcon className="h-4 w-4 text-[#A3A3A3] shrink-0" />
                      <span>{evt.dates}</span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 text-xs text-[#737373]">
                      <LocationBulkIcon className="h-4 w-4 text-[#A3A3A3] shrink-0" />
                      <span>{evt.location}</span>
                    </div>
                  </div>
                </div>

                {/* Action Button (Left in RTL) */}
                {evt.hasActionButton && (
                  <div className="shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => setRegisterModalEvent(evt)}
                      className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-blue-700 active:scale-98"
                    >
                      <CheckSquareIcon className="h-4 w-4" />
                      <span>{evt.actionButtonText || 'ثبت درخواست'}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Registration & Booth Request Modal */}
      {registerModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-[#262626]">
                ثبت درخواست در رویداد
              </h3>
              <button
                type="button"
                onClick={() => setRegisterModalEvent(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500 line-clamp-2">
              {registerModalEvent.title}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setRegisterModalEvent(null)
                setActionNotice(
                  `درخواست حضور در «${registerModalEvent.title}» با موفقیت ثبت شد.`
                )
                setTimeout(() => setActionNotice(null), 4000)
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  نام شرکت متقاضی
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-[#404040] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  تعداد نمایندگان حاضر
                </label>
                <select
                  value={delegatesCount}
                  onChange={(e) => setDelegatesCount(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-[#404040] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="1">۱ نفر</option>
                  <option value="2">۲ نفر</option>
                  <option value="3">۳ نفر</option>
                  <option value="4">۴ نفر یا بیشتر</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="needsBoothCheck"
                  checked={needsBooth}
                  onChange={(e) => setNeedsBooth(e.target.checked)}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <label htmlFor="needsBoothCheck" className="text-xs text-slate-700 cursor-pointer">
                  متقاضی اختصاص کانتر / غرفه در پاویون اختصاصی هستم
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRegisterModalEvent(null)}
                  className="rounded-xl border-slate-200"
                >
                  انصراف
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl bg-[#2563EB] text-white hover:bg-blue-700 gap-2"
                >
                  <Send className="h-4 w-4 rtl:rotate-180" />
                  ارسال درخواست
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
