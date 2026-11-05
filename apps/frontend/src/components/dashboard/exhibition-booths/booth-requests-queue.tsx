'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  boothReceiptFileUrl,
  decideBoothAttendance,
  decideBoothReceipt,
  formatDate,
  formatToman,
  listBoothRequests,
  type BoothReservationDto,
} from '@/utilities/dashboard-api'
import { BoothPageHeader } from './booth-page-header'
import { BoothRequestStageBadge, boothFailure, receiptStatusLabel } from './booth-status'
import type { BoothExhibitionInfo } from './booth-booking'
import { FieldError } from '@/components/ui/field'
import { toast } from 'sonner'

type QueueFilter = 'all' | 'attendance' | 'receipt' | 'done'

const filters: { key: QueueFilter; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'attendance', label: 'تأیید حضور' },
  { key: 'receipt', label: 'بررسی فیش' },
  { key: 'done', label: 'بسته‌شده' },
]

function matchesFilter(item: BoothReservationDto, filter: QueueFilter): boolean {
  if (filter === 'attendance') return item.attendanceStatus === 'pending' && item.active
  if (filter === 'receipt') return item.paymentStatus === 'pending_verification' && item.active
  if (filter === 'done')
    return item.attendanceStatus === 'rejected' || item.paymentStatus === 'confirmed'
  return true
}

type PendingDecision =
  | { kind: 'reject_attendance'; reservationId: string }
  | { kind: 'return_receipt'; reservationId: string; receiptId: string }

/** FE26 + FE27 (basic): Secretariat decides attendance, then each booth's receipt. */
export function BoothRequestsQueue({ exhibition }: { exhibition: BoothExhibitionInfo }) {
  const [items, setItems] = useState<BoothReservationDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [reasonFor, setReasonFor] = useState<PendingDecision | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const result = await listBoothRequests(exhibition.id)
      setItems(result.items)
    } catch (error) {
      setLoadError(boothFailure(error, 'دریافت درخواست‌های غرفه ممکن نشد.'))
    } finally {
      setLoading(false)
    }
  }, [exhibition.id])

  useEffect(() => {
    void load()
  }, [load])

  async function run(reservationId: string, action: () => Promise<unknown>, success: string) {
    if (busyId) return
    setBusyId(reservationId)
    setNotice(null)
    try {
      await action()
      toast.success(success)
      setReasonFor(null)
      setReason('')
    } catch (error) {
      toast.error('ثبت تصمیم انجام نشد.')
      setNotice({
        tone: 'error',
        text: boothFailure(error, 'ثبت تصمیم ممکن نشد. دوباره تلاش کنید.'),
      })
    } finally {
      setBusyId(null)
      await load()
    }
  }

  function submitReason(decision: PendingDecision) {
    const text = reason.trim()
    if (!text) {
      setReasonError('نوشتن دلیل الزامی است.')
      return
    }
    if (decision.kind === 'reject_attendance') {
      void run(
        decision.reservationId,
        () =>
          decideBoothAttendance(exhibition.id, decision.reservationId, {
            action: 'reject',
            reason: text,
          }),
        'حضور رد شد و غرفه آزاد شد.',
      )
    } else {
      void run(
        decision.reservationId,
        () =>
          decideBoothReceipt(exhibition.id, decision.reservationId, {
            action: 'return',
            receiptId: decision.receiptId,
            reason: text,
          }),
        'فیش برای اصلاح به شرکت برگشت داده شد. رزرو غرفه حفظ شده است.',
      )
    }
  }

  const visible = items.filter((item) => matchesFilter(item, filter))
  const waiting = items.filter(
    (item) => matchesFilter(item, 'attendance') || matchesFilter(item, 'receipt'),
  ).length

  return (
    <div dir="rtl" className="flex w-full max-w-[1140px] flex-col gap-5">
      <BoothPageHeader
        title="درخواست‌های غرفه"
        crumb={exhibition.title}
        summaryTitle={`${waiting.toLocaleString('fa-IR')} درخواست در انتظار اقدام`}
        summary={
          <>
            {[exhibition.dates, exhibition.location].filter(Boolean).join(' · ')}
            {exhibition.dates || exhibition.location ? '. ' : ''}
            حضور هر غرفه پیش از پرداخت تأیید می‌شود و فیش هر غرفه جداگانه بررسی می‌شود.
          </>
        }
      />

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

      <section
        aria-labelledby="booth-requests"
        className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-background p-5"
      >
        <Typography as="h2" id="booth-requests" variant="20/bold" color="neutral-800">
          درخواست‌های غرفه
        </Typography>
        <div role="tablist" aria-label="فیلتر درخواست‌ها" className="flex flex-wrap gap-2">
          {filters.map((option) => {
            const count = items.filter((item) => matchesFilter(item, option.key)).length
            return (
              <Button
                key={option.key}
                role="tab"
                aria-selected={filter === option.key}
                size="36"
                variant={filter === option.key ? 'primary' : 'outline-gray'}
                onClick={() => setFilter(option.key)}
              >
                {option.label} ({count.toLocaleString('fa-IR')})
              </Button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-col items-start gap-3 py-2">
            <Typography variant="16/regular" color="neutral-700">
              {loadError}
            </Typography>
            <Button size="40" variant="outline-gray" onClick={() => void load()}>
              تلاش دوباره
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-2">
            <Typography variant="14/regular" color="neutral-500">
              درخواستی در این بخش نیست.
            </Typography>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {visible.map((item) => {
              const receipt = item.latestReceipt ?? null
              const busy = busyId === item.id
              const canDecideAttendance = item.allowedActions.includes('approve')
              const canDecideReceipt =
                item.allowedActions.includes('verify_receipt') &&
                receipt?.status === 'pending_verification'
              const askingReason = reasonFor?.reservationId === item.id
              return (
                <li key={item.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <Typography variant="16/bold" color="neutral-800">
                        {item.companyName ?? 'شرکت'} · غرفه {item.boothIdentifier ?? '—'}
                      </Typography>
                      <Typography variant="14/regular" color="neutral-500">
                        مبلغ {formatToman(item.priceAmount)} · درخواست {formatDate(item.createdAt)}
                      </Typography>
                    </div>
                    <BoothRequestStageBadge reservation={item} />
                  </div>

                  {item.attendanceStatus === 'rejected' && item.attendanceReason && (
                    <Typography variant="14/regular" color="neutral-600">
                      دلیل رد حضور: {item.attendanceReason}
                    </Typography>
                  )}

                  {receipt && (
                    <div className="flex flex-col gap-1 rounded-lg bg-neutral-50 p-3">
                      <Typography variant="14/semibold" color="neutral-700">
                        فیش نسخه {receipt.version.toLocaleString('fa-IR')} ·{' '}
                        {receiptStatusLabel[receipt.status]}
                        {receipt.trackingCode ? ` · کد پیگیری ${receipt.trackingCode}` : ''}
                        {receipt.amountToman !== null
                          ? ` · ${formatToman(receipt.amountToman)}`
                          : ''}
                      </Typography>
                      {receipt.status === 'returned' && receipt.decisionReason && (
                        <Typography variant="14/regular" color="neutral-600">
                          دلیل برگشت: {receipt.decisionReason}
                        </Typography>
                      )}
                      {receipt.files.map((file) => (
                        <a
                          key={file.id}
                          href={boothReceiptFileUrl(exhibition.id, item.id, file.id)}
                          className="w-fit underline-offset-4 hover:underline"
                        >
                          <Typography as="span" variant="14/regular" color="primary">
                            {file.filename}
                          </Typography>
                        </a>
                      ))}
                    </div>
                  )}

                  {(canDecideAttendance || canDecideReceipt) && !askingReason && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {canDecideAttendance && (
                        <>
                          <Button
                            size="36"
                            variant="outline-gray"
                            disabled={busy}
                            onClick={() => {
                              setReason('')
                              setReasonFor({ kind: 'reject_attendance', reservationId: item.id })
                            }}
                          >
                            رد حضور
                          </Button>
                          <Button
                            size="36"
                            variant="primary"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                item.id,
                                () =>
                                  decideBoothAttendance(exhibition.id, item.id, {
                                    action: 'approve',
                                  }),
                                'حضور تأیید شد. شرکت اکنون می‌تواند فیش را بارگذاری کند.',
                              )
                            }
                          >
                            تأیید حضور
                          </Button>
                        </>
                      )}
                      {canDecideReceipt && receipt && (
                        <>
                          <Button
                            size="36"
                            variant="outline-gray"
                            disabled={busy}
                            onClick={() => {
                              setReason('')
                              setReasonFor({
                                kind: 'return_receipt',
                                reservationId: item.id,
                                receiptId: receipt.id,
                              })
                            }}
                          >
                            برگشت فیش
                          </Button>
                          <Button
                            size="36"
                            variant="primary"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                item.id,
                                () =>
                                  decideBoothReceipt(exhibition.id, item.id, {
                                    action: 'confirm',
                                    receiptId: receipt.id,
                                  }),
                                'پرداخت غرفه تأیید شد.',
                              )
                            }
                          >
                            تأیید فیش
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {askingReason && reasonFor && (
                    <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
                      <label htmlFor={`reason-${item.id}`}>
                        <Typography as="span" variant="14/semibold" color="neutral-700">
                          {reasonFor.kind === 'reject_attendance'
                            ? 'دلیل رد حضور'
                            : 'دلیل برگشت فیش'}
                        </Typography>
                      </label>
                      <Textarea
                        id={`reason-${item.id}`}
                        value={reason}
                        onChange={(event) => {
                          setReason(event.target.value)
                          setReasonError(null)
                        }}
                        rows={3}
                        aria-invalid={reasonError ? true : undefined}
                        aria-describedby={reasonError ? `reason-${item.id}-error` : undefined}
                      />
                      <FieldError id={`reason-${item.id}-error`}>{reasonError}</FieldError>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="36"
                          variant="text-gray"
                          disabled={busy}
                          onClick={() => setReasonFor(null)}
                        >
                          انصراف
                        </Button>
                        <Button
                          size="36"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => submitReason(reasonFor)}
                        >
                          {reasonFor.kind === 'reject_attendance' ? 'ثبت رد حضور' : 'ثبت برگشت فیش'}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
