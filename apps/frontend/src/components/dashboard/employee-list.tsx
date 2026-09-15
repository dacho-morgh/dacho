'use client'
import { useEffect, useState } from 'react'
import {
  AdminListView,
  type AdminColumn,
} from '@/components/dashboard/admin-list-view'
import { Typography } from '@/components/ui/typography'
type EmployeeRole = string
type Employee = { id: string; name: string; role: EmployeeRole; activity: string; degree: string }
const text = (value: string) => (
  <Typography variant="14/regular" color="secondary">
    {value}
  </Typography>
)
const roleStyles: Record<
  EmployeeRole,
  { color: 'brand-600' | 'warning' | 'success' | 'secondary'; background: string }
> = {
  داور: { color: 'brand-600', background: 'bg-brand-50' },
  'کمیته سرمایه گذاری': { color: 'warning', background: 'bg-warning-50' },
  'رئیس کمیته داوری': { color: 'success', background: 'bg-success-50' },
  ادمین: { color: 'secondary', background: 'bg-neutral-100' },
}
const roleStyleFallback = { color: 'secondary' as const, background: 'bg-neutral-100' }
const columns: AdminColumn<Employee>[] = [
  {
    id: 'name',
    header: 'نام کارمند',
    render: (item) => (
      <div className="flex items-center gap-2">{text(item.name)}</div>
    ),
  },
  {
    id: 'role',
    header: 'نقش',
    render: (item) => (
      <Typography
        variant="14/regular"
        color={(roleStyles[item.role] ?? roleStyleFallback).color}
        className={`inline-block rounded-lg px-3 py-1 ${(roleStyles[item.role] ?? roleStyleFallback).background}`}
      >
        {item.role}
      </Typography>
    ),
  },
  {
    id: 'activity',
    header: 'زمینه فعالیت',
    render: (item) => (
      <Typography
        variant="14/regular"
        color="brand-600"
        className="inline-block rounded-lg bg-brand-50 px-3 py-1"
      >
        {item.activity}
      </Typography>
    ),
  },
  { id: 'degree', header: 'مدرک دانشگاهی', render: (item) => text(item.degree) },
  { id: 'actions', render: () => null },
]
export function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([])
  useEffect(() => {
    fetch('/api/dashboard/admin/employees?limit=100').then((res) => res.ok ? res.json() : null).then((data) => {
      setEmployees((data?.items ?? []).map((item: { id: string; name?: string; position?: string; role?: string; companyType?: string }) => ({ id: item.id, name: item.name || '—', role: item.position || item.role || '—', activity: item.companyType || '—', degree: '—' })))
    }).catch(() => setEmployees([]))
  }, [])
  return (
    <AdminListView
      title="کارکنان"
      addLabel="کارمند جدید"
      searchPlaceholder="جستجوی کارمند"
      items={employees}
      getSearchText={(item) => Object.values(item).join(' ')}
      getKey={(item) => item.id}
      columns={columns}
    />
  )
}
