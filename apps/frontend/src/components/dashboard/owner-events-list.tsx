'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import { SearchField } from '@/components/dashboard/search-field'
import {
  DashboardAddIcon,
  DashboardEditIcon,
  DashboardEventsIcon,
  DashboardEyeIcon,
  DashboardMoreVerticalIcon,
  EmptyInboxIllustration,
} from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import { formatDate } from '@/utilities/dashboard-api'
import { cn } from '@/utilities/ui'
import { RequestError, adminRequest, loadPeople, type Person } from './owner-admin'
import type { OwnerExhibition } from './exhibition-admin/exhibition-form'
import { PUBLIC_STATUS_LABELS, type OwnerEvent, type PublicPage, type PublicStatus } from './owner-events-form'

type Kind = 'event' | 'exhibition'
type BadgeVariant = 'gray' | 'primary' | 'success' | 'warning' | 'error' | 'amber'

/** One row of the owner's single list; events and exhibitions keep their own data and tools. */
type Row = {
  key: string
  kind: Kind
  title: string
  location: string
  startDate: string
  endDate: string
  publicStatus: PublicStatus | null
  state: { label: string; variant: BadgeVariant }
  detail: string
  editHref: string
  editLabel: string
  tools?: { href: string; label: string }
}

const KIND_LABELS: Record<Kind, string> = { event: 'رویداد', exhibition: 'نمایشگاه' }

const SAVED_NOTICES: Record<string, string> = {
  'event-created': 'رویداد و صفحه عمومی آن ساخته شد.',
  'event-updated': 'تغییرات رویداد ذخیره شد.',
  'exhibition-created': 'نمایشگاه و صفحه عمومی آن ساخته شد.',
  'exhibition-updated': 'تغییرات نمایشگاه ذخیره شد.',
}

function registrationState(event: OwnerEvent, now: number): Row['state'] {
  // null: no public page; undefined: the CMS could not be read just now.
  if (event.public === null) return { label: 'بدون صفحه عمومی', variant: 'amber' }
  if (now >= Date.parse(event.registrationCloseAt)) return { label: 'ثبت‌نام بسته', variant: 'gray' }
  if (now < Date.parse(event.registrationOpenAt)) return { label: 'ثبت‌نام آغاز نشده', variant: 'warning' }
  return { label: 'ثبت‌نام باز', variant: 'success' }
}

function eventRows(events: OwnerEvent[], people: Person[], now: number): Row[] {
  const nameOf = (id: string) => people.find((person) => String(person.id) === id)?.name || 'نامشخص'
  return events.map((event) => ({
    key: `event-${event.id}`,
    kind: 'event',
    title: event.title,
    location: event.public?.location ?? '',
    startDate: event.public?.startDate ?? '',
    endDate: event.public?.endDate ?? '',
    publicStatus: event.public?.status ?? null,
    state: registrationState(event, now),
    detail: `سردبیر: ${nameOf(event.responsibleChiefId)}`,
    editHref: `/dashboard/events/${encodeURIComponent(event.id)}/edit`,
    editLabel: 'ویرایش',
    tools: { href: `/dashboard/events/${encodeURIComponent(event.id)}/subtopics`, label: 'دسته‌ها، زیرعنوان‌ها و RFP' },
  }))
}

/** Public events made in the CMS that no dashboard event owns yet (T60). */
function unlinkedRows(pages: PublicPage[]): Row[] {
  return pages.map((page) => ({
    key: `public-${page.id}`,
    kind: 'event',
    title: page.title,
    location: page.location,
    startDate: page.startDate,
    endDate: page.endDate,
    publicStatus: page.status,
    state: { label: 'بدون ثبت‌نام و مسئول', variant: 'amber' },
    detail: 'فقط صفحه عمومی دارد؛ شرکت‌ها هنوز نمی‌توانند درخواست ثبت کنند.',
    editHref: `/dashboard/events/new?type=event&publicEventId=${encodeURIComponent(page.id)}`,
    editLabel: 'تکمیل رویداد',
  }))
}

function exhibitionRows(exhibitions: OwnerExhibition[]): Row[] {
  return exhibitions.map((exhibition) => ({
    key: `exhibition-${exhibition.id}`,
    kind: 'exhibition',
    title: exhibition.title,
    location: exhibition.location,
    startDate: exhibition.startDate,
    endDate: exhibition.endDate,
    publicStatus: exhibition.status,
    state:
      exhibition.revision === 0
        ? { label: 'بدون تنظیمات غرفه', variant: 'amber' }
        : exhibition.boothCount === 0
          ? { label: 'بدون غرفه', variant: 'warning' }
          : { label: `${exhibition.boothCount.toLocaleString('fa-IR')} غرفه`, variant: 'primary' },
    detail: exhibition.companyBoothLimit
      ? `سقف هر شرکت: ${exhibition.companyBoothLimit.toLocaleString('fa-IR')} غرفه`
      : 'سقف غرفه هر شرکت ثبت نشده است',
    editHref: `/dashboard/exhibitions/${encodeURIComponent(exhibition.id)}/edit`,
    editLabel: 'ویرایش',
    tools: { href: `/dashboard/exhibitions/${encodeURIComponent(exhibition.id)}`, label: 'غرفه‌ها و کاتالوگ' },
  }))
}

const menuItemClass =
  'flex h-8 w-full cursor-pointer items-center justify-start gap-2 rounded-[10px] px-1.5 py-2 text-neutral-700 focus:bg-neutral-100 data-[highlighted]:bg-neutral-100'

/* Row actions — the management-list ⋮ menu (Figma 30535:17410). */
function RowActions({ row }: { row: Row }) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="text-gray" size="icon-32" aria-label={`عملیات ${row.title}`}>
          <DashboardMoreVerticalIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="flex w-[220px] min-w-[220px] flex-col gap-1 rounded-xl border-0 bg-background p-1 shadow-[0px_2px_4px_rgba(21,21,21,0.1)] ring-0"
      >
        <DropdownMenuItem asChild className={menuItemClass}>
          <Link href={row.editHref}>
            <DashboardEditIcon className="size-5 text-neutral-700" />
            <Typography as="span" variant="14/regular" className="text-inherit">
              {row.editLabel}
            </Typography>
          </Link>
        </DropdownMenuItem>
        {row.tools && (
          <DropdownMenuItem asChild className={menuItemClass}>
            <Link href={row.tools.href}>
              <DashboardEyeIcon className="size-5 text-neutral-700" />
              <Typography as="span" variant="14/regular" className="text-inherit">
                {row.tools.label}
              </Typography>
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HeaderCell({ label, className }: { label?: string; className?: string }) {
  return (
    <th className={cn('h-11 border-b border-neutral-100 px-4 py-3 text-right', className)}>
      {label ? (
        <Typography as="span" variant="14/semibold" color="neutral-400" className="whitespace-nowrap">
          {label}
        </Typography>
      ) : (
        <span className="sr-only">عملیات</span>
      )}
    </th>
  )
}

/* Loading — the management-list skeleton (Figma 30535:17019): 4 columns × 5 bars. */
function ListSkeleton() {
  return (
    <div role="status" aria-label="در حال دریافت رویدادها و نمایشگاه‌ها" className="flex w-full gap-4">
      {[0, 1, 2, 3].map((column) => (
        <div key={column} className="flex min-w-0 flex-1 flex-col gap-4">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full rounded-lg bg-neutral-100 motion-reduce:animate-none" />
          ))}
        </div>
      ))}
    </div>
  )
}

/* Empty — the management-list empty state (Figma 30535:17021). */
function EmptyState({ noMatch, onCreate }: { noMatch: boolean; onCreate: () => void }) {
  return (
    <div className="flex w-[265px] max-w-full flex-col items-center gap-2 text-center">
      <div className="flex flex-col items-center gap-1">
        <EmptyInboxIllustration className="size-20" aria-hidden="true" />
        <Typography variant="14/semibold" color="neutral-600">
          {noMatch ? 'موردی با این مشخصات پیدا نشد' : 'رویداد یا نمایشگاهی در این صفحه موجود نیست'}
        </Typography>
        <Typography variant="12/regular" color="neutral-500">
          {noMatch ? 'عبارت جستجو یا فیلتر نوع را تغییر دهید' : 'اولین رویداد یا نمایشگاه را بسازید'}
        </Typography>
      </div>
      {!noMatch && (
        <Button variant="text" size="40" onClick={onCreate}>
          <Typography as="span" variant="16/semibold" className="text-inherit">
            رویداد یا نمایشگاه جدید
          </Typography>
          <DashboardAddIcon className="size-6" />
        </Button>
      )}
    </div>
  )
}

/* Create — the add-new type dialog (Figma 31099:17605): pick the kind, then the full form. */
function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [kind, setKind] = useState<Kind>('event')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ساخت رویداد یا نمایشگاه</DialogTitle>
          <DialogDescription>
            هر دو با صفحه عمومی‌شان ساخته می‌شوند. رویداد ثبت‌نام و مسئول دارد؛ نمایشگاه غرفه و سقف غرفه هر شرکت.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={kind}
          onValueChange={(value) => setKind(value as Kind)}
          aria-label="نوع"
          className="flex flex-col gap-3"
        >
          {(['event', 'exhibition'] as const).map((value) => (
            <label
              key={value}
              htmlFor={`create-${value}`}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 p-3 has-[[data-state=checked]]:border-brand-500 has-[[data-state=checked]]:bg-brand-50"
            >
              <RadioGroupItem id={`create-${value}`} value={value} />
              <Typography as="span" variant="16/regular" color="neutral-700">
                {KIND_LABELS[value]}
              </Typography>
            </label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button size="40" className="flex-1" onClick={() => router.push(`/dashboard/events/new?type=${kind}`)}>
            ادامه
          </Button>
          <Button size="40" variant="outline-gray" className="flex-1" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * FE40: the System Owner's one list for events and exhibitions. Each row opens
 * its own tools; the data and rules of the two stay separate.
 */
export function OwnerEventsList() {
  const searchParams = useSearchParams()
  const initialType = searchParams?.get('type')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind | 'all'>(initialType === 'event' || initialType === 'exhibition' ? initialType : 'all')
  const [creating, setCreating] = useState(false)
  const [pagesUnavailable, setPagesUnavailable] = useState(false)
  const savedNotice = SAVED_NOTICES[searchParams?.get('saved') ?? '']
  useEffect(() => {
    if (savedNotice) toast.success(savedNotice)
  }, [savedNotice])

  useEffect(() => {
    let current = true
    Promise.all([
      adminRequest('/api/dashboard/admin/events'),
      adminRequest('/api/dashboard/admin/exhibitions'),
      loadPeople(),
    ])
      .then(([events, exhibitions, people]) => {
        if (!Array.isArray(events.items) || !Array.isArray(exhibitions.items)) throw new Error('invalid_list')
        const now = Date.now()
        const all = [
          ...eventRows(events.items, people, now),
          ...unlinkedRows(events.unlinkedPublicEvents ?? []),
          ...exhibitionRows(exhibitions.items),
        ].sort((left, right) => (right.startDate || '').localeCompare(left.startDate || ''))
        if (current) {
          setRows(all)
          setPagesUnavailable(events.publicPagesUnavailable === true)
        }
      })
      .catch((cause) => {
        if (current) setError(cause)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [attempt])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fa')
    return rows.filter(
      (row) =>
        (kind === 'all' || row.kind === kind) &&
        (!needle || `${row.title} ${row.location}`.toLocaleLowerCase('fa').includes(needle)),
    )
  }, [rows, query, kind])
  const count = (value: Kind) => rows.filter((row) => row.kind === value).length

  return (
    <main dir="rtl" className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10">
      <Typography as="h1" variant="24/bold" color="neutral-700" className="pe-12 lg:pe-0">
        رویدادها و نمایشگاه‌ها
      </Typography>

      {pagesUnavailable && (
        <Typography role="status" variant="14/regular" color="neutral-700" className="rounded-xl bg-warning-50 p-3">
          صفحه‌های عمومی رویدادها اکنون در دسترس نیست؛ تاریخ و محل برگزاری رویدادها پس از تلاش دوباره نمایش داده می‌شود.
        </Typography>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <SearchField
              aria-label="جستجوی رویداد یا نمایشگاه"
              placeholder="رویداد یا نمایشگاه را جست و جو کنید"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="sm:w-[400px]"
            />
            <ListFilterButton
              label="فیلتر نوع"
              groups={[
                {
                  key: 'type',
                  label: 'نوع',
                  value: kind === 'all' ? undefined : kind,
                  options: [
                    { value: '', label: 'همه', count: rows.length },
                    { value: 'event', label: 'رویدادها', count: count('event') },
                    { value: 'exhibition', label: 'نمایشگاه‌ها', count: count('exhibition') },
                  ],
                },
              ]}
              onChange={(_, value) => {
                const next = (value as Kind | undefined) ?? 'all'
                setKind(next)
                const params = new URLSearchParams(window.location.search)
                params.delete('saved')
                if (next === 'all') params.delete('type')
                else params.set('type', next)
                const search = params.toString()
                window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
              }}
            />
          </div>
          <Button size="48" onClick={() => setCreating(true)}>
            <Typography as="span" variant="20/regular" className="text-inherit">
              رویداد یا نمایشگاه جدید
            </Typography>
            <DashboardAddIcon className="size-[26px]" />
          </Button>
        </div>

        <div className="relative flex min-h-[420px] flex-1 flex-col rounded-2xl border border-neutral-200 bg-background p-4">
          {loading ? (
            <ListSkeleton />
          ) : error !== null ? (
            <div className="flex flex-1 items-center justify-center">
              <RequestError
                error={error}
                returnTo="/dashboard/events"
                retry={() => {
                  setLoading(true)
                  setError(null)
                  setAttempt((value) => value + 1)
                }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState noMatch={rows.length > 0} onCreate={() => setCreating(true)} />
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <table className="w-full min-w-[1040px] border-collapse text-right">
                <thead className="sticky top-0 z-10 bg-background">
                  <tr>
                    <HeaderCell label="عنوان" />
                    <HeaderCell label="نوع" className="w-[120px]" />
                    <HeaderCell label="تاریخ برگزاری" className="w-[210px]" />
                    <HeaderCell label="وضعیت" className="w-[190px]" />
                    <HeaderCell label="در سایت" className="w-[140px]" />
                    <HeaderCell className="w-[52px]" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.key}
                      className="h-[72px] border-b border-neutral-100 transition-colors hover:bg-neutral-100 has-[[data-state=open]]:bg-neutral-100"
                    >
                      {/* max-w-0: the title takes the width left over and truncates, so the table fits its card. */}
                      <td className="max-w-0 px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                            <DashboardEventsIcon className="size-5" />
                          </span>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <Link href={row.editHref} title={row.title} className="min-w-0 truncate rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500">
                              <Typography as="span" variant="16/regular" color="neutral-600">
                                {row.title}
                              </Typography>
                            </Link>
                            <Typography as="span" variant="12/regular" color="neutral-500" className="truncate">
                              {[row.location, row.detail].filter(Boolean).join(' · ')}
                            </Typography>
                          </div>
                        </div>
                      </td>
                      <td className="px-4">
                        <Badge variant="primary" size="md">
                          <Typography as="span" variant="14/regular" className="text-inherit">
                            {KIND_LABELS[row.kind]}
                          </Typography>
                        </Badge>
                      </td>
                      <td className="px-4">
                        <Typography as="span" variant="14/regular" color={row.startDate ? 'neutral-600' : 'neutral-400'} className="whitespace-nowrap">
                          {row.startDate ? `${formatDate(row.startDate)} تا ${formatDate(row.endDate)}` : '—'}
                        </Typography>
                      </td>
                      <td className="px-4">
                        <Badge variant={row.state.variant} size="md" className="whitespace-nowrap">
                          <Typography as="span" variant="14/regular" className="text-inherit">
                            {row.state.label}
                          </Typography>
                        </Badge>
                      </td>
                      <td className="px-4">
                        <Typography as="span" variant="14/regular" color={row.publicStatus ? 'neutral-600' : 'neutral-400'}>
                          {row.publicStatus ? PUBLIC_STATUS_LABELS[row.publicStatus] : '—'}
                        </Typography>
                      </td>
                      <td className="px-2.5">
                        <RowActions row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </div>
      </div>
      <CreateDialog open={creating} onOpenChange={setCreating} />
    </main>
  )
}
