'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import { RowActions } from '@/components/dashboard/list-row-actions'
import { ListRow, ListTableFrame, useRowLink } from '@/components/dashboard/list-table'
import { ListToolbar } from '@/components/dashboard/list-toolbar'
import { SearchField } from '@/components/dashboard/search-field'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import { getLoginUrl } from '@/utilities/auth-return-url'
import { formatDate } from '@/utilities/dashboard-api'
import {
  ownEvaluationLabel,
  REVIEW_QUEUE_VIEWS,
  REVIEW_WORK_STATE_LABELS,
  reviewerRoleLabel,
  reviewQueueHref,
  reviewWorkState,
  type ReviewQueueDto,
  type ReviewQueueItemDto,
  type ReviewQueueView,
  type ReviewWorkState,
} from '@/utilities/reviewer-case'

import { useRevalidateOnFocus } from './use-revalidate'

export type ReviewerQueueState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ReviewQueueDto }
  | { kind: 'expired' }
  | { kind: 'denied' }
  | { kind: 'error' }

const PAGE_SIZE = 25

const WORK_STATE_STYLE: Record<ReviewWorkState, { color: 'brand-600' | 'secondary' | 'neutral-600'; bg: string }> = {
  open: { color: 'brand-600', bg: 'bg-brand-50' },
  superseded: { color: 'secondary', bg: 'bg-warning-50' },
  closed: { color: 'neutral-600', bg: 'bg-neutral-100' },
}

export interface ReviewerQueueProps {
  view: ReviewQueueView
  page: number
}

/**
 * The reviewer's or employer's own queue. Rows come only from `GET /review/queue`,
 * which reads the caller's active assignments on the server; the browser adds no
 * scope of its own. A refresh on focus drops a case whose assignment ended while
 * the page was open, and a 401/403 clears the list instead of keeping it on screen.
 * Callers key it by view and page so each list starts from its loading state.
 *
 * The toolbar is the shared one (design QA #276): search and the filter template on
 * the right. The queue API has no text search, so the search narrows only the rows
 * of the page on screen.
 */
export function ReviewerQueue({ view, page }: ReviewerQueueProps) {
  const [state, setState] = useState<ReviewerQueueState>({ kind: 'loading' })
  const [search, setSearch] = useState('')
  const latest = useRef(0)

  // `initial` starts from the loading state the component mounts with; a retry shows it again.
  const load = useCallback(
    async (mode: 'initial' | 'retry' | 'silent') => {
      const silent = mode === 'silent'
      const request = ++latest.current
      if (mode === 'retry') setState({ kind: 'loading' })
      let next: ReviewerQueueState
      try {
        const response = await fetch(`/api/dashboard/review/queue?view=${view}&page=${page}&limit=${PAGE_SIZE}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (response.status === 401) next = { kind: 'expired' }
        else if (response.status === 403) next = { kind: 'denied' }
        else if (!response.ok) next = { kind: 'error' }
        else next = { kind: 'ready', data: (await response.json()) as ReviewQueueDto }
      } catch {
        next = { kind: 'error' }
      }
      // A slower answer to an earlier tab must not replace the current one.
      if (request !== latest.current) return
      setState((current) =>
        // A failed background refresh keeps the rows the server last authorized;
        // a lost session or role always clears them.
        silent && next.kind === 'error' && current.kind === 'ready' ? current : next,
      )
    },
    [view, page],
  )

  useEffect(() => {
    // The first read only sets state after the response arrives (the mount state is `loading`).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load('initial')
  }, [load])
  useRevalidateOnFocus(() => void load('silent'))

  const counts = state.kind === 'ready' ? state.data.counts : undefined

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 px-4 pt-6 pb-6 lg:pt-10" dir="rtl">
      <div className="flex flex-col gap-1">
        <Typography as="h1" variant="h3" color="neutral-900">
          پرونده‌های ارجاع‌شده به شما
        </Typography>
        <Typography variant="14/regular" color="neutral-500">
          فقط پرونده‌هایی که به شما ارجاع شده‌اند نمایش داده می‌شوند.
        </Typography>
      </div>

      <ListToolbar
        search={
          <form role="search" className="min-w-0 flex-1 sm:flex-none" onSubmit={(event) => event.preventDefault()}>
            <SearchField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجو در پرونده‌های این صفحه"
              aria-label="جستجو در پرونده‌های این صفحه"
              maxLength={100}
            />
          </form>
        }
        filter={
          /* The default view (awaiting evaluation) is the unfiltered state of the shared filter (FE35). */
          <ListFilterButton
            label="فیلتر پرونده‌های داوری"
            groups={[
              {
                key: 'view',
                label: 'نمای صف',
                value: view === 'open' ? undefined : view,
                options: REVIEW_QUEUE_VIEWS.map((option) => ({
                  value: option.value === 'open' ? '' : option.value,
                  label: option.label,
                  count: counts?.[option.value],
                })),
              },
            ]}
          />
        }
      />

      <QueueBody state={state} view={view} page={page} search={search} onRetry={() => void load('retry')} />
    </main>
  )
}

const searchText = (item: ReviewQueueItemDto) =>
  [item.companyName, item.title, item.trackingCode, item.event?.title, item.subtopic?.title].filter(Boolean).join(' ')

function QueueBody({
  state,
  view,
  page,
  search,
  onRetry,
}: {
  state: ReviewerQueueState
  view: ReviewQueueView
  page: number
  search: string
  onRetry: () => void
}) {
  if (state.kind === 'loading') {
    return (
      <ListTableFrame className="p-4">
        <div className="flex flex-col gap-3">
          <Typography as="span" role="status" aria-live="polite" variant="14/regular" className="sr-only">
            در حال دریافت پرونده‌ها
          </Typography>
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} aria-hidden="true" className="h-10 w-full rounded-lg bg-neutral-100 motion-reduce:animate-none" />
          ))}
        </div>
      </ListTableFrame>
    )
  }
  if (state.kind === 'expired') {
    return (
      <Notice title="نشست شما پایان یافته است" body="برای دیدن پرونده‌های خود دوباره وارد شوید.">
        <Button asChild size="36">
          <Link href={getLoginUrl(reviewQueueHref(view, page), { expired: true })}>
            <Typography as="span" variant="14/regular" className="text-inherit">ورود دوباره</Typography>
          </Link>
        </Button>
      </Notice>
    )
  }
  if (state.kind === 'denied') {
    return (
      <Notice
        title="دسترسی به صف داوری مجاز نیست"
        body="این صف فقط برای داوران و کارفرمایان منتسب است. اگر نقش شما تغییر کرده، دوباره وارد شوید."
      >
        <Button asChild size="36" variant="outline-gray">
          <Link href="/dashboard">
            <Typography as="span" variant="14/regular" className="text-inherit">بازگشت به پیشخوان</Typography>
          </Link>
        </Button>
      </Notice>
    )
  }
  if (state.kind === 'error') {
    return (
      <Notice title="دریافت پرونده‌ها انجام نشد" body="ارتباط با سرویس برقرار نشد. دوباره تلاش کنید.">
        <Button size="36" variant="outline-gray" onClick={onRetry}>
          <Typography as="span" variant="14/regular" className="text-inherit">تلاش دوباره</Typography>
        </Button>
      </Notice>
    )
  }

  const { items: allItems, totalPages } = state.data
  const needle = search.trim()
  const items = needle ? allItems.filter((item) => searchText(item).includes(needle)) : allItems
  if (!items.length) {
    return (
      <ListTableFrame>
        <div className="flex min-h-60 flex-col items-center justify-center gap-2 p-6 text-center">
          <Typography variant="16/regular" color="neutral-700">
            {needle
              ? 'پرونده‌ای با این جستجو در این صفحه پیدا نشد.'
              : view === 'open'
                ? 'پرونده‌ای در انتظار ارزیابی شما نیست.'
                : 'پرونده‌ای در این بخش وجود ندارد.'}
          </Typography>
          <Typography variant="14/regular" color="neutral-500">
            {needle ? 'عبارت جستجو را تغییر دهید.' : 'پرونده‌ها پس از ارجاع توسط سردبیر اینجا نمایش داده می‌شوند.'}
          </Typography>
        </div>
      </ListTableFrame>
    )
  }

  return (
    <>
      {/* Phone: one card per case. */}
      <ScrollArea className="min-h-0 flex-1 md:hidden">
        <ul className="flex flex-col gap-3" aria-label="پرونده‌ها">
          {items.map((item) => (
            <li key={item.requestId}>
              <QueueCard item={item} />
            </li>
          ))}
        </ul>
      </ScrollArea>
      {/* Tablet and up: the Figma table, filling the height the page leaves. */}
      <ListTableFrame className="hidden md:flex">
        <table className="w-full min-w-[900px] table-fixed border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="h-11 border-b border-neutral-200">
              {['نام شرکت', 'عنوان درخواست', 'رویداد', 'وضعیت', 'ارزیابی شما', 'تاریخ ارجاع'].map((header) => (
                <th key={header} scope="col" className="px-4 text-right">
                  <Typography variant="14/semibold" color="secondary">{header}</Typography>
                </th>
              ))}
              <th scope="col" className="w-32 px-4">
                <span className="sr-only">عملیات</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ListRow key={item.requestId} href={caseHref(item)}>
                <td className="px-4">
                  <Link href={caseHref(item)} className="block truncate hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
                    <Typography as="span" variant="14/regular" color="neutral-800">{item.companyName ?? '—'}</Typography>
                  </Link>
                </td>
                <td className="px-4">
                  <Typography variant="14/regular" color="secondary" className="truncate">{item.title}</Typography>
                  <Typography variant="12/regular" color="neutral-400" className="font-mono">{item.trackingCode}</Typography>
                </td>
                <td className="px-4">
                  <Typography variant="14/regular" color="secondary" className="truncate">{eventText(item)}</Typography>
                </td>
                <td className="px-4"><WorkStateBadge item={item} /></td>
                <td className="px-4">
                  <Typography variant="14/regular" color="secondary">{ownEvaluationLabel(item.evaluation)}</Typography>
                </td>
                <td className="px-4">
                  <Typography variant="14/regular" color="secondary">{formatDate(item.assignment.assignedAt)}</Typography>
                </td>
                <td className="px-4 text-end">
                  <RowActions actions={[{ id: 'open', label: caseActionLabel(item), href: caseHref(item) }]} />
                </td>
              </ListRow>
            ))}
          </tbody>
        </table>
      </ListTableFrame>
      {totalPages > 1 ? (
        <nav aria-label="صفحه‌بندی" className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Button asChild size="36" variant="outline-gray">
              <Link href={reviewQueueHref(view, page - 1)}>
                <Typography as="span" variant="14/regular" className="text-inherit">صفحه قبل</Typography>
              </Link>
            </Button>
          ) : null}
          <Typography variant="14/regular" color="neutral-600">
            صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
          </Typography>
          {page < totalPages ? (
            <Button asChild size="36" variant="outline-gray">
              <Link href={reviewQueueHref(view, page + 1)}>
                <Typography as="span" variant="14/regular" className="text-inherit">صفحه بعد</Typography>
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </>
  )
}

const caseHref = (item: ReviewQueueItemDto) => `/dashboard/requests/${encodeURIComponent(item.requestId)}`

/** What the single row action says: evaluate, continue a draft, or just view a finished one (Figma 31650:23). */
function caseActionLabel(item: ReviewQueueItemDto): string {
  if (reviewWorkState(item) !== 'open') return 'مشاهده'
  return item.evaluation ? (item.evaluation.state === 'final' ? 'مشاهده' : 'ادامه') : 'ارزیابی'
}

function QueueCard({ item }: { item: ReviewQueueItemDto }) {
  const link = useRowLink(caseHref(item))
  return (
    <div
      className="flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border border-neutral-200 bg-background p-4 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-500"
      {...link}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <Link href={caseHref(item)} className="min-w-0 focus-visible:outline-2 focus-visible:outline-brand-500">
          <Typography variant="14/semibold" color="neutral-900" className="break-words">{item.title}</Typography>
        </Link>
        <WorkStateBadge item={item} />
      </div>
      <Typography variant="12/regular" color="neutral-500" className="break-words">
        {item.companyName ?? '—'} · {eventText(item)}
      </Typography>
      <Typography variant="12/regular" color="neutral-500">
        {reviewerRoleLabel(item)} · {ownEvaluationLabel(item.evaluation)} · {formatDate(item.assignment.assignedAt)}
      </Typography>
    </div>
  )
}

function WorkStateBadge({ item }: { item: ReviewQueueItemDto }) {
  const work = reviewWorkState(item)
  const style = WORK_STATE_STYLE[work]
  return (
    <Typography
      as="span"
      variant="12/regular"
      color={style.color}
      data-state={work}
      className={`inline-block shrink-0 rounded-lg px-2 py-1 ${style.bg}`}
    >
      {work === 'open' ? 'در انتظار ارزیابی' : work === 'superseded' ? 'نسخه جدیدتر' : 'بسته‌شده'}
      <span className="sr-only"> — {REVIEW_WORK_STATE_LABELS[work]}</span>
    </Typography>
  )
}

function eventText(item: ReviewQueueItemDto): string {
  if (!item.event) return '—'
  return item.subtopic ? `${item.event.title} · ${item.subtopic.title}` : item.event.title
}

function Notice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <section role="alert" className="flex flex-col items-start gap-2 rounded-xl border border-warning-500 bg-warning-50 p-4">
      <Typography as="h2" variant="14/semibold" color="neutral-700">{title}</Typography>
      <Typography variant="12/regular" color="neutral-600">{body}</Typography>
      {children}
    </section>
  )
}
