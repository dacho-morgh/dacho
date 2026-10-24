import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { AdminRequestDetail } from '@/components/dashboard/admin-request-detail'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Typography } from '@/components/ui/typography'
import type { RequestDetail } from '@/utilities/dashboard-api'
import { isInternalDashboardUser, serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isInternal = isInternalDashboardUser(user)

  if (isInternal) {
    return <AdminRequestDetail id={id} />
  }

  const data = await serverDashboardFetch<RequestDetail>(`/requests/${encodeURIComponent(id)}`)
  if (!data) notFound()

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-10" dir="rtl">
      <Typography as="h1" variant="24/bold" className="text-neutral-900">
        {data.request.title}
      </Typography>
      <Typography variant="14/regular" className="text-neutral-600">
        کد رهگیری: {data.request.trackingCode} · وضعیت: {requestStatusLabel(data.request.status)}
      </Typography>
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography as="h2" variant="20/bold" className="text-neutral-900">
          اطلاعات درخواست
        </Typography>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(data.request.answers ?? {}).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-neutral-50 p-3">
              <Typography variant="12/regular" className="text-neutral-500">
                {key}
              </Typography>
              <Typography variant="16/regular" className="mt-1 text-neutral-800">
                {String(value ?? '—')}
              </Typography>
            </div>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography as="h2" variant="20/bold" className="text-neutral-900">
          مدارک درخواست
        </Typography>
        <Typography variant="14/regular" className="text-neutral-500">
          مدارک مالی فقط برای شرکت، دبیرخانه، صاحب سیستم و مسئول سرمایه‌گذاریِ منتسب قابل مشاهده است.
        </Typography>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <PrivateDocumentField
            category="proposal"
            label="پروپوزال"
            requestId={data.request.id}
            canUpload={data.request.allowedActions?.includes('uploadDocument') === true}
            canDelete={data.request.allowedActions?.includes('deleteDocument') === true}
          />
          {([
            ['financialStatements', 'صورت‌های مالی'],
            ['debtFacilityEvidence', 'بدهی‌ها و تسهیلات'],
            ['taxInsuranceRecords', 'اظهارنامه مالیاتی و بیمه'],
            ['contractsOrdersMousCommitments', 'قراردادها و تعهدات'],
            ['projectEstimateUseOfFunds', 'برآورد و مصرف منابع'],
            ['guaranteeCollateral', 'تضامین و وثایق'],
          ] as const).map(([category, label]) => (
            <PrivateDocumentField
              key={category}
              category={category}
              label={label}
              requestId={data.request.id}
              canUpload={data.request.allowedActions?.includes('uploadDocument') === true}
              canDelete={data.request.allowedActions?.includes('deleteDocument') === true}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography as="h2" variant="20/bold" className="text-neutral-900">
          روند بررسی
        </Typography>
        {data.workflow.length ? (
          <div className="mt-4 space-y-3">
            {data.workflow.map((step) => (
              <div key={`${step.order}-${step.title}`} className="rounded-lg bg-neutral-50 p-3">
                <Typography variant="16/regular" className="text-neutral-800">
                  {step.title}
                </Typography>
              </div>
            ))}
          </div>
        ) : (
          <Typography variant="14/regular" className="mt-4 text-neutral-500">
            روندی برای این خدمت ثبت نشده است.
          </Typography>
        )}
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography as="h2" variant="20/bold" className="text-neutral-900">
          تاریخچه
        </Typography>
        {data.timeline.length ? (
          <div className="mt-4 space-y-3">
            {data.timeline.map((event) => (
              <div key={event.id} className="rounded-lg border border-neutral-100 p-3">
                <Typography variant="16/regular" className="text-neutral-800">
                  {event.title}
                </Typography>
                {event.description && (
                  <Typography variant="14/regular" className="mt-1 text-neutral-600">
                    {event.description}
                  </Typography>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Typography variant="14/regular" className="mt-4 text-neutral-500">
            هنوز رویدادی ثبت نشده است.
          </Typography>
        )}
      </section>
    </main>
  )
}

function requestStatusLabel(status: string): string {
  return (
    {
      draft: 'پیش‌نویس',
      in_review: 'در حال بررسی',
      action_needed: 'نیازمند اصلاح',
      approved: 'تایید شده',
      rejected: 'رد شده',
    }[status] ?? status
  )
}
