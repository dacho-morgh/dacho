'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import {
  DashboardAddIcon,
  DashboardEmptyInboxIcon,
  DashboardFilterIcon,
  DashboardMessageTextIcon,
  DashboardMoreIcon,
  DashboardSearchIcon,
  DashboardTrashIcon,
} from '@/components/icons'
import { DashboardApiError, describeMutationFailure } from '@/utilities/dashboard-api'

export type AdminLetterStatus = 'rejected' | 'approved' | 'needs_fix' | 'official' | 'notification'

export interface AdminLetterItem {
  id: string
  title: string
  type: AdminLetterStatus
  typeLabel: string
  senderName: string
  senderRole: string
  senderAvatar?: string
  sentDate: string
  source: 'letter' | 'form' | 'ticket'
}

export function mapAdminLetter(
  item: {
    id: string
    title: string
    status: string
    statusLabel: string
    senderName: string
    senderRole: string
    sentDate: string
    source?: 'letter' | 'form' | 'ticket' | 'support'
  },
): AdminLetterItem {
  return {
    id: item.id,
    title: item.title,
    type: item.status as AdminLetterStatus,
    typeLabel: item.statusLabel,
    senderName: item.senderName,
    senderRole: item.senderRole,
    sentDate: item.sentDate,
    source: item.source === 'support' ? 'ticket' : (item.source ?? 'letter'),
  }
}

/* Exact tokens from Figma node 30851:15835 (نوع نامه column tags) */
const typeTagStyles: Record<AdminLetterStatus, { bg: string; text: string }> = {
  approved: { bg: 'bg-brand-50', text: 'text-brand-600' },
  needs_fix: { bg: 'bg-warning-50', text: 'text-warning-500' },
  rejected: { bg: 'bg-error-50', text: 'text-error-600' },
  official: { bg: 'bg-brand-50', text: 'text-brand-600' },
  notification: { bg: 'bg-neutral-100', text: 'text-neutral-600' },
}

function TypeTag({ type, label }: { type: AdminLetterStatus; label: string }) {
  const style = typeTagStyles[type] ?? typeTagStyles.notification
  return (
    <span
      className={`inline-flex h-[24px] items-center justify-center rounded-[40px] px-[12px] py-[4px] ${style.bg} ${style.text}`}
    >
      <Typography as="span" variant="14/regular" className="whitespace-nowrap text-inherit">
        {label}
      </Typography>
    </span>
  )
}

function TableHeaderCell({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div
      className={`flex h-[44px] items-center justify-end gap-[12px] border-b border-neutral-100 px-[16px] py-[12px] ${className}`}
    >
      <Typography variant="14/semibold" className="whitespace-nowrap text-neutral-400">
        {label}
      </Typography>
    </div>
  )
}

function SenderCell({ item }: { item: AdminLetterItem }) {
  return (
    <div className="flex items-center justify-end gap-[12px]">
      <div className="flex min-w-0 flex-col items-end whitespace-nowrap">
        <Typography variant="16/regular" className="truncate leading-[28px] text-neutral-600">
          {item.senderName}
        </Typography>
        <Typography variant="14/regular" className="truncate leading-[24px] text-neutral-500">
          {item.senderRole}
        </Typography>
      </div>
      <div className="relative size-[40px] shrink-0 overflow-hidden rounded-full bg-neutral-200">
        <Image
          src={item.senderAvatar || '/figma/dashboard/inbox-sender-avatar.png'}
          alt=""
          width={40}
          height={40}
          className="size-full rounded-full object-cover"
        />
      </div>
    </div>
  )
}

/* Loading state — Figma node 30851:15914: 4 equal columns × 5 bars, 40px high, 16px gap */
function LettersSkeleton() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری نامه‌ها"
      className="flex h-[816px] w-full flex-row-reverse justify-end gap-[16px]"
    >
      {[0, 1, 2, 3].map((col) => (
        <div key={col} className="flex min-w-0 flex-1 flex-col gap-[16px]">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-[40px] w-full shrink-0 rounded-[8px] bg-neutral-100" />
          ))}
        </div>
      ))}
    </div>
  )
}

/* Empty state — Figma node 30851:15880 */
function LettersEmptyState({ noMatch = false }: { noMatch?: boolean }) {
  return (
    <div className="absolute left-1/2 top-1/2 flex w-[265px] -translate-x-1/2 -translate-y-1/2 flex-col items-center">
      <div className="flex flex-col items-center gap-[4px]">
        <div className="flex size-[80px] items-center justify-center">
          <DashboardEmptyInboxIcon className="size-[80px]" />
        </div>
        <Typography variant="14/semibold" className="mt-1 text-center text-neutral-600">
          {noMatch ? 'نتیجه‌ای پیدا نشد' : 'صندوق نامه‌های شما خالیست'}
        </Typography>
        <Typography variant="12/regular" className="text-center text-neutral-500">
          {noMatch ? 'عبارت جستجو، فیلتر یا زبانه را تغییر دهید' : 'تا کنون نامه یا پیامی برای شما ارسال نشده است'}
        </Typography>
      </div>
    </div>
  )
}

export interface AdminLettersViewProps {
  initialLetters: AdminLetterItem[]
  state?: 'default' | 'loading' | 'empty'
}

/* Admin letters inbox — pixel match to Figma nodes 30851:15835 (default),
   30851:15914 (loading), 30851:15880 (empty), 30865:18433 (actions). */
export function AdminLettersView({ initialLetters, state = 'default' }: AdminLettersViewProps) {
  const [letters, setLetters] = useState(initialLetters)
  const [tab, setTab] = useState<'received' | 'sent' | 'support'>('received')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | AdminLetterStatus>('all')
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const showNotice = (message: string) => {
    setActionNotice(message)
    window.setTimeout(() => setActionNotice(null), 3500)
  }

  const handleDelete = async (item: AdminLetterItem) => {
    if (item.source !== 'letter') {
      showNotice('فرم‌های وب‌سایت از اینجا حذف نمی‌شوند.')
      return
    }
    try {
      const response = await fetch(`/api/dashboard/letters/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new DashboardApiError(response.status, 'delete_failed')
      setLetters((current) => current.filter((letter) => letter.id !== item.id))
      showNotice(`نامه «${item.title}» با موفقیت حذف گردید.`)
    } catch (cause) {
      showNotice(describeMutationFailure(cause, 'حذف نامه انجام نشد.'))
    }
  }

  const handleFeedback = (item: AdminLetterItem) => {
    showNotice('ثبت بازخورد برای نامه «' + item.title + '» به‌زودی فعال می‌شود.')
  }

  const filteredLetters = useMemo(() => {
    if (state === 'empty') return []
    const q = searchQuery.trim().toLocaleLowerCase('fa')
    return letters
      .filter((item) => {
        if (tab === 'support') return item.source === 'ticket'
        if (tab === 'sent') return item.source === 'letter'
        return item.source === 'form'
      })
      .filter((item) => {
        const matchesSearch =
          q.length === 0 ||
          [item.title, item.typeLabel, item.senderName, item.senderRole, item.sentDate].some((value) =>
            value.toLocaleLowerCase('fa').includes(q),
          )
        const matchesType = typeFilter === 'all' || item.type === typeFilter
        return matchesSearch && matchesType
      })
  }, [letters, searchQuery, typeFilter, state, tab])

  const isLoading = state === 'loading'
  const isEmpty = !isLoading && filteredLetters.length === 0

  return (
    <div className="flex w-full flex-col items-end gap-[16px]" dir="rtl">
      {/* Toolbar — Figma frames 30852:17808 / 30873:18804 */}
      <div className="flex w-full flex-wrap items-center justify-between gap-[8px]">
        {/* Left: نامه جدید button */}
        <Button asChild size="48" className="bg-brand-500 hover:bg-brand-600">
          <Link href="/dashboard/letters/new">
            <Typography as="span" variant="20/regular" className="text-inherit">نامه جدید</Typography>
            <DashboardAddIcon className="size-[26px] shrink-0 stroke-white" />
          </Link>
        </Button>

        {/* Right: tabs + filter + search */}
        <div className="flex min-w-0 flex-wrap items-center gap-[8px]">
          {/* Tabs — Figma frame 30865:18197 */}
          <div className="flex h-[48px] max-w-full items-start gap-[8px] overflow-x-auto rounded-[12px] bg-neutral-100 p-[6px]">
            <button
              type="button"
              onClick={() => setTab('sent')}
              aria-pressed={tab === 'sent'}
              className={`flex h-[36px] items-center gap-[8px] rounded-[10px] p-[8px] transition-colors ${
                tab === 'sent' ? 'bg-white' : 'bg-transparent'
              }`}
            >
              <Typography
                variant="16/regular"
                className={`whitespace-nowrap leading-[28px] ${tab === 'sent' ? 'text-neutral-700' : 'text-neutral-600'}`}
              >
                نامه‌های ارسالی
              </Typography>
            </button>
            <button
              type="button"
              onClick={() => setTab('received')}
              aria-pressed={tab === 'received'}
              className={`flex h-[36px] items-center gap-[8px] rounded-[10px] p-[8px] transition-colors ${
                tab === 'received' ? 'bg-white' : 'bg-transparent'
              }`}
            >
              <Typography
                variant="16/regular"
                className={`whitespace-nowrap leading-[28px] ${tab === 'received' ? 'text-neutral-700' : 'text-neutral-600'}`}
              >
                نامه‌های دریافتی
              </Typography>
            </button>
            <button
              type="button"
              onClick={() => setTab('support')}
              aria-pressed={tab === 'support'}
              className={`flex h-[36px] items-center gap-[8px] rounded-[10px] p-[8px] transition-colors ${
                tab === 'support' ? 'bg-white' : 'bg-transparent'
              }`}
            >
              <Typography
                variant="16/regular"
                className={`whitespace-nowrap leading-[28px] ${tab === 'support' ? 'text-neutral-700' : 'text-neutral-600'}`}
              >
                تیکت‌های پشتیبانی
              </Typography>
            </button>
          </div>

          {/* Filter button — Figma node 30852:17811 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="فیلتر نوع نامه"
                className={`flex h-[48px] shrink-0 items-center gap-[8px] rounded-[12px] bg-white px-[12px] py-[8px] transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  typeFilter !== 'all' ? 'text-brand-600 ring-2 ring-brand-500/20' : 'text-neutral-600'
                }`}
              >
                <DashboardFilterIcon className="size-[26px]" />
                <span className="sr-only">فیلتر</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-52 rounded-xl border border-neutral-100 bg-white p-1.5 shadow-md"
            >
              {(
                [
                  { value: 'all', label: 'همه انواع' },
                  { value: 'approved', label: 'تایید درخواست' },
                  { value: 'needs_fix', label: 'نیاز به اصلاح' },
                  { value: 'rejected', label: 'رد درخواست' },
                  { value: 'official', label: 'نامه رسمی' },
                  { value: 'notification', label: 'اطلاع رسانی' },
                ] as Array<{ value: 'all' | AdminLetterStatus; label: string }>
              ).map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setTypeFilter(option.value)}
                  className={`flex h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 text-sm ${
                    typeFilter === option.value ? 'bg-brand-50 font-medium text-brand-600' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span>{option.label}</span>
                  {typeFilter === option.value && <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-500" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search input — Figma node 30852:17812 */}
          <div className="flex h-[48px] w-full max-w-[400px] flex-col gap-[8px]">
            <div className="flex h-full w-full flex-1 items-center gap-[8px] overflow-hidden rounded-[8px] border border-neutral-100 bg-white px-[12px] py-[8px] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="درخواست خود را جست و جو کنید"
                aria-label="جستجوی نامه‌ها"
                className="h-[28px] min-w-0 flex-1 bg-transparent text-right text-[16px] font-normal leading-[28px] text-neutral-600 outline-none placeholder:text-neutral-300"
              />
              <DashboardSearchIcon className="size-[24px] shrink-0 text-neutral-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {actionNotice && (
        <div
          role="status"
          className="flex w-full items-center justify-between rounded-xl border border-brand-100 bg-brand-50 p-3 text-brand-900 shadow-xs"
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

      {/* Table card — Figma frame 30852:17813 */}
      <div className="relative min-h-[320px] w-full rounded-[16px] border border-neutral-200 bg-white p-3 sm:p-4 lg:flex lg:h-[848px] lg:flex-row-reverse lg:items-start lg:justify-end">
        {isLoading ? (
          <LettersSkeleton />
        ) : isEmpty ? (
          <LettersEmptyState noMatch={state !== 'empty' && (searchQuery.trim() !== '' || typeFilter !== 'all')} />
        ) : (
          <>
            <div className="hidden flex-row-reverse items-start justify-end lg:flex">
            {/* Column: عملیات (52px) — Figma frame 30852:17814 */}
            <div className="flex w-[52px] shrink-0 flex-col items-end">
              <div className="h-[44px] w-full border-b border-neutral-100" />
              {filteredLetters.map((item) => (
                <div key={item.id} className="flex h-[72px] w-full items-center border-b border-neutral-100 p-[16px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        title="منوی عملیات"
                        className="flex size-[20px] shrink-0 cursor-pointer items-center justify-center text-neutral-600 transition-colors hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-brand-500"
                      >
                        <DashboardMoreIcon className="size-[20px]" />
                        <span className="sr-only">منوی عملیات</span>
                      </button>
                    </DropdownMenuTrigger>
                    {/* Action dropdown — Figma node 30865:18777 */}
                    <DropdownMenuContent
                      align="start"
                      sideOffset={6}
                      className="flex w-[164px] min-w-[164px] flex-col gap-[4px] rounded-[12px] border-0 bg-white p-[4px] shadow-[0px_2px_4px_rgba(21,21,21,0.1)]"
                    >
                      {item.source === 'ticket' ? (
                        <DropdownMenuItem asChild className="h-8 rounded-[10px] px-1.5">
                          <Link href={`/dashboard/letters/${encodeURIComponent(item.id)}`}>
                            <DashboardMessageTextIcon className="size-5" />
                            <Typography as="span" variant="14/regular" className="text-neutral-700">پاسخ به تیکت</Typography>
                          </Link>
                        </DropdownMenuItem>
                      ) : <>
                      <DropdownMenuItem
                        onClick={() => handleFeedback(item)}
                        className="flex h-[32px] w-full cursor-pointer items-center justify-end gap-[8px] rounded-[10px] px-[6px] py-[8px] text-[14px] text-neutral-700 hover:bg-neutral-50 focus:bg-neutral-50"
                      >
                        <Typography as="span" variant="14/regular" className="text-inherit">
                          ثبت بازخورد
                        </Typography>
                        <DashboardMessageTextIcon className="size-[20px] shrink-0 text-neutral-700" />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(item)}
                        className="flex h-[32px] w-full cursor-pointer items-center justify-end gap-[8px] rounded-[10px] px-[6px] py-[8px] text-[14px] text-neutral-700 hover:bg-neutral-50 focus:bg-neutral-50"
                      >
                        <Typography as="span" variant="14/regular" className="text-inherit">
                          پاک کردن
                        </Typography>
                        <DashboardTrashIcon className="size-[20px] shrink-0" />
                      </DropdownMenuItem>
                      </>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>

            {/* Column: تاریخ ارسال (120px) — Figma frame 30852:17821 */}
            <div className="flex w-[120px] shrink-0 flex-col items-end">
              <TableHeaderCell label="تاریخ ارسال" />
              {filteredLetters.map((item) => (
                <div key={item.id} className="flex h-[72px] w-full items-center justify-end border-b border-neutral-100 p-[16px]">
                  <Typography variant="16/regular" className="whitespace-nowrap leading-[28px] text-neutral-600">
                    {item.sentDate}
                  </Typography>
                </div>
              ))}
            </div>

            {/* Column: فرستنده (240px) — Figma frame 30852:17828 */}
            <div className="flex w-[240px] shrink-0 flex-col items-end">
              <TableHeaderCell label={tab === 'sent' ? 'گیرنده' : 'فرستنده'} />
              {filteredLetters.map((item) => (
                <div key={item.id} className="flex h-[72px] w-full items-center justify-end gap-[12px] border-b border-neutral-100 p-[16px]">
                  <SenderCell item={item} />
                </div>
              ))}
            </div>

            {/* Column: عنوان (flex) — Figma frame 30852:17835 */}
            <div className="flex min-w-0 flex-1 flex-col items-end">
              <TableHeaderCell label="عنوان" className="w-full" />
              {filteredLetters.map((item) => (
                <div key={item.id} className="flex h-[72px] w-full items-center justify-end border-b border-neutral-100 p-[16px]">
                  <Link
                    href={`/dashboard/letters/${encodeURIComponent(item.id)}`}
                    className="block w-full truncate text-right text-[16px] font-normal leading-[28px] text-neutral-600 transition-colors hover:text-brand-600"
                  >
                    {item.title}
                  </Link>
                </div>
              ))}
            </div>

            {/* Column: نوع نامه (200px) — Figma frame 30852:17842 */}
            <div className="flex w-[200px] shrink-0 flex-col items-end">
              <TableHeaderCell label="نوع نامه" />
              {filteredLetters.map((item) => (
                <div key={item.id} className="flex h-[72px] w-full items-center justify-end border-b border-neutral-100 p-[16px]">
                  <TypeTag type={item.type} label={item.typeLabel} />
                </div>
              ))}
            </div>
            </div>
            <div className="w-full space-y-3 lg:hidden">
              {filteredLetters.map((item) => (
                <article key={item.id} className="rounded-xl border border-neutral-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <TypeTag type={item.type} label={item.typeLabel} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="text-gray" size="icon-sm" className="size-10 shrink-0 rounded-lg hover:bg-neutral-100" aria-label={`عملیات نامه ${item.title}`}>
                          <DashboardMoreIcon className="size-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[164px]">
                        {item.source === 'ticket' ? (
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/letters/${encodeURIComponent(item.id)}`}>
                              <DashboardMessageTextIcon className="size-5" />
                              <Typography as="span" variant="14/regular">مشاهده و پاسخ</Typography>
                            </Link>
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onSelect={() => handleFeedback(item)}>
                              <DashboardMessageTextIcon className="size-5" />
                              <Typography as="span" variant="14/regular">ثبت بازخورد</Typography>
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(item)}>
                              <DashboardTrashIcon className="size-5" />
                              <Typography as="span" variant="14/regular">پاک کردن</Typography>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Typography asChild variant="16/regular" className="mt-2 block break-words text-right leading-7 text-neutral-700 hover:text-brand-600">
                    <Link href={`/dashboard/letters/${encodeURIComponent(item.id)}`}>{item.title}</Link>
                  </Typography>
                  <div className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                    <div className="min-w-0 flex-1"><SenderCell item={item} /></div>
                    <Typography variant="14/regular" className="shrink-0 whitespace-nowrap text-neutral-500">{item.sentDate}</Typography>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
