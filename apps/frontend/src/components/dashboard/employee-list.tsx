'use client'
import Image from 'next/image'
import {
  AdminListView,
  AdminRowActions,
  type AdminColumn,
} from '@/components/dashboard/admin-list-view'
import { Typography } from '@/components/ui/typography'
type EmployeeRole = 'داور' | 'کمیته سرمایه گذاری' | 'رئیس کمیته داوری' | 'ادمین'
type Employee = { id: string; name: string; role: EmployeeRole; activity: string; degree: string }
const employees: Employee[] = [
  {
    id: '1',
    name: 'مهندس آرش حسینی',
    role: 'داور',
    activity: 'فناوری اطلاعات',
    degree: 'کارشناسی ارشد مدیریت بازرگانی',
  },
  {
    id: '2',
    name: 'دکتر نازنین بهرامی',
    role: 'کمیته سرمایه گذاری',
    activity: 'خدمات مالی',
    degree: 'کارشناسی ارشد فناوری اطلاعات',
  },
  {
    id: '3',
    name: 'مهندس سجاد کریمی',
    role: 'داور',
    activity: 'تولید صنعتی',
    degree: 'کارشناسی مهندسی برق',
  },
  {
    id: '4',
    name: 'دکتر الهام رضایی',
    role: 'رئیس کمیته داوری',
    activity: 'بازاریابی دیجیتال',
    degree: 'کارشناسی مهندسی کامپیوتر',
  },
  {
    id: '5',
    name: 'مهندس پیمان احمدی',
    role: 'ادمین',
    activity: 'مشاوره مدیریت',
    degree: 'دکتری علوم کامپیوتر',
  },
]
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
const columns: AdminColumn<Employee>[] = [
  {
    id: 'name',
    header: 'نام کارمند',
    render: (item) => (
      <div className="flex items-center gap-2">
        <Image
          src="/figma/dashboard/admin-employee-avatar.png"
          alt=""
          width={40}
          height={40}
          className="size-10 rounded-full object-cover"
        />
        {text(item.name)}
      </div>
    ),
  },
  {
    id: 'role',
    header: 'نقش',
    render: (item) => (
      <Typography
        variant="14/regular"
        color={roleStyles[item.role].color}
        className={`inline-block rounded-lg px-3 py-1 ${roleStyles[item.role].background}`}
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
  { id: 'actions', render: () => <AdminRowActions deleteLabel="حذف کارمند" /> },
]
export function EmployeeList() {
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
