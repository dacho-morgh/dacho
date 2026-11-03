'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AdminListView,
  type AdminColumn,
  type AdminListLoadState,
} from '@/components/dashboard/admin-list-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/utilities/dashboard-api'
import { Typography } from '@/components/ui/typography'
import { CompanyCreateDialog } from '@/components/dashboard/company-create-dialog'
import { ListFilterButton } from '@/components/dashboard/list-filter-button'

export type VerificationStatus =
  | 'unsubmitted'
  | 'pending'
  | 'approved'
  | 'returned'
  | 'rejected'

type Company = {
  id: string
  name: string
  ceo: string
  companyType: string
  address: string
  activityAge: string
  verificationStatus: VerificationStatus
  verificationRevision: number
  submittedAt: string | null
}

type VerificationQueue = 'all' | 'pending' | 'approved' | 'returned' | 'rejected'

const QUEUES: { id: VerificationQueue; label: string }[] = [
  { id: 'all', label: 'همه' },
  { id: 'pending', label: 'در انتظار بررسی' },
  { id: 'approved', label: 'تأیید شده' },
  { id: 'returned', label: 'برگشت داده شده' },
  { id: 'rejected', label: 'رد شده' },
]

function verificationStatusBadge(status: VerificationStatus): {
  label: string
  variant: 'warning' | 'success' | 'amber' | 'error' | 'gray'
} {
  switch (status) {
    case 'pending':
      return { label: 'در انتظار بررسی', variant: 'warning' }
    case 'approved':
      return { label: 'تأیید شده', variant: 'success' }
    case 'returned':
      return { label: 'برگشت داده شده', variant: 'amber' }
    case 'rejected':
      return { label: 'رد شده', variant: 'error' }
    case 'unsubmitted':
    default:
      return { label: 'ارسال نشده', variant: 'gray' }
  }
}

const text = (value: string) => (
  <Typography variant="14/regular" color="secondary">
    {value}
  </Typography>
)

const columns: AdminColumn<Company>[] = [
  {
    id: 'name',
    header: 'نام شرکت',
    render: (item) => (
      <Link href={`/dashboard/companies/${item.id}`} className="flex items-center gap-2">
        {text(item.name)}
      </Link>
    ),
  },
  { id: 'submittedAt', header: 'تاریخ ارسال', render: (item) => text(formatDate(item.submittedAt) || '—') },
  {
    id: 'verificationStatus',
    header: 'وضعیت',
    render: (item) => {
      const badge = verificationStatusBadge(item.verificationStatus)
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={badge.variant} size="sm">
            {badge.label}
          </Badge>
          {item.verificationRevision > 0 && (
            <Typography variant="12/regular" color="muted">
              (نسخه {item.verificationRevision.toLocaleString('fa-IR')})
            </Typography>
          )}
        </div>
      )
    },
  },
  {
    id: 'actions',
    header: 'عملیات',
    render: (item) => (
      <Button asChild variant="link" size="clear">
        <Link href={`/dashboard/companies/${item.id}`}>
          {item.verificationStatus === 'pending' ? 'بررسی' : 'مشاهده'}
        </Link>
      </Button>
    ),
  },
  { id: 'ceo', header: 'مدیر عامل', render: (item) => text(item.ceo) },
  {
    id: 'type',
    header: 'نوع شرکت',
    render: (item) => (
      <Typography
        variant="14/regular"
        color="brand-600"
        className="inline-block rounded-lg bg-brand-50 px-3 py-1"
      >
        {item.companyType}
      </Typography>
    ),
  },
  { id: 'address', header: 'آدرس', render: (item) => text(item.address) },
  { id: 'activity', header: 'سال فعالیت', render: (item) => text(item.activityAge) },
]

/** `canCreateCompany`: the System Owner sees «شرکت جدید» (FE34); Secretariat only reviews. */
export function CompanyList({ canCreateCompany = false }: { canCreateCompany?: boolean } = {}) {
  const searchParams = useSearchParams()
  const initialStatus = (searchParams?.get('status') as VerificationQueue) || 'all'
  const [queueFilter, setQueueFilter] = useState<VerificationQueue>(
    QUEUES.some((q) => q.id === initialStatus) ? initialStatus : 'all',
  )
  const [companies, setCompanies] = useState<Company[]>([])
  const [loadState, setLoadState] = useState<AdminListLoadState>('loading')

  const loadCompanies = useCallback(async () => {
    setLoadState('loading')
    try {
      const response = await fetch('/api/dashboard/admin/companies?limit=100', { cache: 'no-store' })
      if (response.status === 401) {
        setLoadState('unauthenticated')
        return
      }
      if (response.status === 403) {
        setLoadState('denied')
        return
      }
      if (!response.ok) {
        setLoadState('error')
        return
      }
      const data = (await response.json()) as {
        items?: {
          id: string
          companyId?: string | null
          companyName?: string
          name?: string
          companyType?: string
          companyProvince?: string
          companyCity?: string
          companyEstablishmentDate?: string
          executives?: { role?: string; name?: string }[]
          verificationStatus?: VerificationStatus
          verificationRevision?: number
          verificationSubmittedAt?: string | null
        }[]
      }
      if (!Array.isArray(data.items)) {
        setLoadState('error')
        return
      }
      setCompanies(
        data.items.map((item) => ({
          id: item.id,
          name: item.companyName || item.name || '—',
          ceo:
            item.executives?.find((executive) => /مدیر\s*عامل/i.test(executive.role || ''))?.name ||
            item.name ||
            '—',
          companyType: item.companyType || '—',
          address: [item.companyProvince, item.companyCity].filter(Boolean).join('، ') || '—',
          activityAge: activityAgeLabel(item.companyEstablishmentDate),
          verificationStatus: item.verificationStatus || 'unsubmitted',
          verificationRevision: item.verificationRevision || 0,
          submittedAt: item.verificationSubmittedAt ?? null,
        })),
      )
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void loadCompanies()
  }, [loadCompanies])

  const counts = useMemo(() => {
    return {
      all: companies.length,
      pending: companies.filter((c) => c.verificationStatus === 'pending').length,
      approved: companies.filter((c) => c.verificationStatus === 'approved').length,
      returned: companies.filter((c) => c.verificationStatus === 'returned').length,
      rejected: companies.filter((c) => c.verificationStatus === 'rejected').length,
    }
  }, [companies])

  const filteredCompanies = useMemo(() => {
    if (queueFilter === 'all') return companies
    return companies.filter((c) => c.verificationStatus === queueFilter)
  }, [companies, queueFilter])

  const filter = (
    <ListFilterButton
      label="فیلتر شرکت‌ها"
      groups={[
        {
          key: 'status',
          label: 'وضعیت احراز',
          value: queueFilter === 'all' ? undefined : queueFilter,
          options: QUEUES.map((q) => ({ value: q.id === 'all' ? '' : q.id, label: q.label, count: counts[q.id] })),
        },
      ]}
      onChange={(_, value) => {
        const next = (value as VerificationQueue | undefined) ?? 'all'
        setQueueFilter(next)
        // Keep the queue in the URL so back, refresh and sharing reopen it.
        const params = new URLSearchParams(window.location.search)
        if (next === 'all') params.delete('status')
        else params.set('status', next)
        const query = params.toString()
        window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
      }}
    />
  )

  return (
    <AdminListView
      title="احراز هویت شرکت‌ها"
      notice={
        loadState === 'ready' && counts.pending > 0 ? (
          <div role="status" className="flex flex-col gap-1 rounded-2xl bg-brand-50 p-4 text-brand-700">
            <Typography variant="16/semibold" className="text-inherit">
              {counts.pending.toLocaleString('fa-IR')} شرکت در انتظار بررسی
            </Typography>
            <Typography variant="14/regular" className="text-inherit">
              پس از تایید احراز هویت، شرکت می‌تواند درخواست ثبت کند.
            </Typography>
          </div>
        ) : undefined
      }
      addAction={canCreateCompany ? <CompanyCreateDialog onCreated={() => void loadCompanies()} /> : undefined}
      searchPlaceholder="جستجوی شرکت"
      items={filteredCompanies}
      getSearchText={(item) =>
        [item.name, item.ceo, item.companyType, item.address, item.verificationStatus].join(' ')
      }
      getKey={(item) => item.id}
      columns={columns}
      loadState={loadState}
      filter={filter}
      onRetry={() => void loadCompanies()}
    />
  )
}

function activityAgeLabel(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) return '—'
  const years =
    new Date().getFullYear() -
    date.getFullYear() -
    (new Date().getTime() <
    new Date(new Date().getFullYear(), date.getMonth(), date.getDate()).getTime()
      ? 1
      : 0)
  return `${Math.max(0, years).toLocaleString('fa-IR')} سال`
}
