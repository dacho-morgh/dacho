'use client'

import Image from 'next/image'
import Link from 'next/link'
import React, { useMemo, useState } from 'react'
import {
  DashboardUserTagIcon,
  EmptyInboxIllustration,
  FilterIcon,
  Message2Icon,
  MoreOptionsIcon,
  SearchNormalIcon,
  TrashIcon,
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
import { SupportModal } from './support-modal'

export type LetterStatus = 'rejected' | 'approved' | 'needs_fix' | 'official' | 'notification'

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

export const mockLetters: LetterItem[] = [
  {
    id: 'LTR-501',
    title: 'همایش نفت و گاز عسلویه',
    status: 'rejected',
    statusLabel: 'رد درخواست',
    senderName: 'نام و نام خانوادگی',
    senderRole: 'عنوان و سمت',
    senderAvatar: '/figma/dashboard/inbox-sender-avatar.png',
    sentDate: '۱۴۰۵/۰۱/۰۶',
  },
  {
    id: 'LTR-502',
    title: 'همایش نفت و گاز عسلویه',
    status: 'approved',
    statusLabel: 'تایید درخواست',
    senderName: 'نام و نام خانوادگی',
    senderRole: 'عنوان و سمت',
    senderAvatar: '/figma/dashboard/inbox-sender-avatar.png',
    sentDate: '۱۴۰۵/۰۱/۰۶',
  },
  {
    id: 'LTR-503',
    title: 'همایش نفت و گاز عسلویه',
    status: 'needs_fix',
    statusLabel: 'نیاز به اصلاح درخواست',
    senderName: 'نام و نام خانوادگی',
    senderRole: 'عنوان و سمت',
    senderAvatar: '/figma/dashboard/inbox-sender-avatar.png',
    sentDate: '۱۴۰۵/۰۱/۰۶',
  },
  {
    id: 'LTR-504',
    title: 'همایش نفت و گاز عسلویه',
    status: 'official',
    statusLabel: 'نامه رسمی',
    senderName: 'نام و نام خانوادگی',
    senderRole: 'عنوان و سمت',
    senderAvatar: '/figma/dashboard/inbox-sender-avatar.png',
    sentDate: '۱۴۰۵/۰۱/۰۶',
  },
  {
    id: 'LTR-505',
    title: 'همایش نفت و گاز عسلویه',
    status: 'notification',
    statusLabel: 'اطلاع رسانی',
    senderName: 'نام و نام خانوادگی',
    senderRole: 'عنوان و سمت',
    senderAvatar: '/figma/dashboard/inbox-sender-avatar.png',
    sentDate: '۱۴۰۵/۰۱/۰۶',
  },
]

const filterOptions: Array<{ value: 'all' | LetterStatus; label: string }> = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'rejected', label: 'رد درخواست' },
  { value: 'approved', label: 'تایید درخواست' },
  { value: 'needs_fix', label: 'نیاز به اصلاح درخواست' },
  { value: 'official', label: 'نامه رسمی' },
  { value: 'notification', label: 'اطلاع رسانی' },
]

// Exact tokens from Figma node 53:12475
const statusTagStyles: Record<LetterStatus, { bg: string; text: string }> = {
  rejected: { bg: 'bg-[#fef2f2]', text: 'text-[#dc2626]' },
  approved: { bg: 'bg-[#f0fdf4]', text: 'text-[#16a34a]' },
  needs_fix: { bg: 'bg-[#fefce8]', text: 'text-[#ca8a04]' },
  official: { bg: 'bg-[#eef2ff]', text: 'text-[#2563eb]' },
  notification: { bg: 'bg-[#f5f5f5]', text: 'text-[#525252]' },
}

export interface InboxListViewProps {
  initialLetters?: LetterItem[]
  state?: 'default' | 'loading' | 'empty'
}

function StatusBadge({ status, label }: { status: LetterStatus; label: string }) {
  const style = statusTagStyles[status] ?? statusTagStyles.notification

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

function SenderCell({ item }: { item: LetterItem }) {
  return (
    <div className="flex items-center gap-[12px]">
      <Image
        src={item.senderAvatar || '/figma/dashboard/inbox-sender-avatar.png'}
        alt=""
        width={40}
        height={40}
        className="size-[40px] shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0 text-right">
        <Typography variant="16/regular" className="truncate text-[#525252]">
          {item.senderName}
        </Typography>
        <Typography variant="14/regular" className="truncate text-[#737373]">
          {item.senderRole}
        </Typography>
      </div>
    </div>
  )
}

function LetterActions({
  item,
  onFeedback,
  onDelete,
}: {
  item: LetterItem
  onFeedback: (item: LetterItem) => void
  onDelete: (item: LetterItem) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mx-auto flex size-[32px] items-center justify-center rounded-[10px] text-[#525252] transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-brand-500"
          title="منوی عملیات"
        >
          <MoreOptionsIcon className="size-[20px]" />
          <span className="sr-only">منوی عملیات</span>
        </button>
      </DropdownMenuTrigger>
      {/* Dropdown matching Figma node 53:12461 */}
      <DropdownMenuContent
        align="start"
        alignOffset={-6}
        sideOffset={6}
        className="flex w-[164px] min-w-[164px] flex-col gap-[4px] rounded-[12px] border border-neutral-100 bg-white p-[4px] shadow-[0px_2px_4px_rgba(21,21,21,0.1)]"
      >
        <DropdownMenuItem
          onClick={() => onFeedback(item)}
          className="flex h-[32px] cursor-pointer items-center justify-end gap-[8px] rounded-[10px] px-[6px] py-[8px] text-[14px] text-[#404040] hover:bg-neutral-100 focus:bg-neutral-100"
        >
          <Typography as="span" variant="14/regular" className="text-inherit">
            ثبت بازخورد
          </Typography>
          <Message2Icon className="size-[20px] shrink-0 text-[#404040]" />
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(item)}
          className="flex h-[32px] cursor-pointer items-center justify-end gap-[8px] rounded-[10px] px-[6px] py-[8px] text-[14px] text-[#404040] hover:bg-neutral-100 focus:bg-neutral-100"
        >
          <Typography as="span" variant="14/regular" className="text-inherit">
            پاک کردن
          </Typography>
          <TrashIcon className="size-[20px] shrink-0 text-[#404040]" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Loading Skeleton matching Figma node 53:11851
function InboxSkeleton() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری نامه‌ها"
      className="grid w-full grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4"
    >
      {[0, 1, 2, 3].map((col) => (
        <div key={col} className="flex flex-col gap-[16px]">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-[40px] w-full rounded-[8px] bg-[#f5f5f5]" />
          ))}
        </div>
      ))}
    </div>
  )
}

// Empty State matching Figma node 53:12108
function InboxEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
      <div className="flex flex-col items-center gap-[4px]">
        <div className="flex size-[80px] items-center justify-center">
          <EmptyInboxIllustration className="size-[80px]" />
        </div>
        <p className="mt-1 font-sans text-[14px] leading-[24px] font-semibold text-[#525252]">
          صندوق نامه‌های شما خالیست
        </p>
        <p className="font-sans text-[12px] leading-[20px] font-normal text-[#737373]">
          تا کنون نامه یا پیامی برای شما ارسال نشده است
        </p>
      </div>
    </div>
  )
}

export function InboxListView({
  initialLetters = mockLetters,
  state = 'default',
}: InboxListViewProps) {
  const [letters, setLetters] = useState(initialLetters)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | LetterStatus>('all')
  const [supportModalOpen, setSupportModalOpen] = useState(false)
  const [feedbackModalLetter, setFeedbackModalLetter] = useState<LetterItem | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const filteredLetters = useMemo(() => {
    if (state === 'empty') return []

    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('fa')
    return letters.filter((item) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        [item.title, item.statusLabel, item.senderName, item.senderRole, item.sentDate].some(
          (value) => value.toLocaleLowerCase('fa').includes(normalizedQuery),
        )
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [letters, searchQuery, state, statusFilter])

  const isLoading = state === 'loading'
  const isEmpty = !isLoading && filteredLetters.length === 0

  const showNotice = (message: string) => {
    setActionNotice(message)
    window.setTimeout(() => setActionNotice(null), 3500)
  }

  const handleDelete = (item: LetterItem) => {
    setLetters((current) => current.filter((letter) => letter.id !== item.id))
    showNotice(`نامه «${item.title}» با موفقیت حذف گردید.`)
  }

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

      {/* Page Title - Figma node 33:3921 */}
      <h1 className="font-sans text-[24px] leading-[36px] font-bold text-[#404040]">
        کارتابل نامه
      </h1>

      {/* Action Bar - Figma Frame 1 (33:3923) */}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Side: Button "پیام به پشتیبانی" - Figma node 33:3924 */}

        {/* Right Side: Search Input + Filter - Figma Frame 84 (53:12430) */}
        <div className="flex h-[48px] w-full items-center gap-[8px] sm:w-[458px]">
          <div className="flex h-[48px] flex-1 items-center gap-[8px] overflow-hidden rounded-[8px] border border-[#f5f5f5] bg-white px-[12px] py-[8px] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 sm:w-[400px]">
            <SearchNormalIcon className="size-[24px] shrink-0 text-[#d4d4d4]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="درخواست خود را جست و جو کنید"
              aria-label="جستجوی نامه‌ها"
              className="h-[28px] w-full bg-transparent text-right font-sans text-[16px] leading-[28px] font-normal text-[#525252] outline-none placeholder:text-[#d4d4d4]"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex h-[48px] w-[50px] shrink-0 items-center justify-center rounded-[12px] bg-white transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  statusFilter !== 'all'
                    ? 'text-brand-600 ring-2 ring-brand-500/20'
                    : 'text-[#525252]'
                }`}
                title="فیلتر وضعیت نامه"
              >
                <FilterIcon className="size-[26px]" />
                <span className="sr-only">فیلتر</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-52 rounded-xl border border-neutral-100 bg-white p-1.5 shadow-md"
            >
              {filterOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                  className={`flex h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 text-sm ${
                    statusFilter === option.value
                      ? 'bg-brand-50 font-medium text-brand-600'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span>{option.label}</span>
                  {statusFilter === option.value && (
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-500" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search Input - Figma node 33:3925 */}
        </div>
        <button
          type="button"
          onClick={() => setSupportModalOpen(true)}
          className="flex h-[48px] w-full items-center justify-center gap-[8px] rounded-[12px] bg-[#3b82f6] px-[12px] py-[8px] text-white shadow-xs transition-colors hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-brand-500 sm:w-[199px]"
        >
          <span className="font-sans text-[20px] leading-[32px] font-normal">پیام به پشتیبانی</span>
          <DashboardUserTagIcon className="size-[26px] shrink-0 stroke-white" />
        </button>
      </div>

      {/* Main Table Card - Figma Frame 6 (33:3926) */}
      <section className="relative mt-[16px] flex h-fit h-full w-full flex-col rounded-[16px] border border-[#e5e5e5] bg-white p-[16px]">
        {isLoading ? (
          <InboxSkeleton />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full table-fixed border-collapse text-right">
                <colgroup>
                  <col className="w-[200px]" />
                  <col />
                  <col className="w-[240px]" />
                  <col className="w-[120px]" />
                  <col className="w-[52px]" />
                </colgroup>
                <thead>
                  <tr className="h-[44px] border-b border-[#f5f5f5]">
                    <th scope="col" className="h-[44px] px-[16px] py-[12px] font-normal">
                      <p className="font-sans text-[14px] leading-[24px] font-semibold text-[#a3a3a3]">
                        وضعیت
                      </p>
                    </th>
                    <th scope="col" className="h-[44px] px-[16px] py-[12px] font-normal">
                      <p className="font-sans text-[14px] leading-[24px] font-semibold text-[#a3a3a3]">
                        عنوان
                      </p>
                    </th>
                    <th scope="col" className="h-[44px] px-[16px] py-[12px] font-normal">
                      <p className="font-sans text-[14px] leading-[24px] font-semibold text-[#a3a3a3]">
                        فرستنده
                      </p>
                    </th>
                    <th scope="col" className="h-[44px] px-[16px] py-[12px] font-normal">
                      <p className="font-sans text-[14px] leading-[24px] font-semibold text-[#a3a3a3]">
                        تاریخ ارسال
                      </p>
                    </th>
                    <th scope="col" className="h-[44px] px-[16px] py-[12px]">
                      <span className="sr-only">عملیات</span>
                    </th>
                  </tr>
                </thead>
                {!isEmpty && (
                  <tbody>
                    {filteredLetters.map((item) => (
                      <tr
                        key={item.id}
                        className="h-[72px] border-b border-[#f5f5f5] transition-colors hover:bg-neutral-50/50"
                      >
                        {/* 1. Status Column */}
                        <td className="h-[72px] px-[16px]">
                          <StatusBadge status={item.status} label={item.statusLabel} />
                        </td>

                        {/* 2. Title Column */}
                        <td className="h-[72px] px-[16px]">
                          <Link
                            href={`/dashboard/letters/${item.id}`}
                            className="block truncate font-sans text-[16px] leading-[28px] font-normal text-[#525252] transition-colors hover:text-[#2563eb]"
                          >
                            {item.title}
                          </Link>
                        </td>

                        {/* 3. Sender Column */}
                        <td className="h-[72px] px-[16px]">
                          <SenderCell item={item} />
                        </td>

                        {/* 4. Sent Date Column */}
                        <td className="h-[72px] px-[16px]">
                          <p className="font-sans text-[16px] leading-[28px] font-normal whitespace-nowrap text-[#525252]">
                            {item.sentDate}
                          </p>
                        </td>

                        {/* 5. Actions Column */}
                        <td className="h-[72px] px-[16px] text-center">
                          <LetterActions
                            item={item}
                            onFeedback={setFeedbackModalLetter}
                            onDelete={handleDelete}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>

            {/* Mobile / Tablet Responsive Cards */}
            {!isEmpty && (
              <div className="space-y-3 lg:hidden">
                {filteredLetters.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-neutral-100 p-4 transition-colors hover:bg-neutral-50/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <StatusBadge status={item.status} label={item.statusLabel} />
                      <LetterActions
                        item={item}
                        onFeedback={setFeedbackModalLetter}
                        onDelete={handleDelete}
                      />
                    </div>
                    <Link
                      href={`/dashboard/letters/${item.id}`}
                      className="mt-3 block font-sans text-[16px] leading-[28px] font-normal text-[#525252] hover:text-[#2563eb]"
                    >
                      {item.title}
                    </Link>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                      <SenderCell item={item} />
                      <span className="shrink-0 font-sans text-[14px] text-[#737373]">
                        {item.sentDate}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Empty State */}
            {isEmpty && <InboxEmptyState />}
          </>
        )}
      </section>

      {/* Connect to Support Modal */}
      <SupportModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        onSuccess={(code) => {
          showNotice(`پیام شما با کد پیگیری ${code} با موفقیت برای پشتیبانی ارسال گردید.`)
        }}
      />

      {/* Feedback Modal */}
      {feedbackModalLetter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          dir="rtl"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md animate-in rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl duration-150 zoom-in-95 fade-in">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <Typography as="h2" variant="20/bold" className="text-neutral-700">
                ثبت بازخورد
              </Typography>
              <button
                type="button"
                onClick={() => setFeedbackModalLetter(null)}
                className="flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"
                aria-label="بستن پنجره"
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  ×
                </span>
              </button>
            </div>
            <Typography variant="14/regular" className="mt-4 text-neutral-600">
              بازخورد شما در رابطه با «{feedbackModalLetter.title}» مستقیماً برای ارسال‌کننده نامه
              ارسال می‌شود.
            </Typography>
            <textarea
              rows={4}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="نظر یا بازخورد خود را در اینجا بنویسید..."
              className="mt-3 w-full rounded-xl border border-neutral-200 bg-white p-3 font-sans text-sm text-neutral-700 placeholder:text-neutral-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline-gray"
                onClick={() => setFeedbackModalLetter(null)}
                className="rounded-xl px-5"
              >
                انصراف
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!feedbackText.trim()}
                onClick={() => {
                  setFeedbackModalLetter(null)
                  setFeedbackText('')
                  showNotice('بازخورد شما با موفقیت ثبت و ارسال شد.')
                }}
                className="rounded-xl px-6"
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
