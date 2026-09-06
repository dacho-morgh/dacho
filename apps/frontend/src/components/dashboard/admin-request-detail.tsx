'use client'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { CalendarBulkIcon, LocationBulkIcon, TickCircleIcon, ArrowUpIcon } from '@/components/icons'
const steps = [
  'بررسی توسط کارشناسان صندوق',
  'بررسی توسط داوران',
  'بررسی توسط کمیته سرمایه‌گذاری',
  'بررسی توسط کارشناسان صندوق',
  'بررسی توسط کارشناسان صندوق',
]
export function AdminRequestDetail({ id }: { id: string }) {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:pt-10" dir="rtl">
      <Link href="/dashboard/admin/requests">
        <Typography variant="14/regular" color="brand-600">
          درخواست ها / درخواست شرکت آریانا فناوران
        </Typography>
      </Link>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <Image
            src="/figma/dashboard/admin-request-company-logo.png"
            alt="شرکت آریانا فناوران"
            width={80}
            height={80}
            className="size-20 rounded-xl object-cover"
          />
          <div>
            <Typography variant="20/bold" color="neutral-900">
              شرکت آریانا فناوران
            </Typography>
            <Typography variant="14/regular" color="muted">
              فعال | سهامی عام | ۵ سال
            </Typography>
          </div>
        </div>
        <Button asChild variant="outline" size="40">
          <Link href="/dashboard/admin/companies/1">
            <Typography variant="14/regular">مشاهده پروفایل شرکت</Typography>
          </Link>
        </Button>
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Image
            src="/figma/dashboard/admin-request-event.png"
            alt="نمایشگاه"
            width={200}
            height={200}
            className="size-[200px] rounded-xl object-cover"
          />
          <div className="flex flex-1 flex-col gap-3">
            <Typography
              variant="14/regular"
              color="muted"
              className="w-fit rounded-lg bg-neutral-100 px-3 py-1"
            >
              تمام شده
            </Typography>
            <Typography variant="20/bold" color="neutral-900">
              نمایشگاه بین‌المللی نفت، گاز، پالایش و پتروشیمی پارس جنوبی (عسلویه)
            </Typography>
            <Typography variant="14/regular" color="secondary">
              <CalendarBulkIcon className="mr-2 inline size-6" />
              ۱۲-۱۵ بهمن ۱۴۰۵
            </Typography>
            <Typography variant="14/regular" color="secondary">
              <LocationBulkIcon className="mr-2 inline size-6" />
              عسلویه، بلوار سیراف، محل دائمی برگزاری همایش‌ها و نمایش‌های بین‌المللی
            </Typography>
          </div>
          <Button asChild size="40" className="self-end lg:self-center">
            <Link href={`/dashboard/admin/requests/${id}/evaluation`}>
              <Typography variant="14/regular" color="white">
                ارزیابی درخواست
              </Typography>
            </Link>
          </Button>
        </div>
        <div className="my-8 h-px bg-neutral-200" />
        <Typography variant="20/bold" color="neutral-900">
          وضعیت درخواست
        </Typography>
        <div className="mt-6">
          {steps.map((step, index) => (
            <div className="flex gap-3" key={`${index}-${step}`}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex size-8 items-center justify-center rounded-full ${index === 0 ? 'bg-success-50 text-success-700' : index === 1 ? 'bg-brand-50 text-brand-600' : 'bg-neutral-100 text-neutral-500'}`}
                >
                  {index === 0 ? (
                    <TickCircleIcon className="size-5" />
                  ) : (
                    <Typography variant="14/semibold">{index + 1}</Typography>
                  )}
                </div>
                {index < 4 && (
                  <div
                    className={`h-12 w-px ${index === 0 ? 'bg-success-500' : index === 1 ? 'bg-brand-500' : 'bg-neutral-200'}`}
                  />
                )}
              </div>
              <div className="pb-5">
                <Typography variant="16/semibold" color={index === 1 ? 'brand-600' : 'secondary'}>
                  {step}
                </Typography>
                <Typography variant="14/regular" color="muted">
                  {index === 0
                    ? 'درخواست شما توسط کارشناسان صندوق بررسی و تایید شده است.'
                    : index === 1
                      ? 'درخواست شما در حال بررسی توسط داوران است.'
                      : 'این مرحله پس از تکمیل مرحله قبل انجام خواهد شد.'}
                </Typography>
              </div>
            </div>
          ))}
        </div>
        <div className="my-8 h-px bg-neutral-200" />
        <div className="flex items-center justify-between">
          <Typography variant="20/bold" color="neutral-900">
            اطلاعات و فرم رویداد
          </Typography>
          <ArrowUpIcon className="size-6 text-neutral-600" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ['نام رویداد', 'نمایشگاه بین‌المللی نفت، گاز، پالایش و پتروشیمی'],
            ['تاریخ برگزاری', '۱۲-۱۵ بهمن ۱۴۰۵'],
            ['نوع درخواست', 'حضور در نمایشگاه'],
            ['وضعیت', 'تکمیل شده'],
          ].map(([label, value]) => (
            <div className="rounded-xl border border-neutral-200 p-4" key={label}>
              <Typography variant="12/regular" color="muted">
                {label}
              </Typography>
              <Typography variant="16/regular" color="secondary" className="mt-2">
                {value}
              </Typography>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
