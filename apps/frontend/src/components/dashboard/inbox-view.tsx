'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

import {
  DashboardAddIcon,
  DashboardEyeIcon,
  DashboardMessageTextIcon,
  DashboardUserTagIcon,
  EmptyInboxIllustration,
  TrashIcon,
} from '@/components/icons'
import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import { RowActions } from '@/components/dashboard/list-row-actions'
import { ListRow, ListTableFrame, useRowLink } from '@/components/dashboard/list-table'
import { ListToolbar } from '@/components/dashboard/list-toolbar'
import { SearchField } from '@/components/dashboard/search-field'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import {
  deleteLetter,
  describeMutationFailure,
  setLetterRead,
  type InboxCounts,
  type InboxQuery,
  type LetterType,
} from '@/utilities/dashboard-api'
import { cn } from '@/utilities/ui'
import { toast } from 'sonner'

/** One inbox row, prepared on the server from a letter and the reader's side of it. */
export interface InboxRow {
  id: string
  title: string
  type: LetterType
  typeLabel: string
  /** The sender for a received letter, the recipient for a sent one. */
  counterpartName: string
  counterpartRole: string
  sentDate: string
  /** Only the recipient has a read state. */
  read?: boolean
  received: boolean
  /** A person wrote it, so the recipient can answer; system notices cannot be answered. */
  canReply: boolean
  /** The recipient's pending next step on the case, if any. */
  action: { label: string; href: string } | null
}

/** Extra destinations the filter menu offers, such as support tickets or oversight views. */
export interface InboxShortcut {
  label: string
  href: string
}

export interface InboxViewProps {
  rows: InboxRow[]
  query: InboxQuery
  counts: InboxCounts
  page: number
  totalPages: number
  /** Internal staff compose letters; companies write to support instead. */
  canCompose: boolean
  shortcuts?: InboxShortcut[]
}

// Tag tokens from Figma 30851:15835 (letter type) and 31650:41 (action needed).
const typeTagClasses: Record<LetterType, string> = {
  rejected: 'bg-error-50 text-error-600',
  approved: 'bg-success-50 text-success-500',
  needs_fix: 'bg-warning-50 text-warning-500',
  official: 'bg-brand-50 text-brand-600',
  notification: 'bg-neutral-100 text-neutral-600',
}

function Tag({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 items-center justify-center rounded-[40px] px-3 py-1', className)}>
      <Typography as="span" variant="14/regular" className="whitespace-nowrap text-inherit">
        {children}
      </Typography>
    </span>
  )
}

function RowTag({ row }: { row: InboxRow }) {
  if (row.action) return <Tag className="bg-warning-50 text-warning-500">نیازمند اقدام</Tag>
  return <Tag className={typeTagClasses[row.type] ?? typeTagClasses.notification}>{row.typeLabel}</Tag>
}

function Counterpart({ row }: { row: InboxRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image
        src="/figma/dashboard/inbox-sender-avatar.png"
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0 text-right">
        <Typography variant="16/regular" className="truncate text-neutral-600">
          {row.counterpartName}
        </Typography>
        <Typography variant="14/regular" className="truncate text-neutral-500">
          {row.counterpartRole}
        </Typography>
      </div>
    </div>
  )
}

const letterHref = (row: InboxRow) => `/dashboard/letters/${encodeURIComponent(row.id)}`

function RowTitle({ row }: { row: InboxRow }) {
  const unread = row.received && row.read === false
  return (
    <Link
      href={letterHref(row)}
      className="flex min-w-0 items-center gap-2 text-neutral-600 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      {unread && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand-500" />}
      <Typography as="span" variant={unread ? '16/semibold' : '16/regular'} className="truncate text-inherit">
        {row.title}
      </Typography>
      {unread && <span className="sr-only">(خوانده نشده)</span>}
    </Link>
  )
}

function RowMenu({
  row,
  onToggleRead,
  onHide,
}: {
  row: InboxRow
  onToggleRead: (row: InboxRow) => void
  onHide: (row: InboxRow) => void
}) {
  // Read state and hiding are the recipient's own mailbox actions.
  if (!row.received) return null
  // Figma 30865:18777: icon first, then the label, in reading order. The shared RowActions
  // shows a lone action directly; here a received letter always has at least two.
  return (
    <RowActions
      menuLabel={`منوی عملیات «${row.title}»`}
      actions={[
        ...(row.canReply
          ? [
              {
                id: 'reply',
                label: 'ثبت بازخورد',
                href: `/dashboard/letters/new?replyTo=${encodeURIComponent(row.id)}`,
                icon: <DashboardMessageTextIcon aria-hidden="true" className="size-5 shrink-0" />,
              },
            ]
          : []),
        {
          id: 'toggle-read',
          label: row.read ? 'علامت خوانده‌نشده' : 'علامت خوانده‌شده',
          icon: <DashboardEyeIcon aria-hidden="true" className="size-5 shrink-0" />,
          onSelect: () => onToggleRead(row),
        },
        {
          id: 'hide',
          label: 'پاک کردن',
          icon: <TrashIcon aria-hidden="true" className="size-5 shrink-0" />,
          onSelect: () => onHide(row),
        },
      ]}
    />
  )
}

function ActionLink({ row }: { row: InboxRow }) {
  if (!row.action) return null
  return (
    <Button asChild variant="text" size="32">
      <Link href={row.action.href}>
        <Typography as="span" variant="14/semibold" className="whitespace-nowrap text-inherit">
          {row.action.label}
        </Typography>
      </Link>
    </Button>
  )
}

/** The phone layout of a row; like the table row, a click anywhere on it opens the letter. */
function InboxCard({
  row,
  onToggleRead,
  onHide,
}: {
  row: InboxRow
  onToggleRead: (row: InboxRow) => void
  onHide: (row: InboxRow) => void
}) {
  const link = useRowLink(letterHref(row))
  return (
    <div
      className="cursor-pointer rounded-xl border border-neutral-100 p-4 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-500"
      {...link}
    >
      <div className="flex items-center justify-between gap-3">
        <RowTag row={row} />
        <RowMenu row={row} onToggleRead={onToggleRead} onHide={onHide} />
      </div>
      <div className="mt-3"><RowTitle row={row} /></div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
        <Counterpart row={row} />
        <Typography as="span" variant="14/regular" className="shrink-0 text-neutral-500">
          {row.sentDate}
        </Typography>
      </div>
      {row.action && (
        <div className="mt-3 flex justify-end"><ActionLink row={row} /></div>
      )}
    </div>
  )
}

// Figma 30851:15914 (loading)
function InboxSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری نامه‌ها" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((col) => (
        <div key={col} className="flex flex-col gap-4">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full rounded-lg bg-neutral-100" />
          ))}
        </div>
      ))}
    </div>
  )
}

// Figma 30851:15880 (empty)
function InboxEmpty({ filtered, sent }: { filtered: boolean; sent: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 py-20 text-center">
      <EmptyInboxIllustration className="size-20" />
      <Typography variant="14/semibold" className="mt-1 text-neutral-600">
        {filtered ? 'نامه‌ای با این جستجو یا فیلتر پیدا نشد' : sent ? 'نامه ارسالی ندارید' : 'صندوق نامه‌های شما خالیست'}
      </Typography>
      <Typography variant="12/regular" className="text-neutral-500">
        {filtered ? 'عبارت جستجو یا فیلتر را تغییر دهید' : sent ? 'هنوز نامه‌ای از کارتابل شما ارسال نشده است' : 'تا کنون نامه یا پیامی برای شما ارسال نشده است'}
      </Typography>
    </div>
  )
}

/** The new-letter page's support mode: the one place a company writes to support. */
const SUPPORT_LETTER_HREF = '/dashboard/letters/new?mode=support'

const STATUS_OPTIONS: Array<{ value: InboxQuery['status']; label: string }> = [
  { value: undefined, label: 'همه نامه‌ها' },
  { value: 'unread', label: 'خوانده‌نشده' },
  { value: 'action_required', label: 'نیازمند اقدام' },
]

export function InboxView({ rows: initialRows, query, counts, page, totalPages, canCompose, shortcuts = [] }: InboxViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState(initialRows)
  const [search, setSearch] = useState(query.q ?? '')

  // A new server render (another tab, page or filter) replaces the rows.
  const [shownRows, setShownRows] = useState(initialRows)
  if (shownRows !== initialRows) {
    setShownRows(initialRows)
    setRows(initialRows)
  }

  const navigate = (next: Partial<InboxQuery>) => {
    const merged: InboxQuery = { ...query, page: 1, ...next }
    const params = new URLSearchParams()
    if (merged.box !== 'received') params.set('box', merged.box)
    if (merged.q) params.set('q', merged.q)
    if (merged.status) params.set('status', merged.status)
    if (merged.page > 1) params.set('page', String(merged.page))
    const qs = params.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  const toggleRead = async (row: InboxRow) => {
    try {
      await setLetterRead(row.id, !row.read)
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, read: !row.read } : item)))
      startTransition(() => router.refresh())
    } catch (cause) {
      toast.error(describeMutationFailure(cause, 'تغییر وضعیت خواندن انجام نشد.'))
    }
  }

  const hide = async (row: InboxRow) => {
    try {
      await deleteLetter(row.id)
      setRows((current) => current.filter((item) => item.id !== row.id))
      toast.success(`نامه «${row.title}» از کارتابل حذف شد.`)
      startTransition(() => router.refresh())
    } catch (cause) {
      toast.error(describeMutationFailure(cause, 'حذف نامه انجام نشد.'))
    }
  }

  const filtered = Boolean(query.q || query.status)
  const counterpartHeader = query.box === 'sent' ? 'گیرنده' : 'فرستنده'

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col text-right" dir="rtl">

      {/* Toolbar, Figma 30852:17808: search, filter and the box tabs on the right, the compose action on the left. */}
      <ListToolbar
        search={
          <form
            role="search"
            className="w-full min-w-0 sm:w-auto"
            onSubmit={(event) => {
              event.preventDefault()
              navigate({ q: search.trim() || undefined })
            }}
          >
            <SearchField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="نامه خود را جست و جو کنید"
              aria-label="جستجوی نامه‌ها"
              maxLength={100}
            />
          </form>
        }
        filter={
          <>
            <ListFilterButton
              label="فیلتر نامه‌ها"
              links={shortcuts}
              groups={[
                {
                  key: 'status',
                  label: 'وضعیت',
                  value: query.status,
                  options: STATUS_OPTIONS.map((option) => ({
                    value: option.value ?? '',
                    label: option.label,
                    count:
                      option.value === 'action_required'
                        ? counts.actionRequired
                        : option.value === 'unread'
                          ? counts.unread
                          : undefined,
                  })),
                },
              ]}
              onChange={(_, value) => navigate({ status: (value as InboxQuery['status']) || undefined })}
            />
            {/* Received / sent, Figma 30865:18197 */}
            <div role="tablist" aria-label="صندوق نامه" className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-neutral-100 p-1.5">
              {(['received', 'sent'] as const).map((box) => (
                <Button
                  key={box}
                  type="button"
                  variant="segment"
                  size="36"
                  role="tab"
                  aria-selected={query.box === box}
                  onClick={() => navigate({ box, status: box === 'sent' ? undefined : query.status })}
                >
                  <Typography as="span" variant="16/regular" className="whitespace-nowrap text-inherit">
                    {box === 'received' ? 'نامه‌های دریافتی' : 'نامه‌های ارسالی'}
                  </Typography>
                  {box === 'received' && counts.unread > 0 && (
                    <span className="rounded-full bg-brand-500 px-1.5 text-white">
                      <Typography as="span" variant="12/regular" className="text-inherit">
                        {counts.unread.toLocaleString('fa-IR')}
                      </Typography>
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </>
        }
        actions={
          canCompose ? (
            <Button asChild size="48" className="shrink-0">
              <Link href="/dashboard/letters/new">
                <Typography as="span" variant="20/regular" className="text-inherit">
                  نامه جدید
                </Typography>
                <DashboardAddIcon className="size-[26px] shrink-0" />
              </Link>
            </Button>
          ) : (
            // Support opens the new-letter page in its support mode (design QA #280), not a modal.
            <Button asChild size="48" className="shrink-0">
              <Link href={SUPPORT_LETTER_HREF}>
                <Typography as="span" variant="20/regular" className="text-inherit">
                  پیام به پشتیبانی
                </Typography>
                <DashboardUserTagIcon className="size-[26px] shrink-0 stroke-white" />
              </Link>
            </Button>
          )
        }
      />

      {/* Table card, Figma 30852:17813: it fills the page height; a click on a row opens the letter. */}
      <ListTableFrame className="mt-4 p-4">
        {pending ? (
          <InboxSkeleton />
        ) : (
          <>
            <table className="hidden w-full table-fixed border-collapse text-right lg:table">
              <colgroup>
                <col className="w-[200px]" />
                <col />
                <col className="w-[240px]" />
                <col className="w-[120px]" />
                <col className="w-[148px]" />
              </colgroup>
              <thead className="sticky top-0 bg-background">
                <tr className="h-11 border-b border-neutral-100">
                  {['نوع نامه', 'عنوان', counterpartHeader, 'تاریخ ارسال'].map((label) => (
                    <th key={label} scope="col" className="px-4 py-3 font-normal">
                      <Typography as="span" variant="14/semibold" className="text-neutral-400">
                        {label}
                      </Typography>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">عملیات</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ListRow key={row.id} href={letterHref(row)}>
                    <td className="px-4"><RowTag row={row} /></td>
                    <td className="px-4"><RowTitle row={row} /></td>
                    <td className="px-4"><Counterpart row={row} /></td>
                    <td className="px-4">
                      <Typography as="span" variant="16/regular" className="whitespace-nowrap text-neutral-600">
                        {row.sentDate}
                      </Typography>
                    </td>
                    <td className="px-4">
                      <div className="flex items-center justify-end gap-1">
                        <ActionLink row={row} />
                        <RowMenu row={row} onToggleRead={toggleRead} onHide={hide} />
                      </div>
                    </td>
                  </ListRow>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <InboxEmpty filtered={filtered} sent={query.box === 'sent'} />}

            <ul className="space-y-3 lg:hidden">
              {rows.map((row) => (
                <li key={row.id}>
                  <InboxCard row={row} onToggleRead={toggleRead} onHide={hide} />
                </li>
              ))}
            </ul>
          </>
        )}
      </ListTableFrame>

      {totalPages > 1 && (
        <nav aria-label="صفحه‌بندی نامه‌ها" className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {page > 1 && (
            <Button type="button" size="40" variant="outline-gray" onClick={() => navigate({ page: page - 1 })}>
              <Typography as="span">صفحه قبل</Typography>
            </Button>
          )}
          <Typography variant="14/regular" className="text-neutral-600">
            صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
          </Typography>
          {page < totalPages && (
            <Button type="button" size="40" variant="outline-gray" onClick={() => navigate({ page: page + 1 })}>
              <Typography as="span">صفحه بعد</Typography>
            </Button>
          )}
        </nav>
      )}
    </div>
  )
}
