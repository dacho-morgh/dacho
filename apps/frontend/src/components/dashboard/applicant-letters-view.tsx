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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import {
  DashboardEmptyInboxIcon,
  DashboardFilterIcon,
  DashboardMessageTextIcon,
  DashboardMoreIcon,
  DashboardSearchIcon,
  DashboardTrashIcon,
  DashboardUserTagIcon,
} from '@/components/icons'
import { deleteLetter } from '@/utilities/dashboard-api'

export type ApplicantLetterStatus = 'rejected' | 'approved' | 'needs_fix' | 'official' | 'notification'

export interface ApplicantLetterItem {
  id: string
  title: string
  type: ApplicantLetterStatus
  typeLabel: string
  senderName: string
  senderRole: string
  senderAvatar?: string
  sentDate: string
  source?: 'letter' | 'ticket'
}

const statusTagStyles: Record<ApplicantLetterStatus, { bg: string; text: string }> = {
  approved: { bg: 'bg-success-50', text: 'text-success-600' },
  needs_fix: { bg: 'bg-warning-50', text: 'text-warning-600' },
  rejected: { bg: 'bg-error-50', text: 'text-error-600' },
  official: { bg: 'bg-brand-50', text: 'text-brand-600' },
  notification: { bg: 'bg-neutral-100', text: 'text-neutral-600' },
}

function StatusTag({ type, label }: { type: ApplicantLetterStatus; label: string }) {
  const style = statusTagStyles[type] ?? statusTagStyles.notification
  return (
    <span className={`inline-flex h-[24px] items-center justify-center rounded-[40px] px-[12px] py-[4px] ${style.bg} ${style.text}`}>
      <Typography as="span" variant="14/regular" className="whitespace-nowrap text-inherit">
        {label}
      </Typography>
    </span>
  )
}

function TableHeaderCell({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`flex h-[44px] items-center justify-end gap-[12px] border-b border-neutral-100 px-[16px] py-[12px] ${className}`}>
      <Typography variant="14/semibold" className="whitespace-nowrap text-neutral-400">
        {label}
      </Typography>
    </div>
  )
}

function SenderCell({ item }: { item: ApplicantLetterItem }) {
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

/* Loading state — Figma node 53:11620: 4 equal columns × 5 bars, 40px high, 16px gap */
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

/* Empty state — Figma node 53:11877 */
function LettersEmptyState() {
  return (
    <div className="absolute left-1/2 top-1/2 flex w-[265px] -translate-x-1/2 -translate-y-1/2 flex-col items-center">
      <div className="flex flex-col items-center gap-[4px]">
        <div className="flex size-[80px] items-center justify-center">
          <DashboardEmptyInboxIcon className="size-[80px]" />
        </div>
        <Typography variant="14/semibold" className="mt-1 text-center text-neutral-600">
          صندوق نامه‌های شما خالیست
        </Typography>
        <Typography variant="12/regular" className="text-center text-neutral-500">
          تا کنون نامه یا پیامی برای شما ارسال نشده است
        </Typography>
      </div>
    </div>
  )
}

export interface ApplicantLettersViewProps {
  initialLetters: ApplicantLetterItem[]
  state?: 'default' | 'loading' | 'empty'
}

/* Applicant letters inbox — pixel match to Figma nodes 33:3919 (default),
   53:11620 (loading), 53:11877 (empty), 53:12126 (row actions). */
export function ApplicantLettersView({ initialLetters, state = 'default' }: ApplicantLettersViewProps) {
  const [tab, setTab] = useState<'received' | 'sent' | 'support'>('received')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const filteredLetters = useMemo(() => {
    const query = searchQuery.trim()
    return initialLetters
      .filter((item) => {
        if (tab === 'support') return item.source === 'ticket'
        if (tab === 'sent') return false
        return item.source !== 'ticket'
      })
      .filter((item) => !query || [item.title, item.senderName, item.typeLabel].some((value) => value?.includes(query)))
  }, [initialLetters, searchQuery, tab])

  const handleDelete = async (item: ApplicantLetterItem) => {
    if (item.source === 'ticket') return
    try {
      await deleteLetter(item.id)
      setActionNotice(null)
      window.location.reload()
    } catch {
      setActionNotice('حذف نامه انجام نشد.')
      window.setTimeout(() => setActionNotice(null), 3500)
    }
  }

  const showTable = state === 'default' && filteredLetters.length > 0

  return (
    <div className="flex w-full min-w-0 flex-col gap-[16px]" dir="rtl">
      {/* Toolbar — Figma nodes 33:3923 / 53:12430: search right, filter left of it, CTA far left */}
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <Button
          asChild
          size="48"
          className="gap-[8px] rounded-[12px] bg-brand-500 px-[12px] py-[8px] text-white hover:bg-brand-600"
        >
          <Link href="/dashboard/letters/new?mode=support">
            <Typography as="span" variant="20/regular" className="text-white">
              پیام به پشتیبانی
            </Typography>
            <DashboardUserTagIcon className="size-[26px]" />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-wrap items-center gap-[8px]">
          <div className="flex h-[48px] max-w-full items-start gap-[8px] overflow-x-auto rounded-[12px] bg-neutral-100 p-[6px]">
            <button
              type="button"
              onClick={() => setTab('sent')}
              className={`flex h-[36px] items-center rounded-[10px] p-[8px] transition-colors ${tab === 'sent' ? 'bg-white' : 'bg-transparent'}`}
            >
              <Typography variant="16/regular" className={tab === 'sent' ? 'whitespace-nowrap text-neutral-700' : 'whitespace-nowrap text-neutral-600'}>
                نامه‌های ارسالی
              </Typography>
            </button>
            <button
              type="button"
              onClick={() => setTab('received')}
              className={`flex h-[36px] items-center rounded-[10px] p-[8px] transition-colors ${tab === 'received' ? 'bg-white' : 'bg-transparent'}`}
            >
              <Typography variant="16/regular" className={tab === 'received' ? 'whitespace-nowrap text-neutral-700' : 'whitespace-nowrap text-neutral-600'}>
                نامه‌های دریافتی
              </Typography>
            </button>
            <button
              type="button"
              onClick={() => setTab('support')}
              className={`flex h-[36px] items-center rounded-[10px] p-[8px] transition-colors ${tab === 'support' ? 'bg-white' : 'bg-transparent'}`}
            >
              <Typography variant="16/regular" className={tab === 'support' ? 'whitespace-nowrap text-neutral-700' : 'whitespace-nowrap text-neutral-600'}>
                تیکت‌های پشتیبانی
              </Typography>
            </button>
          </div>
          <button
            type="button"
            aria-label="فیلتر"
            className="flex h-[48px] w-[48px] items-center justify-center rounded-[12px] bg-white text-neutral-500"
          >
            <DashboardFilterIcon className="size-[26px]" />
          </button>
          <div className="relative w-[400px] max-w-full">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="درخواست خود را جست و جو کنید"
              aria-label="جستجو"
              className="h-[48px] rounded-[8px] border-neutral-100 pr-[12px] pl-[40px]"
            />
            <DashboardSearchIcon className="pointer-events-none absolute left-[12px] top-1/2 size-[24px] -translate-y-1/2 text-neutral-400" />
          </div>
        </div>
      </div>

      {actionNotice && (
        <Typography role="status" variant="14/regular" className="rounded-lg bg-neutral-100 p-3 text-neutral-600">
          {actionNotice}
        </Typography>
      )}

      {/* Card — Figma node 33:3926: white, grey-200 border, rounded-16, 16px padding, 848px tall */}
      <div className="relative min-h-[848px] w-full rounded-[16px] border border-neutral-200 bg-white p-[16px]">
        {state === 'loading' ? (
          <LettersSkeleton />
        ) : !showTable ? (
          state === 'empty' || initialLetters.length === 0 ? (
            <LettersEmptyState />
          ) : (
            <LettersEmptyState />
          )
        ) : (
          <div className="flex flex-row-reverse justify-end overflow-hidden">
            {/* عملیات — Figma node 33:3927 (52px, kebab dropdown) */}
            <div className="flex w-[52px] shrink-0 flex-col">
              <div className="h-[44px] border-b border-neutral-100" />
              {filteredLetters.map((item) => (
                <div key={item.id} className="flex h-[72px] items-center border-b border-neutral-100 p-[16px] group-hover:bg-neutral-50">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`عملیات نامه ${item.title}`}
                        className="flex size-[20px] items-center justify-center rounded text-neutral-400 hover:text-neutral-600"
                      >
                        <DashboardMoreIcon className="size-[20px]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[164px]">
                      {item.source === 'ticket' ? (
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/letters/${encodeURIComponent(item.id)}`}>
                            <DashboardMessageTextIcon className="size-[20px]" />
                            مشاهده و پاسخ
                          </Link>
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onSelect={() => setActionNotice('ثبت بازخورد به‌زودی')}>
                            <DashboardMessageTextIcon className="size-[20px]" />
                            ثبت بازخورد
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(item)}>
                            <DashboardTrashIcon className="size-[20px]" />
                            پاک کردن
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
            {/* تاریخ ارسال — 120px */}
            <div className="flex w-[120px] shrink-0 flex-col">
              <TableHeaderCell label="تاریخ ارسال" />
              {filteredLetters.map((item) => (
                <div key={item.id} className="flex h-[72px] items-center justify-end border-b border-neutral-100 p-[16px]">
                  <Typography variant="16/regular" className="whitespace-nowrap text-neutral-600">
                    {item.sentDate}
                  </Typography>
                </div>
              ))}
            </div>
            {/* فرستنده — 240px */}
            <div className="flex w-[240px] shrink-0 flex-col">
              <TableHeaderCell label={tab === 'received' ? 'فرستنده' : 'گیرنده'} />
              {filteredLetters.map((item) => (
                <div key={item.id} className="flex h-[72px] items-center justify-end border-b border-neutral-100 p-[16px]">
                  <SenderCell item={item} />
                </div>
              ))}
            </div>
            {/* عنوان — flex 494px */}
            <div className="flex min-w-0 flex-1 flex-col">
              <TableHeaderCell label="عنوان" />
              {filteredLetters.map((item) => (
                <div key={item.id} className="flex h-[72px] items-center justify-end border-b border-neutral-100 p-[16px]">
                  <Typography asChild variant="16/regular" className="block w-full truncate text-right text-neutral-600 hover:text-brand-600">
                    <Link href={`/dashboard/letters/${encodeURIComponent(item.id)}`}>{item.title}</Link>
                  </Typography>
                </div>
              ))}
            </div>
            {/* وضعیت — 200px, tag pills */}
            <div className="flex w-[200px] shrink-0 flex-col">
              <TableHeaderCell label="وضعیت" />
              {filteredLetters.map((item) => (
                <div key={item.id} className="flex h-[72px] items-center justify-end border-b border-neutral-100 p-[16px]">
                  <StatusTag type={item.type} label={item.typeLabel} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
