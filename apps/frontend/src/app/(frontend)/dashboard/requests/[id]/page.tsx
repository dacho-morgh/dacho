import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { AdminRequestDetail } from '@/components/dashboard/admin-request-detail'
import { OfflineNotice } from '@/components/dashboard/offline-notice'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Typography } from '@/components/ui/typography'
import {
  canDeleteDocuments,
  canUploadDocuments,
  formatDate,
  type CompanySupplementaryRequestDto,
  type PublishedResultDto,
  type RequestDetail,
} from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { isInternalDashboardUser, serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

const NEXT_ACTION_LABELS: Record<string, string> = {
  submit: 'ثبت/ارسال نهایی درخواست',
  uploadDocument: 'بارگذاری مدارک خواسته‌شده',
  deleteDocument: 'حذف و جایگزینی مدرک',
  read: 'مشاهده؛ اقدام فعالی برای شما ثبت نشده است',
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const isInternal = isInternalDashboardUser(user)

  if (isInternal) {
    return <AdminRequestDetail id={id} />
  }

  const result = await serverDashboardFetchResult<RequestDetail>(
    `/requests/${encodeURIComponent(id)}`,
  )
  if (result.kind !== 'ok') {
    const notice = unavailableReasonFor(result)
    // A failed read is not a missing case: only a genuine 404 renders notFound.
    if (result.kind === 'unavailable' && result.status === 404) notFound()
    return (
      <main className="mx-auto w-full max-w-4xl p-6 sm:p-10" dir="rtl">
        <OfflineNotice
          reason={notice ?? 'unavailable'}
          retryHref={`/dashboard/requests/${encodeURIComponent(id)}`}
        />
      </main>
    )
  }
  const data = result.data
  const [publishedResult, supplementary] = await Promise.all([
    serverDashboardFetchResult<{ result: PublishedResultDto | null }>(
      `/requests/${encodeURIComponent(id)}/result`,
    ),
    serverDashboardFetchResult<{ items: CompanySupplementaryRequestDto[] }>(
      `/requests/${encodeURIComponent(id)}/supplementary-requests`,
    ),
  ])
  const canUpload = canUploadDocuments(data.request)
  const canDelete = canDeleteDocuments(data.request)
  // The chief's advancement opens the financial files and closes the proposal.
  const financialStageOpen = data.request.reviewStage === 'advanced'

  const allowedActions = data.request.allowedActions ?? []
  const nextAction =
    allowedActions.find((action) => action !== 'read') ??
    (allowedActions.length ? 'read' : undefined)

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-10" dir="rtl">
      <Typography as="h1" variant="24/bold" className="text-neutral-900">
        {data.request.title}
      </Typography>
      <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-3">
        <Field label="کد پیگیری" value={data.request.trackingCode} mono />
        <Field label="وضعیت" value={requestStatusLabel(data.request.status)} />
        <Field label="گام جاری" value={data.request.currentStep || 'ثبت نشده'} />
        <Field
          label="اقدام بعدی شما"
          value={
            nextAction
              ? (NEXT_ACTION_LABELS[nextAction] ?? nextAction)
              : 'اقدامی برای شما تعریف نشده است'
          }
        />
        <Field label="تاریخ ثبت" value={formatDate(data.request.submissionDate) || 'ثبت نشده'} />
        <Field label="آخرین به‌روزرسانی" value={formatDate(data.request.updatedAt)} />
      </div>
      {publishedResult.kind !== 'ok' ? (
        <Typography role="alert" variant="14/regular" color="error">
          دریافت نتیجه پرونده انجام نشد. صفحه را دوباره بارگذاری کنید.
        </Typography>
      ) : publishedResult.data.result ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-brand-600 bg-white p-6">
          <Typography as="h2" variant="20/bold" className="text-neutral-900">
            نتیجه پرونده
          </Typography>
          <Typography variant="12/regular" className="text-neutral-500">
            تاریخ انتشار: {formatDate(publishedResult.data.result.publishedAt)}
          </Typography>
          <Typography variant="16/regular" className="whitespace-pre-wrap text-neutral-800">
            {publishedResult.data.result.body}
          </Typography>
        </section>
      ) : null}
      {supplementary.kind !== 'ok' ? (
        <Typography role="alert" variant="14/regular" color="error">
          دریافت درخواست‌های دبیرخانه انجام نشد. صفحه را دوباره بارگذاری کنید.
        </Typography>
      ) : supplementary.data.items.length ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
          <Typography as="h2" variant="20/bold" className="text-neutral-900">
            مدارک تکمیلی درخواست‌شده
          </Typography>
          <ul className="flex flex-col gap-2">
            {supplementary.data.items.map((item) => (
              <li key={item.id} className="rounded-lg bg-neutral-50 p-3">
                <Typography variant="12/regular" className="text-neutral-500">
                  {formatDate(item.createdAt)}
                </Typography>
                <Typography variant="14/regular" className="mt-1 whitespace-pre-wrap text-neutral-800">
                  {item.body}
                </Typography>
              </li>
            ))}
          </ul>
          <PrivateDocumentField
            category="correspondenceAttachment"
            label="ارسال مدارک تکمیلی به دبیرخانه"
            requestId={data.request.id}
            canUpload
          />
        </section>
      ) : null}
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
            canUpload={canUpload && !financialStageOpen}
            canDelete={canDelete && !financialStageOpen}
          />
          {(
            [
              ['financialStatements', 'صورت‌های مالی'],
              ['debtFacilityEvidence', 'بدهی‌ها و تسهیلات'],
              ['taxInsuranceRecords', 'اظهارنامه مالیاتی و بیمه'],
              ['contractsOrdersMousCommitments', 'قراردادها و تعهدات'],
              ['projectEstimateUseOfFunds', 'برآورد و مصرف منابع'],
              ['guaranteeCollateral', 'تضامین و وثایق'],
            ] as const
          ).map(([category, label]) => (
            <PrivateDocumentField
              key={category}
              category={category}
              label={label}
              requestId={data.request.id}
              canUpload={canUpload && financialStageOpen}
              canDelete={canDelete}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography as="h2" variant="20/bold" className="text-neutral-900">
          روند بررسی
        </Typography>
        {data.workflow.length ? (
          <ol className="mt-4 space-y-3">
            {data.workflow.map((step) => {
              const isCurrent = step.title === data.request.currentStep
              return (
                <li
                  key={`${step.order}-${step.title}`}
                  className={`rounded-lg p-3 ${isCurrent ? 'bg-brand-50 text-brand-700' : 'bg-neutral-50'}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <Typography
                    variant="16/regular"
                    className={isCurrent ? 'text-brand-700' : 'text-neutral-800'}
                  >
                    {step.order}. {step.title}
                    {step.roleName ? ` · ${step.roleName}` : ''}
                  </Typography>
                </li>
              )
            })}
          </ol>
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
          <ol className="mt-4 space-y-3">
            {data.timeline.map((event) => (
              <li key={event.id} className="rounded-lg border border-neutral-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Typography variant="16/regular" className="text-neutral-800">
                    {event.title}
                  </Typography>
                  <Typography variant="12/regular" className="font-mono text-neutral-400">
                    {formatDate(event.at)}
                  </Typography>
                </div>
                {event.description && (
                  <Typography variant="14/regular" className="mt-1 text-neutral-600">
                    {event.description}
                  </Typography>
                )}
                <Typography variant="12/regular" className="mt-1 text-neutral-400">
                  نوع رویداد: {event.type}
                </Typography>
              </li>
            ))}
          </ol>
        ) : (
          <Typography variant="14/regular" className="mt-4 text-neutral-500">
            هنوز رویدادی ثبت نشده است.
          </Typography>
        )}
      </section>
    </main>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-3">
      <Typography variant="12/regular" className="text-neutral-500">
        {label}
      </Typography>
      <Typography
        variant="16/regular"
        className={`mt-1 text-neutral-800 ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </Typography>
    </div>
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
