import Image from 'next/image'

import { ReadonlyField } from '@/components/dashboard/company-detail/company-detail-parts'
import { DownloadRow } from '@/components/dashboard/download-row'
import { EventMeta, EventStatusTag, type EventItem } from '@/components/dashboard/events-view'
import { PrivateDocumentDownload } from '@/components/documents/private-document-download'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  getRequestRfpFileUrl,
  type RfpFileDto,
} from '@/utilities/dashboard-api'
import type { RequestEventInfo } from '@/utilities/dashboard-api/requests'
import { formatEventDateRange } from '@/utilities/event-dates'

const STATUS: Record<NonNullable<RequestEventInfo['status']>, { badgeType: EventItem['badgeType']; text: string }> = {
  past: { badgeType: 'ended', text: 'تمام شده' },
  ongoing: { badgeType: 'active', text: 'در حال برگزاری' },
  upcoming: { badgeType: 'upcoming', text: 'پیش‌رو' },
}

const card = 'flex min-w-0 flex-col gap-6 rounded-[16px] border border-neutral-200 bg-background p-4'

/** A title or subtitle drawn as a read-only box: a small grey label over its value (Figma 32315:43077). */
function ValueBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-[8px] border border-neutral-100 p-2">
      <Typography as="span" variant="14/semibold" color="neutral-400">
        {label}
      </Typography>
      <Typography as="span" variant="16/semibold" color="neutral-600" className="break-words">
        {value}
      </Typography>
    </div>
  )
}

/**
 * The event application as the Figma request page draws it (32314:41509): the event, the chosen title and subtitle
 * with the RFP and the submitted proposal to download, and the applicant's notes.
 */
export function EventApplicationCards({
  requestId,
  event,
  rfpFiles,
  notes,
  submittedProposals,
  variant = 'cards',
}: {
  requestId: string
  event: RequestEventInfo
  rfpFiles: RfpFileDto[]
  /** What the applicant wrote in «توضیحات», or an empty string. */
  notes: string
  /** The proposal files pinned when the application was sent; empty for a draft. */
  submittedProposals: Array<{ id: string; filename: string }>
  /** `chief`: the single «اطلاعات و فرم رویداد» card of the chief's page (Figma 31885:6801), not the applicant's cards. */
  variant?: 'cards' | 'chief'
}) {
  const status = event.status ? STATUS[event.status] : null
  if (variant === 'chief') {
    return (
      <section aria-labelledby="request-event-info-heading" className={card}>
        <Typography as="h2" id="request-event-info-heading" variant="20/extrabold" color="neutral-800">
          اطلاعات و فرم رویداد
        </Typography>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadonlyField label="رویداد" value={event.title} />
          <ReadonlyField label="تاریخ برگزاری" value={formatEventDateRange(event.startDate, event.endDate)} />
          <ReadonlyField label="عنوان" value={event.category?.title ?? ''} />
          <ReadonlyField label="زیر عنوان" value={event.subtopic?.title ?? ''} />
          {status ? <ReadonlyField label="وضعیت رویداد" value={status.text} /> : null}
          <ReadonlyField label="محل برگزاری" value={event.location ?? ''} />
          {rfpFiles.map((file, position) => (
            <DownloadRow
              key={file.id}
              label={rfpFiles.length > 1 ? `فایل RFP ${position + 1}` : 'فایل RFP'}
              href={getRequestRfpFileUrl(requestId, file.id)}
              filename={file.filename}
            />
          ))}
          {submittedProposals.map((file, position) => (
            <div key={file.id} className="flex min-w-0 items-center justify-between gap-3">
              <Typography as="span" variant="16/semibold" color="neutral-700">
                {submittedProposals.length > 1 ? `پروپوزال ارسالی ${position + 1}` : 'پروپوزال ارسالی'}
              </Typography>
              <PrivateDocumentDownload documentId={file.id} filename={file.filename} emphasis="primary" />
            </div>
          ))}
          <div className="md:col-span-2">
            <ReadonlyField label="توضیحات" value={notes} />
          </div>
        </div>
      </section>
    )
  }
  return (
    <>
      <section aria-label="رویداد" className={card}>
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <div className="relative size-[160px] shrink-0 self-center overflow-hidden rounded-[8px] bg-neutral-100 sm:size-[200px]">
            {event.image ? (
              <Image src={event.image.url} alt={event.image.alt ?? event.title} fill className="object-cover" sizes="200px" />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <div className="flex flex-col items-start gap-4">
              {status ? <EventStatusTag type={status.badgeType}>{status.text}</EventStatusTag> : null}
              <Typography as="h2" variant="20/bold" color="neutral-700">
                {event.title}
              </Typography>
            </div>
            <EventMeta
              dates={formatEventDateRange(event.startDate, event.endDate)}
              location={event.location ?? 'محل برگزاری ثبت نشده است'}
            />
          </div>
        </div>
        {event.description ? (
          <Typography as="p" variant="16/regular" color="neutral-500">
            {event.description}
          </Typography>
        ) : null}
      </section>

      <section aria-labelledby="request-files-heading" className={card}>
        <div className="flex flex-col gap-1">
          <Typography as="h2" id="request-files-heading" variant="20/bold" color="neutral-600">
            عنوان و فایل‌های درخواست پروپوزال
          </Typography>
          <Typography as="p" variant="14/regular" color="neutral-500">
            عنوان و زیر عنوان انتخاب‌شده برای این درخواست و فایل‌های RFP و نمونه فرم پروپوزال.
          </Typography>
        </div>
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 md:grid-cols-2">
          <ValueBox label="عنوان" value={event.category?.title ?? '—'} />
          <ValueBox label="زیر عنوان" value={event.subtopic?.title ?? '—'} />
          {rfpFiles.map((file, position) => (
            <DownloadRow
              key={file.id}
              label={rfpFiles.length > 1 ? `فایل RFP ${position + 1}` : 'فایل RFP'}
              href={getRequestRfpFileUrl(requestId, file.id)}
              filename={file.filename}
            />
          ))}
          {submittedProposals.length > 0 ? (
            submittedProposals.map((file, position) => (
              <div key={file.id} className="flex min-w-0 items-center justify-between gap-3">
                <Typography as="span" variant="16/semibold" color="neutral-700">
                  {submittedProposals.length > 1 ? `پروپوزال ارسالی ${position + 1}` : 'پروپوزال ارسالی'}
                </Typography>
                <PrivateDocumentDownload documentId={file.id} filename={file.filename} emphasis="primary" />
              </div>
            ))
          ) : (
            <div className="flex min-w-0 items-center justify-between gap-3">
              <Typography as="span" variant="16/semibold" color="neutral-700">پروپوزال ارسالی</Typography>
              <Typography as="span" variant="14/regular" color="neutral-500">هنوز ارسال نشده است</Typography>
            </div>
          )}
        </div>
      </section>

      <section aria-label="توضیحات" className={card}>
        <div className="flex flex-col gap-2">
          <Typography as="span" variant="16/semibold" color="neutral-700">
            توضیحات
          </Typography>
          <Textarea readOnly disabled value={notes} placeholder="توضیحاتی ثبت نشده است" className="min-h-[140px]" />
        </div>
      </section>
    </>
  )
}
