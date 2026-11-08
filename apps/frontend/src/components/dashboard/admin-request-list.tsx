'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AdminListView,
  AdminRowActions,
  type AdminColumn,
  type AdminListLoadState,
} from '@/components/dashboard/admin-list-view'
import { RequestsPagination } from '@/components/dashboard/requests/requests-pagination'
import {
  requestFiltersQuery,
  type RequestQueueFilters,
  type RequestStatus,
} from '@/components/dashboard/requests/types'
import { Typography } from '@/components/ui/typography'
type Request = {
  id: string
  company: string
  request: string
  status: 'پیش‌نویس' | 'درحال بررسی' | 'نیازمند اصلاح' | 'تایید شده' | 'رد شده'
  stage: string
  /** The next step the server lists for this person, if any. */
  pending: string | null
  date: string
}
const STAGE_LABELS: Record<string, string> = {
  chief_triage: 'بررسی اولیه',
  triaged: 'داوری',
  advanced: 'مالی و سرمایه‌گذاری',
}
/** Most specific first; only commands with a control on the dossier. */
const PENDING_LABELS: [string, string][] = [
  ['triage', 'منتظر بررسی اولیه شما'],
  ['startReview', 'منتظر تعیین داوران'],
  ['decideReview', 'منتظر تصمیم شما'],
  ['reopen', 'قابل بازگشایی'],
]
const statusStyle: Record<
  Request['status'],
  { color: 'brand-600' | 'error' | 'secondary' | 'success'; bg: string }
> = {
  'درحال بررسی': { color: 'brand-600', bg: 'bg-brand-50' },
  'نیازمند اصلاح': { color: 'secondary', bg: 'bg-warning-50' },
  'تایید شده': { color: 'success', bg: 'bg-success-50' },
  'پیش‌نویس': { color: 'secondary', bg: 'bg-neutral-100' },
  'رد شده': { color: 'error', bg: 'bg-error-50' },
}
const text = (value: string) => (
  <Typography variant="14/regular" color="secondary">
    {value}
  </Typography>
)
const columns: AdminColumn<Request>[] = [
  {
    id: 'company',
    header: 'نام شرکت',
    render: (item) => (
      <Link href={`/dashboard/requests/${item.id}`} className="flex items-center gap-2">
        {text(item.company)}
      </Link>
    ),
  },
  { id: 'request', header: 'درخواست', render: (item) => text(item.request) },
  {
    id: 'status',
    header: 'وضعیت',
    render: (item) => {
      const style = statusStyle[item.status] ?? statusStyle['درحال بررسی']
      return <Typography variant="14/regular" color={style.color} className={`inline-block rounded-lg px-3 py-1 ${style.bg}`}>{item.status}</Typography>
    },
  },
  {
    id: 'stage',
    header: 'مرحله',
    render: (item) => (
      <span className="flex flex-col gap-1">
        {text(item.stage)}
        {item.pending ? (
          <Typography variant="12/regular" color="brand-600">{item.pending}</Typography>
        ) : null}
      </span>
    ),
  },
  { id: 'date', header: 'تاریخ ثبت', render: (item) => text(item.date) },
  {
    id: 'actions',
    render: (item) => (
      <AdminRowActions
        viewHref={`/dashboard/requests/${item.id}`}
      />
    ),
  },
]
export function AdminRequestList({
  status,
  page = 1,
  filters = {},
  toolbar,
  notice,
}: {
  status?: RequestStatus
  page?: number
  filters?: RequestQueueFilters
  /** Search and the shared filter button, rendered in the list's toolbar row. */
  toolbar?: React.ReactNode
  /** A line under the title, such as the work queue the list is narrowed to. */
  notice?: React.ReactNode
} = {}) {
  const [requests, setRequests] = useState<Request[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loadState, setLoadState] = useState<AdminListLoadState>('loading')
  // The API narrows and pages the list, so what shows matches the count of the same filters.
  const query = `limit=50&page=${page}${status ? `&status=${status}` : ''}${requestFiltersQuery(filters)}`
  const latestLoad = useRef(0)
  const loadRequests = useCallback(async () => {
    const load = ++latestLoad.current
    setLoadState('loading')
    try {
      const response = await fetch(`/api/dashboard/admin/requests?${query}`, { cache: 'no-store' })
      // A slower answer to an earlier filter must not replace the current list.
      if (load !== latestLoad.current) return
      if (response.status === 401) { setLoadState('unauthenticated'); return }
      if (response.status === 403) { setLoadState('denied'); return }
      if (!response.ok) { setLoadState('error'); return }
      const data = (await response.json()) as { totalPages?: number; items?: { id: string; title: string; status: string; reviewStage?: string | null; allowedActions?: string[]; createdAt: string; owner?: { companyName?: string; name?: string } }[] }
      if (load !== latestLoad.current) return
      if (!Array.isArray(data.items)) { setLoadState('error'); return }
      setTotalPages(data.totalPages ?? 1)
      setRequests(data.items.map((item) => ({
        id: item.id,
        company: item.owner?.companyName || item.owner?.name || '—',
        request: item.title,
        status: ({ draft: 'پیش‌نویس', in_review: 'درحال بررسی', action_needed: 'نیازمند اصلاح', approved: 'تایید شده', rejected: 'رد شده' }[item.status] ?? item.status) as Request['status'],
        stage: (item.reviewStage && STAGE_LABELS[item.reviewStage]) || '—',
        pending: PENDING_LABELS.find(([action]) => item.allowedActions?.includes(action))?.[1] ?? null,
        date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('fa-IR') : '—',
      })))
      setLoadState('ready')
    } catch {
      if (load === latestLoad.current) setLoadState('error')
    }
  }, [query])
  useEffect(() => { void loadRequests() }, [loadRequests])
  return (
    <>
      <AdminListView
        title="درخواست ها"
        items={requests}
        getSearchText={(item) => Object.values(item).join(' ')}
        getKey={(item) => item.id}
        getRowHref={(item) => `/dashboard/requests/${encodeURIComponent(item.id)}`}
        notice={notice}
        columns={columns}
        loadState={loadState}
        onRetry={() => void loadRequests()}
        serverFiltered
        toolbar={toolbar}
      />
      {loadState === 'ready' && (
        <div className="pb-4">
          <RequestsPagination page={page} totalPages={totalPages} status={status} filters={filters} />
        </div>
      )}
    </>
  )
}
