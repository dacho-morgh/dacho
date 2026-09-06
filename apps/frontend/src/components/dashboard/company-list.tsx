'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  DashboardAddIcon,
  DashboardFilterIcon,
  DashboardMoreIcon,
  DashboardSearchIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
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

export function CompanyList() {
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => companies.filter((company) => Object.values(company).join(' ').includes(query)),
    [query],
  )
  return (
    <section className="flex flex-1 flex-col gap-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button size="48" className="min-w-[157px]" icon={<DashboardAddIcon className="size-6" />}>
          <Typography variant="16/regular" color="white">
            شرکت جدید
          </Typography>
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline-gray"
            size="48"
            icon={<DashboardFilterIcon className="size-6" />}
            aria-label="فیلتر"
          />
          <div className="relative">
            <DashboardSearchIcon className="absolute right-3 top-3 size-6 text-neutral-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 w-[min(400px,70vw)] rounded-xl bg-white pr-11"
              placeholder="جستجوی شرکت"
            />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white lg:min-h-[848px]">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead>
            <tr className="h-11 border-b border-neutral-200 bg-white">
              {['نام شرکت', 'مدیر عامل', 'نوع شرکت', 'آدرس', 'سال فعالیت', ''].map((label) => (
                <th key={label} className="px-4 text-right">
                  <Typography variant="14/semibold" color="secondary">
                    {label || <span className="sr-only">عملیات</span>}
                  </Typography>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((company) => (
              <tr key={company.id} className="h-[72px] border-b border-neutral-100 last:border-0">
                <td className="px-4">
                  <Link
                    href={`/dashboard/admin/companies/${company.id}`}
                    className="flex items-center gap-2"
                  >
                    <Image
                      src={company.avatar}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 rounded-lg object-cover"
                    />
                    <Typography variant="14/semibold" color="secondary">
                      {company.name}
                    </Typography>
                  </Link>
                </td>
                <Cell>{company.ceo}</Cell>
                <Cell>
                  <Typography
                    variant="14/regular"
                    color="brand-600"
                    className="inline-block rounded-lg bg-brand-50 px-3 py-1"
                  >
                    {company.companyType}
                  </Typography>
                </Cell>
                <Cell>{company.address}</Cell>
                <Cell>{company.activityAge}</Cell>
                <td className="px-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="text-gray" size="icon-sm" aria-label="عملیات">
                        <DashboardMoreIcon className="size-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/admin/companies/${company.id}`}>
                          <Typography variant="14/regular">مشاهده</Typography>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Typography variant="14/regular">ویرایش</Typography>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Typography variant="14/regular" color="error">
                          حذف
                        </Typography>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="h-60 text-center">
                  <Typography variant="16/regular" color="muted">
                    شرکتی با این مشخصات پیدا نشد
                  </Typography>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4">
      <Typography variant="14/regular" color="secondary">
        {children}
      </Typography>
    </td>
  )
}
