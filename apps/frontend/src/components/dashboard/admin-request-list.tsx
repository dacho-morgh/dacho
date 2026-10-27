'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AdminListView,
  AdminRowActions,
  type AdminColumn,
  type AdminListLoadState,
} from '@/components/dashboard/admin-list-view'
import { Typography } from '@/components/ui/typography'
type Request = {
  id: string
  company: string
  request: string
  status: 'پیش‌نویس' | 'درحال بررسی' | 'نیازمند اصلاح' | 'تایید شده' | 'رد شده'
  date: string
}
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
export function AdminRequestList() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loadState, setLoadState] = useState<AdminListLoadState>('loading')
  const loadRequests = useCallback(async () => {
    setLoadState('loading')
    try {
      const response = await fetch('/api/dashboard/admin/requests?limit=100', { cache: 'no-store' })
      if (response.status === 401) { setLoadState('unauthenticated'); return }
      if (response.status === 403) { setLoadState('denied'); return }
      if (!response.ok) { setLoadState('error'); return }
      const data = (await response.json()) as { items?: { id: string; title: string; status: string; createdAt: string; owner?: { companyName?: string; name?: string } }[] }
      if (!Array.isArray(data.items)) { setLoadState('error'); return }
      setRequests(data.items.map((item) => ({
        id: item.id,
        company: item.owner?.companyName || item.owner?.name || '—',
        request: item.title,
        status: ({ draft: 'پیش‌نویس', in_review: 'درحال بررسی', action_needed: 'نیازمند اصلاح', approved: 'تایید شده', rejected: 'رد شده' }[item.status] ?? item.status) as Request['status'],
        date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('fa-IR') : '—',
      })))
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [])
  useEffect(() => { void loadRequests() }, [loadRequests])
  return (
    <AdminListView
      title="درخواست ها"
      addLabel="درخواست جدید"
      searchPlaceholder="درخواست خود را جست و جو کنید"
      items={requests}
      getSearchText={(item) => Object.values(item).join(' ')}
      getKey={(item) => item.id}
      columns={columns}
      loadState={loadState}
      onRetry={() => void loadRequests()}
    />
  )
}
