'use client'

import { Check } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  CalendarBulkIcon,
  EmptyInboxIllustration,
  FilterIcon,
  LocationBulkIcon,
  SearchNormalIcon,
  TickSquareIcon,
} from '@/components/icons'
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
  serviceKey: 'events' | 'exhibitions'
  title: string
  badgeText: string
  badgeType: 'ended' | 'active' | 'upcoming'
  dates: string
  location: string
  imageSrc?: string
  hasActionButton?: boolean
  actionButtonText?: string
}

export interface EventsViewProps {
  initialEventsList?: EventItem[]
  state?: 'default' | 'loading' | 'empty'
  isOwner?: boolean
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
function EventsEmptyState({ noMatch = false }: { noMatch?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-28 text-center">
      <div className="flex flex-col items-center gap-[4px]">
        <div className="flex size-[80px] items-center justify-center">
          <EmptyInboxIllustration className="size-[80px]" />
        </div>
        <p className="mt-1 font-sans text-[14px] leading-[24px] font-semibold text-[#525252]">
          {noMatch ? 'نتیجه‌ای پیدا نشد' : 'رویداد و نمایشگاهی در سیستم موجود نیست'}
        </p>
        <p className="font-sans text-[12px] leading-[20px] font-normal text-[#737373]">
          {noMatch ? 'عبارت جستجو یا فیلتر را تغییر دهید' : 'در صورت ایجاد رویداد یا نمایشگاه به شما اطلاع رسانی خواهیم کرد'}
        </p>
      </div>
    </div>
  )
}

export function EventsView({
  initialEventsList = [],
  state = 'default',
  isOwner = false,
}: EventsViewProps) {
  const router = useRouter()
  const [events] = useState<EventItem[]>(initialEventsList)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

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
                      {evt.imageSrc ? (
                        <Image
                          src={evt.imageSrc}
                          alt={evt.title}
                          fill
                          className="object-cover"
                          sizes="200px"
                        />
                      ) : (
                        <Typography
                          variant="14/regular"
                          className="flex h-full items-center justify-center text-neutral-400"
                        >
                          تصویری ثبت نشده است
                        </Typography>
                      )}
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
                      {(isOwner && evt.serviceKey === 'exhibitions') ||
                      (!isOwner && evt.hasActionButton) ? (
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

                          {/* Action Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isOwner && evt.serviceKey === 'exhibitions') {
                                const rawId = evt.id.replace(/^exhibitions-/, '')
                                router.push(`/dashboard/exhibitions/${encodeURIComponent(rawId)}`)
                              } else {
                                router.push(
                                  `/dashboard/new-request?service=${evt.serviceKey}&eventId=${encodeURIComponent(evt.id)}&eventTitle=${encodeURIComponent(evt.title)}`,
                                )
                              }
                            }}
                            className="flex h-[40px] items-center justify-center gap-[8px] rounded-[10px] bg-[#3b82f6] px-[12px] py-[8px] text-white shadow-xs transition-colors hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-brand-500"
                          >
                            <span className="font-sans text-[16px] leading-[28px] font-semibold">
                              {isOwner && evt.serviceKey === 'exhibitions'
                                ? 'مدیریت غرفه‌ها'
                                : evt.actionButtonText || 'ثبت درخواست'}
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
            {isEmpty && <EventsEmptyState noMatch={state !== 'empty' && events.length > 0} />}
          </>
        )}
      </section>
    </div>
  )
}
