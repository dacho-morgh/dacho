'use client'

import { Check, Send, X } from 'lucide-react'
import Image from 'next/image'
import React, { useMemo, useState } from 'react'
import {
  CalendarBulkIcon,
  EmptyInboxIllustration,
  FilterIcon,
  LocationBulkIcon,
  SearchNormalIcon,
  TickSquareIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'

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

export const initialEvents: EventItem[] = [
  {
    id: 'EVT-01',
    title: 'نمایشگاه بین‌المللی نفت، گاز، پالایش و پتروشیمی پارس جنوبی (عسلویه)',
    badgeText: 'تمام شده',
    badgeType: 'ended',
    dates: '12-15 بهمن 1405',
    location: 'عسلویه، بلوار سیراف، محل دائمی برگزاری همایش‌ها و نمایش‌های بین‌المللی',
    imageSrc: '/images/dashboard/event-stage.png',
    hasActionButton: false,
  },
  {
    id: 'EVT-02',
    title: 'نمایشگاه بین‌المللی نفت، گاز، پالایش و پتروشیمی پارس جنوبی (عسلویه)',
    badgeText: 'تمام شده',
    badgeType: 'ended',
    dates: '12-15 بهمن 1405',
    location: 'عسلویه، بلوار سیراف، محل دائمی برگزاری همایش‌ها و نمایش‌های بین‌المللی',
    imageSrc: '/images/dashboard/event-stage.png',
    hasActionButton: true,
    actionButtonText: 'ثبت درخواست',
  },
  {
    id: 'EVT-03',
    title: 'نمایشگاه بین‌المللی نفت، گاز، پالایش و پتروشیمی پارس جنوبی (عسلویه)',
    badgeText: 'تمام شده',
    badgeType: 'ended',
    dates: '12-15 بهمن 1405',
    location: 'عسلویه، بلوار سیراف، محل دائمی برگزاری همایش‌ها و نمایش‌های بین‌المللی',
    imageSrc: '/images/dashboard/event-stage.png',
    hasActionButton: false,
  },
]

export interface EventsViewProps {
  initialEventsList?: EventItem[]
  state?: 'default' | 'loading' | 'empty'
}

// Skeleton state matching Figma node 56:13600
function EventsSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری رویدادها" className="flex flex-col gap-[32px]">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col-reverse items-start justify-end gap-[16px] sm:h-[200px] sm:flex-row"
        >
          {/* Content skeleton on left */}
          <div className="flex h-[168px] w-full flex-1 flex-col justify-between py-1">
            <div>
              <Skeleton className="h-[24px] w-[200px] rounded-[8px] bg-[#f5f5f5]" />
              <Skeleton className="mt-[16px] h-[32px] w-[400px] max-w-full rounded-[8px] bg-[#f5f5f5]" />
            </div>
            <div className="space-y-[16px]">
              <Skeleton className="h-[24px] w-[200px] rounded-[8px] bg-[#f5f5f5]" />
              <Skeleton className="h-[24px] w-[200px] rounded-[8px] bg-[#f5f5f5]" />
            </div>
          </div>

          {/* Square thumbnail skeleton on right */}
          <Skeleton className="size-[200px] shrink-0 rounded-[8px] bg-[#f5f5f5]" />
        </div>
      ))}
    </div>
  )
}

// Empty state matching Figma node 56:13860 / 56:14004
function EventsEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-28 text-center">
      <div className="flex flex-col items-center gap-[4px]">
        <div className="flex size-[80px] items-center justify-center">
          <EmptyInboxIllustration className="size-[80px]" />
        </div>
        <p className="mt-1 font-sans text-[14px] leading-[24px] font-semibold text-[#525252]">
          رویداد و نمایشگاهی در سیستم موجود نیست
        </p>
        <p className="font-sans text-[12px] leading-[20px] font-normal text-[#737373]">
          در صورت ایجاد رویداد یا نمایشگاه به شما اطلاع رسانی خواهیم کرد
        </p>
      </div>
    </div>
  )
}

export function EventsView({
  initialEventsList = initialEvents,
  state = 'default',
}: EventsViewProps) {
  const [events] = useState<EventItem[]>(initialEventsList)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [registerModalEvent, setRegisterModalEvent] = useState<EventItem | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Registration modal form state
  const [companyName, setCompanyName] = useState('شرکت دانش‌بنیان نمونه')
  const [delegatesCount, setDelegatesCount] = useState('2')
  const [needsBooth, setNeedsBooth] = useState(true)

  const filteredEvents = useMemo(() => {
    if (state === 'empty') return []
    return events.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.dates.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesFilter = filterType === 'all' || item.badgeType === filterType

      return matchesSearch && matchesFilter
    })
  }, [events, searchQuery, filterType, state])

  const isLoading = state === 'loading'
  const isEmpty = !isLoading && filteredEvents.length === 0

  return (
    <div className="flex w-full flex-1 flex-col text-right" dir="rtl">
      {/* Toast Alert */}
      {actionNotice && (
        <div
          role="status"
          className="mb-4 flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50 p-3 text-brand-900 shadow-xs"
        >
          <Typography variant="14/regular" className="text-inherit">
            {actionNotice}
          </Typography>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="flex size-8 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-100"
            aria-label="بستن پیام"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>
      )}

      {/* Page Title - Figma node 56:13203 */}
      <h1 className="font-sans text-[24px] leading-[36px] font-bold text-[#404040]">
        رویدادها و نمایشگاه‌ها
      </h1>

      {/* Action Bar - Figma Frame 1 (56:13205) */}
      <div className="mt-5 flex items-center justify-start">
        <div className="flex h-[48px] w-full items-center gap-[8px] sm:w-[458px]">
          <div className="flex h-[48px] flex-1 items-center gap-[8px] overflow-hidden rounded-[8px] border border-[#f5f5f5] bg-white px-[12px] py-[8px] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 sm:w-[400px]">
            <SearchNormalIcon className="size-[24px] shrink-0 text-[#d4d4d4]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="درخواست خود را جست و جو کنید"
              aria-label="جستجوی رویدادها"
              className="h-[28px] w-full bg-transparent text-right font-sans text-[16px] leading-[28px] font-normal text-[#525252] outline-none placeholder:text-[#d4d4d4]"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex h-[48px] w-[50px] shrink-0 items-center justify-center rounded-[12px] bg-white transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  filterType !== 'all'
                    ? 'text-brand-600 ring-2 ring-brand-500/20'
                    : 'text-[#525252]'
                }`}
                title="فیلتر رویدادها"
              >
                <FilterIcon className="size-[26px]" />
                <span className="sr-only">فیلتر</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-52 rounded-xl border border-neutral-100 bg-white p-1.5 shadow-md"
            >
              <DropdownMenuItem
                onClick={() => setFilterType('all')}
                className={`flex h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 text-sm ${
                  filterType === 'all'
                    ? 'bg-brand-50 font-medium text-brand-600'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>همه رویدادها</span>
                {filterType === 'all' && <Check className="size-4 text-brand-600" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterType('ended')}
                className={`flex h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 text-sm ${
                  filterType === 'ended'
                    ? 'bg-brand-50 font-medium text-brand-600'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>تمام شده</span>
                {filterType === 'ended' && <Check className="size-4 text-brand-600" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterType('active')}
                className={`flex h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 text-sm ${
                  filterType === 'active'
                    ? 'bg-brand-50 font-medium text-brand-600'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>در حال ثبت‌نام</span>
                {filterType === 'active' && <Check className="size-4 text-brand-600" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search Input - Figma node 56:13207 */}
        </div>
      </div>

      {/* Main Events Card - Figma Frame 6 (56:13208) */}
      <section className="relative mt-[16px] flex w-full flex-col gap-[32px] rounded-[16px] border border-[#e5e5e5] bg-white p-[16px]">
        {isLoading ? (
          <EventsSkeleton />
        ) : (
          <>
            {!isEmpty && (
              <div className="flex flex-col gap-[32px]">
                {filteredEvents.map((evt) => (
                  <article
                    key={evt.id}
                    className="flex flex-col-reverse items-start justify-end gap-[16px] sm:h-[200px] sm:flex-row"
                  >
                    <div className="relative size-[200px] shrink-0 overflow-hidden rounded-[8px] bg-slate-100">
                      <Image
                        src={evt.imageSrc}
                        alt={evt.title}
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    </div>
                    {/* Content Column on Left (Frame 46) */}
                    <div className="flex h-[176px] w-full flex-1 flex-col justify-between py-1">
                      {/* Top Section: Tag and Title (Frame 41) */}
                      <div className="flex flex-col items-start gap-[16px]">
                        <span className="inline-flex h-[24px] items-center justify-center rounded-[40px] bg-[#f5f5f5] px-[12px] py-[4px] font-sans text-[14px] leading-[24px] font-normal text-[#525252]">
                          {evt.badgeText}
                        </span>
                        <h2 className="font-sans text-[18px] leading-[32px] font-bold text-[#404040] sm:text-[20px]">
                          {evt.title}
                        </h2>
                      </div>

                      {/* Bottom Section: Details + Action Button */}
                      {evt.hasActionButton ? (
                        /* Frame 91: Has Date/Location + Button */
                        <div className="flex flex-wrap items-end justify-between gap-4">
                          {/* Date and Location */}
                          <div className="flex flex-col gap-[16px]">
                            <div className="flex items-center gap-[8px]">
                              <CalendarBulkIcon className="size-[28px] shrink-0 text-[#a3a3a3]" />
                              <span className="font-sans text-[16px] leading-[28px] font-semibold text-[#525252]">
                                {evt.dates}
                              </span>
                            </div>
                            <div className="flex items-center gap-[8px]">
                              <LocationBulkIcon className="size-[28px] shrink-0 text-[#a3a3a3]" />
                              <span className="font-sans text-[16px] leading-[28px] font-semibold text-[#525252]">
                                {evt.location}
                              </span>
                            </div>
                          </div>

                          {/* "ثبت درخواست" Button - Figma node 56:14063 */}
                          <button
                            type="button"
                            onClick={() => setRegisterModalEvent(evt)}
                            className="flex h-[40px] items-center justify-center gap-[8px] rounded-[10px] bg-[#3b82f6] px-[12px] py-[8px] text-white shadow-xs transition-colors hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-brand-500"
                          >
                            <span className="font-sans text-[16px] leading-[28px] font-semibold">
                              {evt.actionButtonText || 'ثبت درخواست'}
                            </span>
                            <TickSquareIcon className="size-[24px] shrink-0 stroke-white" />
                          </button>
                        </div>
                      ) : (
                        /* Frame 44: Date and Location only */
                        <div className="flex flex-col gap-[16px]">
                          <div className="flex items-center gap-[8px]">
                            <CalendarBulkIcon className="size-[28px] shrink-0 text-[#a3a3a3]" />
                            <span className="font-sans text-[16px] leading-[28px] font-semibold text-[#525252]">
                              {evt.dates}
                            </span>
                          </div>
                          <div className="flex items-center gap-[8px]">
                            <LocationBulkIcon className="size-[28px] shrink-0 text-[#a3a3a3]" />
                            <span className="font-sans text-[16px] leading-[28px] font-semibold text-[#525252]">
                              {evt.location}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Square Thumbnail on Right (Frame 60) - 200px × 200px */}
                  </article>
                ))}
              </div>
            )}

            {/* Empty State */}
            {isEmpty && <EventsEmptyState />}
          </>
        )}
      </section>

      {/* Registration / Request Modal */}
      {registerModalEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          dir="rtl"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md animate-in rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl duration-150 zoom-in-95 fade-in">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <Typography as="h2" variant="20/bold" className="text-neutral-700">
                ثبت درخواست در رویداد
              </Typography>
              <button
                type="button"
                onClick={() => setRegisterModalEvent(null)}
                className="flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"
                aria-label="بستن پنجره"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-neutral-500">
              {registerModalEvent.title}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setRegisterModalEvent(null)
                setActionNotice(`درخواست حضور در «${registerModalEvent.title}» با موفقیت ثبت شد.`)
                setTimeout(() => setActionNotice(null), 4000)
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="mb-1.5 block">
                  <Typography variant="14/semibold" className="text-neutral-700">
                    نام شرکت متقاضی
                  </Typography>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block">
                  <Typography variant="14/semibold" className="text-neutral-700">
                    تعداد نمایندگان حاضر
                  </Typography>
                </label>
                <select
                  value={delegatesCount}
                  onChange={(e) => setDelegatesCount(e.target.value)}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
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
                  className="size-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
                <label
                  htmlFor="needsBoothCheck"
                  className="cursor-pointer text-xs text-neutral-700"
                >
                  متقاضی اختصاص کانتر / غرفه در پاویون اختصاصی هستم
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
                <Button
                  type="button"
                  variant="outline-gray"
                  onClick={() => setRegisterModalEvent(null)}
                  className="rounded-xl px-5"
                >
                  انصراف
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex items-center gap-2 rounded-xl px-6"
                >
                  <Send className="size-4" />
                  <span>ارسال درخواست</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
