'use client'
import Image from 'next/image'
import Link from 'next/link'
import {
  AdminListView,
  AdminRowActions,
  type AdminColumn,
} from '@/components/dashboard/admin-list-view'
import { Typography } from '@/components/ui/typography'
type Request = {
  id: string
  company: string
  request: string
  status: 'درحال بررسی' | 'رد شده' | 'درخواست داده نشده'
  date: string
}
const requests: Request[] = [
  {
    id: '1',
    company: 'شرکت آریانا فناوران',
    request: 'کنفرانس انرژی پایدار تهران',
    status: 'درحال بررسی',
    date: '۱۴۰۵/۰۱/۰۶',
  },
  {
    id: '2',
    company: 'شرکت نوآوران پارس',
    request: 'نمایشگاه فناوری‌های نوین نفت شیراز',
    status: 'رد شده',
    date: '۱۴۰۵/۰۱/۰۶',
  },
  {
    id: '3',
    company: 'شرکت توسعه سبز',
    request: 'همایش بین‌المللی پتروشیمی اصفهان',
    status: 'درخواست داده نشده',
    date: '۱۴۰۵/۰۱/۰۶',
  },
  {
    id: '4',
    company: 'شرکت داده‌پردازان مهر',
    request: 'کنفرانس انرژی پایدار تهران',
    status: 'درحال بررسی',
    date: '۱۴۰۵/۰۱/۰۶',
  },
  {
    id: '5',
    company: 'شرکت رایان ارتباطات',
    request: 'نمایشگاه فناوری‌های نوین نفت شیراز',
    status: 'رد شده',
    date: '۱۴۰۵/۰۱/۰۶',
  },
]
const statusStyle: Record<
  Request['status'],
  { color: 'brand-600' | 'error' | 'secondary'; bg: string }
> = {
  'درحال بررسی': { color: 'brand-600', bg: 'bg-brand-50' },
  'رد شده': { color: 'error', bg: 'bg-error-50' },
  'درخواست داده نشده': { color: 'secondary', bg: 'bg-neutral-100' },
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
      <Link href={`/dashboard/admin/requests/${item.id}`} className="flex items-center gap-2">
        <Image
          src="/figma/dashboard/admin-employee-avatar.png"
          alt=""
          width={40}
          height={40}
          className="size-10 rounded-full object-cover"
        />
        {text(item.company)}
      </Link>
    ),
  },
  { id: 'request', header: 'درخواست', render: (item) => text(item.request) },
  {
    id: 'status',
    header: 'وضعیت',
    render: (item) => (
      <Typography
        variant="14/regular"
        color={statusStyle[item.status].color}
        className={`inline-block rounded-lg px-3 py-1 ${statusStyle[item.status].bg}`}
      >
        {item.status}
      </Typography>
    ),
  },
  { id: 'date', header: 'تاریخ ثبت', render: (item) => text(item.date) },
  {
    id: 'actions',
    render: (item) => (
      <AdminRowActions
        viewHref={`/dashboard/admin/requests/${item.id}`}
        deleteLabel="حذف درخواست"
      />
    ),
  },
]
export function AdminRequestList() {
  return (
    <AdminListView
      title="درخواست ها"
      addLabel="درخواست جدید"
      searchPlaceholder="درخواست خود را جست و جو کنید"
      items={requests}
      getSearchText={(item) => Object.values(item).join(' ')}
      getKey={(item) => item.id}
      columns={columns}
    />
  )
}
