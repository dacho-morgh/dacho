'use client'
import Image from 'next/image'
import Link from 'next/link'
import {
  AdminListView,
  AdminRowActions,
  type AdminColumn,
} from '@/components/dashboard/admin-list-view'
import { Typography } from '@/components/ui/typography'
type Company = {
  id: string
  name: string
  avatar: string
  ceo: string
  companyType: string
  address: string
  activityAge: string
}
const companies: Company[] = [
  {
    id: '1',
    name: 'پترو داده آوران پارس',
    avatar: '/figma/dashboard/company-avatar.png',
    ceo: 'مهندس سجادی',
    companyType: 'سهامی خاص',
    address: 'تهران، خیابان بهشتی',
    activityAge: '۲ روز پیش',
  },
  {
    id: '2',
    name: 'راهکاران هوشمند جنوب',
    avatar: '/figma/dashboard/company-avatar.png',
    ceo: 'سارا محمدی',
    companyType: 'مسئولیت محدود',
    address: 'بوشهر، بلوار امام',
    activityAge: '۵ روز پیش',
  },
  {
    id: '3',
    name: 'فناوری ایده پرداز',
    avatar: '/figma/dashboard/company-avatar.png',
    ceo: 'علی رضایی',
    companyType: 'سهامی خاص',
    address: 'شیراز، خیابان زند',
    activityAge: '۱ هفته پیش',
  },
  {
    id: '4',
    name: 'توسعه کسب و کار نوین',
    avatar: '/figma/dashboard/company-avatar.png',
    ceo: 'نسترن احمدی',
    companyType: 'سهامی عام',
    address: 'تهران، خیابان ولیعصر',
    activityAge: '۲ هفته پیش',
  },
  {
    id: '5',
    name: 'پیشگامان انرژی پارس',
    avatar: '/figma/dashboard/company-avatar.png',
    ceo: 'رضا کریمی',
    companyType: 'سهامی خاص',
    address: 'عسلویه، منطقه ویژه',
    activityAge: '۱ ماه پیش',
  },
]
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
      <Link href={`/dashboard/admin/companies/${item.id}`} className="flex items-center gap-2">
        <Image
          src={item.avatar}
          alt=""
          width={40}
          height={40}
          className="size-10 rounded-lg object-cover"
        />
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
    render: (item) => <AdminRowActions viewHref={`/dashboard/admin/companies/${item.id}`} />,
  },
]
export function CompanyList() {
  return (
    <AdminListView
      title="شرکت ها"
      addLabel="شرکت جدید"
      searchPlaceholder="جستجوی شرکت"
      items={companies}
      getSearchText={(item) => Object.values(item).join(' ')}
      getKey={(item) => item.id}
      columns={columns}
    />
  )
}
