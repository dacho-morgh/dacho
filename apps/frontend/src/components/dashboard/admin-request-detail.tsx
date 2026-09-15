'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { useEffect, useState } from 'react'
import { ArrowUpIcon } from '@/components/icons'
export function AdminRequestDetail({ id }: { id: string }) {
  const [data, setData] = useState<{ request: { title: string; status: string; ownerId: string; serviceName?: string; currentStep?: string | null; currentStepIndex?: number; answers: Record<string, unknown> }; owner?: { companyName?: string; name?: string }; workflow: { title: string }[] } | null>(null)
  useEffect(() => {
    fetch(`/api/dashboard/admin/requests/${encodeURIComponent(id)}`).then((response) => response.ok ? response.json() : null).then(setData).catch(() => setData(null))
  }, [id])
  const request = data?.request
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:pt-10" dir="rtl">
      <Link href="/dashboard/requests">
        <Typography variant="14/regular" color="brand-600">
          درخواست ها / {data?.owner?.companyName || data?.owner?.name || 'جزئیات درخواست'}
        </Typography>
      </Link>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <div>
            <Typography variant="20/bold" color="neutral-900">
              {data?.owner?.companyName || data?.owner?.name || '—'}
            </Typography>
            <Typography variant="14/regular" color="muted">
              {request ? requestStatusLabel(request.status) : '—'}
            </Typography>
          </div>
        </div>
          {request?.ownerId ? <Button asChild variant="outline" size="40">
            <Link href={`/dashboard/companies/${request.ownerId}`}>
              <Typography variant="14/regular">مشاهده پروفایل شرکت</Typography>
            </Link>
          </Button> : <Typography variant="14/regular" color="muted">پروفایل شرکت در دسترس نیست</Typography>}
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 flex-col gap-3">
            <Typography
              variant="14/regular"
              color="muted"
              className="w-fit rounded-lg bg-neutral-100 px-3 py-1"
            >
              {request ? requestStatusLabel(request.status) : '—'}
            </Typography>
            <Typography variant="20/bold" color="neutral-900">
              {request?.title || 'در حال بارگذاری درخواست'}
            </Typography>
            {request?.serviceName && <Typography variant="14/regular" color="secondary">خدمت: {request.serviceName}</Typography>}
            {request?.currentStep && <Typography variant="14/regular" color="secondary">مرحله فعلی: {request.currentStep}</Typography>}
          </div>
          {request ? <Button asChild size="40" className="self-end lg:self-center">
            <Link href={`/dashboard/requests/${id}/evaluation`}>
              <Typography variant="14/regular" color="white">ارزیابی درخواست</Typography>
            </Link>
          </Button> : <Typography variant="14/regular" color="muted">در حال بارگذاری...</Typography>}
        </div>
        <div className="my-8 h-px bg-neutral-200" />
        <Typography variant="20/bold" color="neutral-900">
          وضعیت درخواست
        </Typography>
        <div className="mt-6">
          {(data?.workflow?.length ? data.workflow.map((step) => step.title) : []).map((step, index) => (
            <div className="flex gap-3" key={`${index}-${step}`}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex size-8 items-center justify-center rounded-full ${index < (request?.currentStepIndex ?? -1) ? 'bg-success-50 text-success-700' : index === (request?.currentStepIndex ?? -1) ? 'bg-brand-50 text-brand-600' : 'bg-neutral-100 text-neutral-500'}`}
                >
                  <Typography variant="14/semibold">{index + 1}</Typography>
                </div>
                {index < (data?.workflow?.length ?? 0) - 1 && (
                  <div
                    className={`h-12 w-px ${index < (request?.currentStepIndex ?? -1) ? 'bg-success-500' : 'bg-neutral-200'}`}
                  />
                )}
              </div>
              <div className="pb-5">
                <Typography variant="16/semibold" color={index === (request?.currentStepIndex ?? -1) ? 'brand-600' : 'secondary'}>
                  {step}
                </Typography>
              </div>
            </div>
          ))}
        </div>
        <div className="my-8 h-px bg-neutral-200" />
        <div className="flex items-center justify-between">
          <Typography variant="20/bold" color="neutral-900">
            اطلاعات فرم درخواست
          </Typography>
          <ArrowUpIcon className="size-6 text-neutral-600" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Object.entries(request?.answers ?? {}).map(([label, value]) => (
            <div className="rounded-xl border border-neutral-200 p-4" key={label}>
              <Typography variant="12/regular" color="muted">
                {label}
              </Typography>
              <Typography variant="16/regular" color="secondary" className="mt-2">
                {String(value ?? '—')}
              </Typography>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function requestStatusLabel(status: string): string {
  return {
    draft: 'پیش‌نویس',
    in_review: 'در حال بررسی',
    action_needed: 'نیازمند اصلاح',
    approved: 'تایید شده',
    rejected: 'رد شده',
  }[status] ?? status
}
