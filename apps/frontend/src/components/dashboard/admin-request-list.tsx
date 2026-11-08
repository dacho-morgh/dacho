'use client'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AdminListView,
  AdminRowActions,
  type AdminColumn,
  type AdminListLoadState,
} from '@/components/dashboard/admin-list-view'
import {
  adminRequestsQuery,
  toAdminRequestsPage,
  type AdminRequestRow,
  type AdminRequestsApiResponse,
  type AdminRequestsPage,
  type InitialAdminRequests,
} from '@/components/dashboard/admin-request-list-data'
import { CompanyAvatar } from '@/components/dashboard/company-avatar'
import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import {
  REQUEST_STATUS_FILTER_OPTIONS,
  REVIEW_STAGE_OPTIONS,
  type RequestQueueFilters,
  type RequestStatus,
} from '@/components/dashboard/requests/types'
import { workQueueLabel } from '@/components/dashboard/work-queue-overview'
import { CompanyBuildingIcon, DashboardEditIcon } from '@/components/icons'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Typography } from '@/components/ui/typography'
import { formatDate } from '@/utilities/dashboard-api'

const SEARCH_DEBOUNCE_MS = 300

const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'پیش‌نویس',
  in_review: 'درحال بررسی',
  action_needed: 'نیازمند اصلاح',
  approved: 'تایید شده',
  rejected: 'رد شده',
}

const STATUS_VARIANT: Record<RequestStatus, BadgeProps['variant']> = {
  draft: 'gray',
  in_review: 'primary',
  action_needed: 'yellow',
  approved: 'green',
  rejected: 'red',
}

/** The tag of a case the Secretariat follows up (its investment memo was sent). */
const FOLLOW_UP_LABEL = 'پیگیری سرمایه‌گذاری'

/** A follow-up case waits on the Secretariat's result until it is published. */
const pendingOf = (item: AdminRequestRow) =>
  item.pending ?? (item.followUp && !item.followUp.published ? 'منتظر انتشار نتیجه' : null)

const text = (value: string) => (
  <Typography variant="14/regular" color="secondary" className="max-sm:text-[13px]">
    {value}
  </Typography>
)

const companyHref = (companyId: string) => `/dashboard/companies/${encodeURIComponent(companyId)}`

/**
 * `canViewCompany`: the company's name and the company actions lead to its dossier, which only the
 * owner and Secretariat may read; every other role sees the name as text.
 */
function buildColumns(canViewCompany: boolean): AdminColumn<AdminRequestRow>[] {
  return [
    {
      id: 'company',
      header: 'نام شرکت',
      render: (item) => (
        <div className="flex items-center gap-3">
          <CompanyAvatar logoUrl={item.logoUrl} />
          {canViewCompany && item.companyId ? (
            <Link
              href={companyHref(item.companyId)}
              className="min-w-0 truncate rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {text(item.company)}
            </Link>
          ) : (
            text(item.company)
          )}
        </div>
      ),
    },
    {
      id: 'request',
      header: 'درخواست',
      render: (item) => (
        <Link
          href={`/dashboard/requests/${encodeURIComponent(item.id)}`}
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {text(item.title)}
        </Link>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت',
      render: (item) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge variant={STATUS_VARIANT[item.status] ?? 'gray'} size="sm">
            {STATUS_LABELS[item.status] ?? item.status}
          </Badge>
          {item.followUp ? (
            <Badge variant="brand-solid" size="sm">
              {FOLLOW_UP_LABEL}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'stage',
      header: 'مرحله',
      render: (item) => (
        <span className="flex flex-col gap-1">
          {text(item.stage)}
          {pendingOf(item) ? (
            <Typography variant="12/regular" color="brand-600">
              {pendingOf(item)}
            </Typography>
          ) : null}
        </span>
      ),
    },
    { id: 'date', header: 'تاریخ ثبت', render: (item) => text(formatDate(item.createdAt) || '—') },
    {
      id: 'actions',
      header: 'عملیات',
      render: (item) => (
        <AdminRowActions
          viewHref={`/dashboard/requests/${encodeURIComponent(item.id)}`}
          viewLabel="مشاهده درخواست"
          actions={
            canViewCompany && item.companyId
              ? [
                  {
                    id: 'company',
                    label: 'مشاهده شرکت',
                    icon: <CompanyBuildingIcon aria-hidden="true" className="size-5" />,
                    href: companyHref(item.companyId),
                  },
                  ...(item.canEvaluate
                    ? [
                        {
                          id: 'evaluate',
                          label: 'ارزیابی درخواست',
                          icon: <DashboardEditIcon aria-hidden="true" className="size-5" />,
                          href: `${companyHref(item.companyId)}/requests/${encodeURIComponent(item.id)}/evaluation`,
                        },
                      ]
                    : []),
                ]
              : []
          }
        />
      ),
    },
  ]
}

/**
 * The page, status, filters and search live in the URL, so back, refresh and sharing reopen the
 * same view. The server page reads the rows for that URL (`initial`) and the table shows them at
 * once; the table fetches only when the server did not (or its read failed). While the next
 * page is on its way the rows stay on screen, dimmed.
 */
export function AdminRequestList({
  status,
  page = 1,
  filters = {},
  counts,
  events = [],
  canViewCompany = false,
  canFollowUp = false,
  initial,
}: {
  status?: RequestStatus
  page?: number
  filters?: RequestQueueFilters
  /** From `GET /stats` with the same filters, so each number is the size of the list it opens. */
  counts?: Partial<Record<RequestStatus | 'all', number>>
  events?: { id: string; title: string }[]
  canViewCompany?: boolean
  /** The Secretariat and the owner may narrow the list to the follow-up cases. */
  canFollowUp?: boolean
  /** The rows the server read for the query on screen, so the table opens with them. */
  initial?: InitialAdminRequests
} = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isNavigating, startNavigation] = useTransition()
  const query = adminRequestsQuery(status, page, filters)
  const urlSearch = filters.search ?? ''

  // The API answer to a query the server did not read for us.
  const [fetched, setFetched] = useState<{ key: string; page: AdminRequestsPage } | null>(null)
  const [failure, setFailure] = useState<{ key: string; state: AdminListLoadState } | null>(null)
  const [retries, setRetries] = useState(0)
  const [searchText, setSearchText] = useState(urlSearch)
  const lastWrittenSearch = useRef(urlSearch)

  const answer = initial?.key === query ? initial : fetched?.key === query ? fetched.page : undefined
  // The rows of the last answer stay while the next one loads.
  const shown = answer ?? fetched?.page ?? initial
  const failed = failure?.key === query ? failure.state : undefined
  const loadState: AdminListLoadState = failed ?? (shown ? 'ready' : 'loading')
  const refreshing = !failed && (isNavigating || (!answer && Boolean(shown)))
  const needsFetch = !answer

  useEffect(() => {
    if (!needsFetch) return
    let current = true
    const fail = (state: AdminListLoadState) => current && setFailure({ key: query, state })
    ;(async () => {
      try {
        const response = await fetch(`/api/dashboard/admin/requests?${query}`, { cache: 'no-store' })
        if (response.status === 401) return fail('unauthenticated')
        if (response.status === 403) return fail('denied')
        if (!response.ok) return fail('error')
        const next = toAdminRequestsPage((await response.json()) as AdminRequestsApiResponse, page)
        if (!next) return fail('error')
        if (!current) return
        setFailure(null)
        setFetched({ key: query, page: next })
      } catch {
        fail('error')
      }
    })()
    return () => {
      current = false
    }
    // A retry asks again for the same query.
  }, [needsFetch, query, page, retries])

  const writeUrl = useCallback(
    (changes: Record<string, string | undefined>, mode: 'push' | 'replace' = 'push') => {
      const next = new URLSearchParams(searchParams?.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      const nextQuery = next.toString()
      startNavigation(() => router[mode](nextQuery ? `${pathname}?${nextQuery}` : pathname))
    },
    [pathname, router, searchParams],
  )

  // Typing waits for a pause before it reaches the URL (and so the server), and starts again from page 1.
  useEffect(() => {
    if (searchText.trim() === urlSearch.trim()) return
    const timer = setTimeout(() => {
      lastWrittenSearch.current = searchText
      writeUrl({ search: searchText.trim() || undefined, page: undefined }, 'replace')
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchText, urlSearch, writeUrl])

  // Back and forward change the URL without typing: show the search it holds.
  useEffect(() => {
    if (urlSearch !== lastWrittenSearch.current) {
      lastWrittenSearch.current = urlSearch
      setSearchText(urlSearch)
    }
  }, [urlSearch])

  const columns = useMemo(() => buildColumns(canViewCompany), [canViewCompany])
  const queueLabel = filters.queue ? workQueueLabel(filters.queue) : undefined

  return (
    <AdminListView
      title="درخواست ها"
      notice={
        queueLabel || filters.followUp ? (
          <Typography variant="14/regular" color="secondary">
            {queueLabel ? `صف: ${queueLabel}` : `${FOLLOW_UP_LABEL}: پرونده‌هایی که یادداشت سرمایه‌گذاری آن‌ها به دبیرخانه رسیده است`}
          </Typography>
        ) : undefined
      }
      searchPlaceholder="جستجوی عنوان یا کد پیگیری"
      items={shown?.requests ?? []}
      getSearchText={() => ''}
      query={searchText}
      onQueryChange={setSearchText}
      pagination={{
        page: shown?.page ?? page,
        totalPages: shown?.totalPages ?? 1,
        onPageChange: (next) => writeUrl({ page: next > 1 ? String(next) : undefined }),
      }}
      getKey={(item) => item.id}
      columns={columns}
      loadState={loadState}
      refreshing={refreshing}
      filter={
        <ListFilterButton
          label="فیلتر درخواست‌ها"
          onChange={(key, value) => writeUrl({ [key]: value, page: undefined })}
          groups={[
            {
              key: 'status',
              label: 'وضعیت',
              value: status,
              options: REQUEST_STATUS_FILTER_OPTIONS.map((option) => ({
                value: option.value === 'all' ? '' : option.value,
                label: option.label,
                count: counts?.[option.value],
              })),
            },
            {
              key: 'eventId',
              label: 'رویداد',
              value: filters.eventId,
              options: [
                { value: '', label: 'همه رویدادها' },
                ...events.map((event) => ({ value: event.id, label: event.title })),
              ],
            },
            {
              key: 'stage',
              label: 'مرحله',
              value: filters.stage,
              options: [{ value: '', label: 'همه مرحله‌ها' }, ...REVIEW_STAGE_OPTIONS],
            },
            ...(canFollowUp
              ? [
                  {
                    key: 'followUp',
                    label: FOLLOW_UP_LABEL,
                    value: filters.followUp ? '1' : undefined,
                    options: [
                      { value: '', label: 'همه درخواست‌ها' },
                      { value: '1', label: 'فقط پرونده‌های پیگیری سرمایه‌گذاری' },
                    ],
                  },
                ]
              : []),
          ]}
        />
      }
      onRetry={() => {
        setFailure(null)
        setRetries((count) => count + 1)
      }}
    />
  )
}
