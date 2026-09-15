'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { useEffect, useState } from 'react'
import { DashboardAddIcon, DashboardEditIcon, DashboardTrashIcon } from '@/components/icons'

export function CompanyDetailView({ id }: { id: string }) {
  const [data, setData] = useState<{ user?: { companyName?: string; companyEstablishmentDate?: string; companyStatus?: string; companyType?: string; companyRegistrationNumber?: string; companyEconomicCode?: string; companyNationalId?: string }; profile?: { addresses: { title: string; address: string; postalCode: string }[] } } | null>(null)
  useEffect(() => { fetch(`/api/dashboard/admin/companies/${encodeURIComponent(id)}`).then((response) => response.ok ? response.json() : null).then(setData).catch(() => setData(null)) }, [id])
  const user = data?.user
  const fields: Array<[string, string | undefined]> = [['نام شرکت', user?.companyName], ['تاریخ تاسیس', user?.companyEstablishmentDate], ['وضعیت شرکت', user?.companyStatus], ['نوع شرکت', user?.companyType], ['شماره ثبت', user?.companyRegistrationNumber], ['کد اقتصادی', user?.companyEconomicCode], ['شناسه ملی', user?.companyNationalId]]
  const addresses = data?.profile?.addresses ?? []
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 p-6 sm:p-10" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href="/dashboard/companies">
          <Typography variant="14/regular" color="brand-600">
            شرکت ها
          </Typography>
        </Link>
        <Typography variant="14/regular" color="muted">
            / {user?.companyName || '—'}
        </Typography>
      </div>
      <div className="flex min-h-[912px] flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-4 lg:flex-row">
        <nav className="order-first flex w-full shrink-0 flex-row gap-2 border-b border-neutral-200 pb-4 lg:order-none lg:w-[200px] lg:flex-col lg:border-b-0 lg:border-l lg:pl-5">
          <Typography
            variant="16/semibold"
            color="brand-600"
            className="rounded-xl bg-brand-50 p-3"
          >
            پروفایل شرکت
          </Typography>
          {['رزومه', 'اطلاعات حساب', 'درخواست‌ها'].map((item) => (
            <Typography
              key={item}
              variant="16/regular"
              color="secondary"
              className="rounded-xl p-3"
            >
              {item}
            </Typography>
          ))}
          <Typography variant="16/regular" color="error" className="mt-auto rounded-xl p-3">
            حذف حساب شرکت
          </Typography>
        </nav>
        <div className="flex w-full max-w-[892px] flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Image
                src="/figma/dashboard/profile-avatar.png"
                alt={user?.companyName || 'شرکت'}
                width={80}
                height={80}
                className="rounded-xl object-cover"
              />
              <div>
                <Typography variant="20/bold" color="neutral-900">
                  {user?.companyName || '—'}
                </Typography>
                <Typography variant="14/regular" color="muted">
                  شناسه: {id}
                </Typography>
              </div>
            </div>
          </div>
          <InfoSection title="اطلاعات پایه" edit>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(([label, value]) => (
                <InfoField key={label} label={label} value={value || '—'} />
              ))}
            </div>
          </InfoSection>
          <InfoSection title="آدرس ها" add>
            <div className="flex flex-col gap-3">
              {addresses.map((address) => (
                <div key={address.title} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between">
                    <Typography variant="14/semibold" color="secondary">
                      {address.title}
                    </Typography>
                    <div className="flex gap-1">
                      <Button disabled variant="text-gray" size="icon-sm" aria-label="ویرایش">
                        <DashboardEditIcon className="size-5" />
                      </Button>
                      <Button disabled variant="text-gray" size="icon-sm" aria-label="حذف">
                        <DashboardTrashIcon className="size-5" />
                      </Button>
                    </div>
                  </div>
                  <Typography variant="14/regular" color="secondary" className="mt-3">
                    {address.address}
                  </Typography>
                  <Typography variant="12/regular" color="muted" className="mt-2">
                    کد پستی: {address.postalCode || '—'}
                  </Typography>
                </div>
              ))}
            </div>
          </InfoSection>
        </div>
      </div>
    </main>
  )
}
function InfoSection({
  title,
  children,
  edit,
  add,
}: {
  title: string
  children: React.ReactNode
  edit?: boolean
  add?: boolean
}) {
  return (
    <section className="rounded-xl border border-neutral-200 p-4">
      <div className="mb-5 flex items-center justify-between">
        <Typography variant="16/semibold" color="neutral-900">
          {title}
        </Typography>
        {edit ? (
          <Button disabled variant="outline-gray" size="32" icon={<DashboardEditIcon className="size-5" />}>
            <Typography variant="14/regular">ویرایش</Typography>
          </Button>
        ) : add ? (
          <Button disabled variant="outline-gray" size="32" icon={<DashboardAddIcon className="size-5" />}>
            <Typography variant="14/regular">افزودن آدرس</Typography>
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  )
}
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-3">
      <Typography variant="12/regular" color="muted">
        {label}
      </Typography>
      <Typography variant="16/regular" color="secondary" className="mt-1">
        {value}
      </Typography>
    </div>
  )
}
