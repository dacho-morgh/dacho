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
type Company = {
  id: string
  name: string
  ceo: string
  companyType: string
  address: string
  activityAge: string
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
  {
    id: 'actions',
    render: (item) => <AdminRowActions viewHref={`/dashboard/companies/${item.id}`} />,
  },
]
export function CompanyList() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loadState, setLoadState] = useState<AdminListLoadState>('loading')
  const loadCompanies = useCallback(async () => {
    setLoadState('loading')
    try {
      const response = await fetch('/api/dashboard/admin/companies?limit=100', { cache: 'no-store' })
      if (response.status === 401) { setLoadState('unauthenticated'); return }
      if (response.status === 403) { setLoadState('denied'); return }
      if (!response.ok) { setLoadState('error'); return }
      const data = (await response.json()) as { items?: { id: string; companyName?: string; name?: string; companyType?: string; companyProvince?: string; companyCity?: string; companyEstablishmentDate?: string; executives?: { role?: string; name?: string }[] }[] }
      if (!Array.isArray(data.items)) { setLoadState('error'); return }
      setCompanies(data.items.map((item) => ({
        id: item.id,
        name: item.companyName || item.name || '—',
        ceo: item.executives?.find((executive) => /مدیر\s*عامل/i.test(executive.role || ''))?.name || item.name || '—',
        companyType: item.companyType || '—',
        address: [item.companyProvince, item.companyCity].filter(Boolean).join('، ') || '—',
        activityAge: activityAgeLabel(item.companyEstablishmentDate),
      })))
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [])
  useEffect(() => { void loadCompanies() }, [loadCompanies])
  return (
    <AdminListView
      title="شرکت ها"
      addLabel="شرکت جدید"
      searchPlaceholder="جستجوی شرکت"
      items={companies}
      getSearchText={(item) => Object.values(item).join(' ')}
      getKey={(item) => item.id}
      columns={columns}
      loadState={loadState}
      onRetry={() => void loadCompanies()}
    />
  )
}

function activityAgeLabel(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) return '—'
  const years = new Date().getFullYear() - date.getFullYear() - (new Date().getTime() < new Date(new Date().getFullYear(), date.getMonth(), date.getDate()).getTime() ? 1 : 0)
  return `${Math.max(0, years).toLocaleString('fa-IR')} سال`
}
