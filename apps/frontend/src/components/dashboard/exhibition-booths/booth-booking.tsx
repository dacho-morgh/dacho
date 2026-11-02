'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { InfoCircleIcon } from '@/components/icons/generated'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Typography } from '@/components/ui/typography'
import {
  boothReceiptFileUrl,
  formatDate,
  formatToman,
  getExhibitionCatalogue,
  listMyBoothReservations,
  parsePersianNumber,
  reserveBooth,
  uploadBoothReceipt,
  type BoothDto,
  type BoothReservationDto,
  type ExhibitionCatalogueDto,
} from '@/utilities/dashboard-api'
import { BoothRequestStageBadge, boothFailure, receiptStatusLabel } from './booth-status'

export interface BoothExhibitionInfo {
  id: string
  title: string
  dates?: string | null
  location?: string | null
}

/** FE25 + FE27 (basic): a company requests booths and pays each one with its own receipt. */
export function BoothBooking({ exhibition }: { exhibition: BoothExhibitionInfo }) {
  const [catalogue, setCatalogue] = useState<ExhibitionCatalogueDto | null>(null)
  const [requests, setRequests] = useState<BoothReservationDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [reservingId, setReservingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [nextCatalogue, mine] = await Promise.all([
        getExhibitionCatalogue(exhibition.id),
        listMyBoothReservations(exhibition.id),
      ])
      setCatalogue(nextCatalogue)
      setRequests(mine.items)
    } catch (error) {
      setLoadError(boothFailure(error, 'دریافت غرفه‌ها ممکن نشد. دوباره تلاش کنید.'))
    } finally {
      setLoading(false)
    }
  }, [exhibition.id])

  useEffect(() => {
    void load()
  }, [load])

  const activeRequests = requests.filter((item) => item.active)
  const limit = catalogue?.companyBoothLimit ?? null
  const limitReached = limit !== null && activeRequests.length >= limit
  const requestedBoothIds = new Set(activeRequests.map((item) => item.boothId))

  async function requestBooth(booth: BoothDto) {
    if (reservingId) return
    setReservingId(booth.id)
    setNotice(null)
    try {
      await reserveBooth(exhibition.id, booth.id)
      setNotice({ tone: 'success', text: `درخواست غرفه ${booth.identifier} ثبت شد و در انتظار تأیید حضور است.` })
    } catch (error) {
      setNotice({ tone: 'error', text: boothFailure(error, 'ثبت درخواست غرفه ممکن نشد.') })
    } finally {
      setReservingId(null)
      await load()
    }
  }

  return (
    <div dir="rtl" className="flex w-full max-w-[1140px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Typography as="h1" variant="24/bold" color="neutral-800">
          رزرو غرفه · {exhibition.title}
        </Typography>
        {(exhibition.dates || exhibition.location) && (
          <Typography variant="14/regular" color="neutral-500">
            {[exhibition.dates, exhibition.location].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </header>

      <div className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-4">
        <InfoCircleIcon className="size-6 shrink-0 text-brand-500" />
        <Typography variant="14/regular" color="neutral-600">
          هر غرفه درخواست، مبلغ و فیش جداگانه دارد. رزرو تا تصمیم دبیرخانه برقرار می‌ماند و مهلت خودکار ندارد.
          بارگذاری فیش پس از تأیید حضور ممکن است.
          {limit !== null && ` سقف غرفه برای هر شرکت: ${limit.toLocaleString('fa-IR')}.`}
        </Typography>
      </div>

      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={
            notice.tone === 'error'
              ? 'rounded-xl border border-error-200 bg-error-50 p-4'
              : 'rounded-xl bg-success-50 p-4'
          }
        >
          <Typography variant="14/regular" color={notice.tone === 'error' ? 'error' : 'success'}>
            {notice.text}
          </Typography>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : loadError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-neutral-200 bg-white p-6">
          <Typography variant="16/regular" color="neutral-700">
            {loadError}
          </Typography>
          <Button size="40" variant="outline-gray" onClick={() => void load()}>
            تلاش دوباره
          </Button>
        </div>
      ) : (
        <>
          <section aria-labelledby="my-booth-requests" className="flex flex-col gap-3">
            <Typography as="h2" id="my-booth-requests" variant="20/bold" color="neutral-800">
              درخواست‌های غرفه من
            </Typography>
            {requests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-6">
                <Typography variant="14/regular" color="neutral-500">
                  هنوز غرفه‌ای درخواست نکرده‌اید. از فهرست زیر غرفه موردنظر را انتخاب کنید.
                </Typography>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {requests.map((item) => (
                  <li key={item.id}>
                    <BoothRequestCard exhibitionId={exhibition.id} request={item} onChanged={load} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="booth-catalogue" className="flex flex-col gap-3">
            <Typography as="h2" id="booth-catalogue" variant="20/bold" color="neutral-800">
              غرفه‌های نمایشگاه
            </Typography>
            {!catalogue || catalogue.booths.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-6">
                <Typography variant="14/regular" color="neutral-500">
                  هنوز غرفه‌ای برای این نمایشگاه تعریف نشده است.
                </Typography>
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>شناسه</TableHead>
                      <TableHead>مشخصات</TableHead>
                      <TableHead>موقعیت</TableHead>
                      <TableHead>قیمت</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead className="text-end">اقدام</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalogue.booths.map((booth) => {
                      const mine = requestedBoothIds.has(booth.id)
                      const disabled = !booth.available || mine || limitReached || reservingId !== null
                      return (
                        <TableRow key={booth.id}>
                          <TableCell>
                            <Typography variant="14/semibold" color="neutral-800">
                              {booth.identifier}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="14/regular" color="neutral-600">
                              {booth.specification}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="14/regular" color="neutral-600">
                              {booth.location || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="14/semibold" color="neutral-800">
                              {formatToman(booth.priceAmount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="14/regular" color={booth.available ? 'success' : 'neutral-400'}>
                              {mine ? 'درخواست شما' : booth.available ? 'آزاد' : 'رزرو شده'}
                            </Typography>
                          </TableCell>
                          <TableCell className="text-end">
                            <Button
                              size="36"
                              variant="primary"
                              disabled={disabled}
                              onClick={() => void requestBooth(booth)}
                              aria-label={`درخواست غرفه ${booth.identifier}`}
                            >
                              {reservingId === booth.id ? 'در حال ثبت…' : 'درخواست غرفه'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {limitReached && (
              <Typography variant="14/regular" color="neutral-500">
                به سقف غرفه برای هر شرکت رسیده‌اید.
              </Typography>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function BoothRequestCard({
  exhibitionId,
  request,
  onChanged,
}: {
  exhibitionId: string
  request: BoothReservationDto
  onChanged: () => Promise<void>
}) {
  const receipt = request.latestReceipt ?? null
  const canUpload = request.allowedActions.includes('submit_receipt')

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Typography variant="16/bold" color="neutral-800">
            غرفه {request.boothIdentifier ?? '—'}
          </Typography>
          <Typography variant="14/regular" color="neutral-500">
            مبلغ {formatToman(request.priceAmount)} · ثبت {formatDate(request.createdAt)}
          </Typography>
        </div>
        <BoothRequestStageBadge reservation={request} />
      </div>

      {request.attendanceStatus === 'rejected' && request.attendanceReason && (
        <Typography variant="14/regular" color="error">
          دلیل رد حضور: {request.attendanceReason}
        </Typography>
      )}

      {receipt && (
        <div className="flex flex-col gap-1 rounded-lg bg-neutral-50 p-3">
          <Typography variant="14/semibold" color="neutral-700">
            فیش نسخه {receipt.version.toLocaleString('fa-IR')} · {receiptStatusLabel[receipt.status]}
          </Typography>
          {receipt.status === 'returned' && receipt.decisionReason && (
            <Typography variant="14/regular" color="error">
              دلیل برگشت: {receipt.decisionReason}
            </Typography>
          )}
          {receipt.files.map((file) => (
            <a
              key={file.id}
              href={boothReceiptFileUrl(exhibitionId, request.id, file.id)}
              className="w-fit text-brand-500 underline-offset-4 hover:underline"
            >
              <Typography as="span" variant="14/regular" color="primary">
                {file.filename}
              </Typography>
            </a>
          ))}
        </div>
      )}

      {canUpload && (
        <ReceiptUploadForm exhibitionId={exhibitionId} request={request} onUploaded={onChanged} />
      )}
    </article>
  )
}

function ReceiptUploadForm({
  exhibitionId,
  request,
  onUploaded,
}: {
  exhibitionId: string
  request: BoothReservationDto
  onUploaded: () => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [trackingCode, setTrackingCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = `receipt-${request.id}`

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    if (!file) {
      setError('فایل فیش را انتخاب کنید.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await uploadBoothReceipt(exhibitionId, request.id, {
        file,
        trackingCode: trackingCode.trim() || undefined,
        amountToman: request.priceAmount,
      })
      await onUploaded()
    } catch (uploadError) {
      setError(boothFailure(uploadError, 'بارگذاری فیش ممکن نشد. دوباره تلاش کنید.'))
      // A stale view (receipt already pending or confirmed) refreshes the card.
      await onUploaded()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-neutral-100 pt-4" noValidate>
      <Typography variant="14/semibold" color="neutral-700">
        {request.paymentStatus === 'returned' ? 'بارگذاری فیش اصلاح‌شده' : 'بارگذاری فیش پرداخت'} (
        {formatToman(request.priceAmount)})
      </Typography>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label htmlFor={inputId} className="flex flex-1 flex-col gap-1">
          <Typography as="span" variant="12/regular" color="neutral-500">
            فایل فیش (PDF یا Word، حداکثر ۱۰ مگابایت)
          </Typography>
          <input
            id={inputId}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full rounded-[10px] border border-neutral-200 bg-white p-2 text-sm text-neutral-600 file:me-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1 file:text-neutral-700"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <Typography as="span" variant="12/regular" color="neutral-500">
            کد پیگیری (اختیاری)
          </Typography>
          <Input
            value={trackingCode}
            onChange={(event) => setTrackingCode(parsePersianDigits(event.target.value))}
            inputMode="numeric"
          />
        </label>
        <Button type="submit" size="40" variant="primary" disabled={submitting}>
          {submitting ? 'در حال بارگذاری…' : 'ثبت فیش'}
        </Button>
      </div>
      {error && (
        <Typography role="alert" variant="14/regular" color="error">
          {error}
        </Typography>
      )}
    </form>
  )
}

/** Tracking codes are stored with ASCII digits so duplicates match across keyboards. */
function parsePersianDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String(parsePersianNumber(digit)))
}
