'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  fetchCompanyVerification,
  fetchProfileDossier,
  listMyBoothReservations,
  submitCompanyVerification,
  type BoothReservationDto,
  type CompanyVerificationDto,
  type MissingDossierItemsDto,
} from '@/utilities/dashboard-api'
import {
  deriveEligibility,
  describeSubmissionFailure,
  missingSectionLinks,
  participationDestination,
  profileSectionHref,
  type Eligibility,
  type EligibilityState,
  type ParticipationTarget,
} from '@/utilities/participation-eligibility'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'denied'; message: string }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready'
      verification: CompanyVerificationDto
      missing: MissingDossierItemsDto | null
      eligibility: Eligibility
    }

type ReservationState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: BoothReservationDto[] }

const STATE_CHIP: Record<EligibilityState, { label: string; className: string }> = {
  incomplete: { label: 'پرونده شرکت ناقص است', className: 'border-warning-400 bg-warning-50 text-warning-700' },
  ready_to_request: {
    label: 'احراز هویت درخواست نشده',
    className: 'border-brand-200 bg-brand-50 text-brand-700',
  },
  pending: { label: 'در انتظار بررسی دبیرخانه', className: 'border-warning-400 bg-warning-50 text-warning-700' },
  returned: { label: 'بازگشت برای اصلاح', className: 'border-error-200 bg-error-50 text-error-700' },
  rejected: { label: 'احراز هویت رد شده', className: 'border-error-200 bg-error-50 text-error-700' },
  approved: { label: 'احراز هویت تأیید شده', className: 'border-success-500 bg-success-50 text-success-700' },
}

function stateDescription(state: EligibilityState, target: ParticipationTarget): string {
  const place = target.kind === 'event' ? 'این رویداد' : 'این نمایشگاه'
  switch (state) {
    case 'incomplete':
      return `برای شرکت در ${place} ابتدا شرکت شما باید احراز هویت شود. موارد الزامی زیر در پرونده شرکت تکمیل نشده است؛ هر پیوند شما را به همان بخش پروفایل می‌برد و پس از تکمیل می‌توانید به همین ثبت‌نام بازگردید.`
    case 'ready_to_request':
      return `پرونده شرکت کامل است، اما درخواست احراز هویت هنوز ارسال نشده است. ثبت‌نام در ${place} پس از تأیید دبیرخانه فعال می‌شود.`
    case 'pending':
      return `درخواست احراز هویت شرکت شما در حال بررسی دبیرخانه است. تا زمان تأیید، امکان ارسال درخواست در ${place} وجود ندارد؛ انتخاب‌های شما در این صفحه حفظ می‌شود.`
    case 'returned':
      return 'دبیرخانه پرونده شرکت را برای اصلاح بازگردانده است. موارد خواسته‌شده را اصلاح کنید و درخواست احراز هویت را دوباره ارسال کنید.'
    case 'rejected':
      return `احراز هویت شرکت رد شده است و تا تأیید دوباره، ثبت درخواست در ${place} امکان‌پذیر نیست.`
    case 'approved':
      return target.kind === 'event'
        ? 'شرکت شما احراز هویت شده است و می‌توانید برای زیرعنوان‌های این رویداد درخواست ثبت کنید. تأیید احراز هویت به معنی پذیرش پروپوزال نیست؛ هر زیرعنوان جداگانه داوری می‌شود.'
        : 'شرکت شما احراز هویت شده است و می‌توانید درخواست غرفه ثبت کنید. تأیید حضور در نمایشگاه و اجازه پرداخت جداگانه و برای هر غرفه تعیین می‌شود.'
  }
}

function describeLoadFailure(cause: unknown): LoadState {
  if (cause instanceof TypeError) {
    return { kind: 'error', message: 'ارتباط با سرور برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.' }
  }
  if (cause instanceof DashboardApiError) {
    if (cause.status === 401) {
      return { kind: 'denied', message: 'نشست شما پایان یافته است. برای بررسی شرایط ثبت‌نام دوباره وارد شوید.' }
    }
    if (cause.status === 403) {
      return {
        kind: 'denied',
        message: 'ثبت‌نام در رویدادها و نمایشگاه‌ها فقط برای نماینده یک شرکت ثبت‌شده امکان‌پذیر است.',
      }
    }
    if (cause.status === 404) {
      return {
        kind: 'denied',
        message: 'برای این حساب شرکتی ثبت نشده است. ابتدا ثبت‌نام شرکت را کامل کنید.',
      }
    }
  }
  return { kind: 'error', message: 'بررسی وضعیت احراز هویت شرکت انجام نشد. دوباره تلاش کنید.' }
}

const ATTENDANCE_LABEL: Record<BoothReservationDto['attendanceStatus'], string> = {
  pending: 'در انتظار تأیید حضور',
  approved: 'حضور تأیید شده',
  rejected: 'حضور رد شده',
}

export interface ParticipationEligibilityPanelProps {
  target: ParticipationTarget
  /** Where the profile pages should send the representative back to; defaults to the target page. */
  returnTo?: string
  /** Increment to force a fresh server read (e.g. after a submit was denied). */
  refreshKey?: number
  onEligibilityChange?: (eligibility: Eligibility | null) => void
}

export function ParticipationEligibilityPanel({
  target,
  returnTo,
  refreshKey = 0,
  onEligibilityChange,
}: ParticipationEligibilityPanelProps) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [reservations, setReservations] = useState<ReservationState>({ kind: 'idle' })
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const sequence = useRef(0)
  const notify = useRef(onEligibilityChange)
  useEffect(() => {
    notify.current = onEligibilityChange
  }, [onEligibilityChange])

  const exhibitionId = target.kind === 'exhibition' ? target.exhibitionId : null
  const destination = returnTo ?? participationDestination(target)

  const refresh = useCallback(async () => {
    const request = ++sequence.current
    setLoad((current) => (current.kind === 'ready' ? current : { kind: 'loading' }))
    const [verification, dossier] = await Promise.allSettled([fetchCompanyVerification(), fetchProfileDossier()])
    // A newer read (or a newer target) owns the panel; never apply an older reply.
    if (request !== sequence.current) return
    if (verification.status === 'rejected') {
      setLoad(describeLoadFailure(verification.reason))
      notify.current?.(null)
      return
    }
    const missing = dossier.status === 'fulfilled' ? (dossier.value?.missing ?? null) : null
    const eligibility = deriveEligibility(verification.value, missing)
    setLoad({ kind: 'ready', verification: verification.value, missing, eligibility })
    notify.current?.(eligibility)

    if (exhibitionId && eligibility.state === 'approved') {
      setReservations({ kind: 'loading' })
      try {
        const result = await listMyBoothReservations(exhibitionId)
        if (request === sequence.current) setReservations({ kind: 'ready', items: result.items ?? [] })
      } catch {
        if (request === sequence.current) {
          setReservations({ kind: 'error', message: 'دریافت وضعیت غرفه‌های رزروشده انجام نشد.' })
        }
      }
    } else {
      setReservations({ kind: 'idle' })
    }
  }, [exhibitionId])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshKey])

  // A representative who completed the profile in another tab sees the new state on return.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const requestVerification = async () => {
    if (requesting) return
    setRequesting(true)
    setRequestError(null)
    try {
      await submitCompanyVerification()
      await refresh()
    } catch (cause) {
      if (cause instanceof DashboardApiError && cause.code === 'incomplete_dossier') {
        setRequestError('پرونده شرکت هنوز کامل نیست. موارد الزامی را تکمیل کنید.')
        await refresh()
      } else if (cause instanceof DashboardApiError && cause.status === 409) {
        setRequestError('وضعیت احراز هویت پیش‌تر تغییر کرده است؛ وضعیت تازه نمایش داده شد.')
        await refresh()
      } else {
        setRequestError(describeSubmissionFailure(cause, 'ارسال درخواست احراز هویت انجام نشد. دوباره تلاش کنید.').message)
      }
    } finally {
      setRequesting(false)
    }
  }

  return (
    <section
      aria-labelledby="participation-eligibility-title"
      aria-busy={load.kind === 'loading'}
      className="flex w-full min-w-0 flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography as="h2" id="participation-eligibility-title" variant="16/bold" color="neutral-700">
          {target.kind === 'event' ? 'شرایط شرکت در رویداد' : 'شرایط حضور در نمایشگاه'}
        </Typography>
        {load.kind === 'ready' ? (
          <Typography
            as="span"
            variant="12/semibold"
            data-testid="eligibility-state"
            data-state={load.eligibility.state}
            className={`rounded-full border px-3 py-1 ${STATE_CHIP[load.eligibility.state].className}`}
          >
            {STATE_CHIP[load.eligibility.state].label}
          </Typography>
        ) : null}
      </div>

      {load.kind === 'loading' ? (
        <div role="status" aria-label="در حال بررسی وضعیت احراز هویت شرکت" className="flex flex-col gap-2">
          <Skeleton className="h-5 w-3/4 rounded-md bg-neutral-100" />
          <Skeleton className="h-5 w-1/2 rounded-md bg-neutral-100" />
        </div>
      ) : null}

      {load.kind === 'denied' ? (
        <Typography role="alert" variant="14/regular" className="text-error-600">
          {load.message}
        </Typography>
      ) : null}

      {load.kind === 'error' ? (
        <div className="flex flex-wrap items-center gap-3">
          <Typography role="alert" variant="14/regular" className="text-error-600">
            {load.message}
          </Typography>
          <Button type="button" variant="outline-gray" size="32" onClick={() => void refresh()}>
            تلاش دوباره
          </Button>
        </div>
      ) : null}

      {load.kind === 'ready' ? (
        <ReadyContent
          load={load}
          target={target}
          destination={destination}
          requesting={requesting}
          requestError={requestError}
          onRequestVerification={requestVerification}
          reservations={reservations}
        />
      ) : null}
    </section>
  )
}

function ReadyContent({
  load,
  target,
  destination,
  requesting,
  requestError,
  onRequestVerification,
  reservations,
}: {
  load: Extract<LoadState, { kind: 'ready' }>
  target: ParticipationTarget
  destination: string
  requesting: boolean
  requestError: string | null
  onRequestVerification: () => void
  reservations: ReservationState
}) {
  const { eligibility, verification, missing } = load
  const links = missingSectionLinks(eligibility.missingRequired, destination)
  const needsProfileWork = eligibility.state === 'incomplete' || eligibility.state === 'returned' || eligibility.state === 'rejected'
  const canRequest =
    verification.canRequestVerification &&
    (eligibility.state === 'ready_to_request' || eligibility.state === 'returned' || eligibility.state === 'rejected')

  return (
    <div className="flex flex-col gap-4">
      <Typography variant="14/regular" color="neutral-600">
        {stateDescription(eligibility.state, target)}
      </Typography>

      {eligibility.reason ? (
        <div className="rounded-xl border border-error-200 bg-error-50 p-3">
          <Typography variant="12/semibold" className="text-error-700">
            توضیح دبیرخانه
          </Typography>
          <Typography variant="14/regular" className="break-words text-error-700">
            {eligibility.reason}
          </Typography>
        </div>
      ) : null}

      {needsProfileWork && links.length > 0 ? (
        <ul aria-label="بخش‌های ناقص پروفایل" className="flex flex-col gap-2">
          {links.map((link) => (
            <li
              key={link.section.key}
              className="flex flex-col gap-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <Typography variant="14/semibold" color="neutral-700">
                  {link.section.title}
                </Typography>
                <Typography variant="12/regular" color="neutral-500" className="break-words">
                  {link.fields.map((field) => field.label).join('، ')}
                </Typography>
              </div>
              <Button asChild variant="outline-gray" size="32" className="self-start sm:self-auto">
                <Link href={link.href}>تکمیل {link.section.title}</Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {needsProfileWork && links.length === 0 && !missing ? (
        <Button asChild variant="outline-gray" size="32" className="self-start">
          <Link href={profileSectionHref('company-verification', destination)}>مشاهده پرونده شرکت</Link>
        </Button>
      ) : null}

      {canRequest ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="primary"
            size="36"
            loading={requesting}
            disabled={requesting}
            onClick={onRequestVerification}
            className="self-start"
          >
            {eligibility.state === 'ready_to_request' ? 'ارسال درخواست احراز هویت' : 'ارسال دوباره برای احراز هویت'}
          </Button>
        </div>
      ) : null}
      {requestError ? (
        <Typography role="alert" variant="14/regular" className="text-error-600">
          {requestError}
        </Typography>
      ) : null}

      <ApprovalSeparation target={target} state={eligibility.state} reservations={reservations} />
    </div>
  )
}

function ApprovalSeparation({
  target,
  state,
  reservations,
}: {
  target: ParticipationTarget
  state: EligibilityState
  reservations: ReservationState
}) {
  const companyLine = state === 'approved' ? 'تأیید شده' : STATE_CHIP[state].label
  return (
    <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
      <Typography variant="14/semibold" color="neutral-700">
        {target.kind === 'event' ? 'مراحل جداگانه تأیید' : 'سه تأیید جداگانه در نمایشگاه'}
      </Typography>
      <dl className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="rounded-xl bg-neutral-50 p-3">
          <dt>
            <Typography variant="12/semibold" color="neutral-600">
              ۱. احراز هویت شرکت
            </Typography>
          </dt>
          <dd>
            <Typography variant="12/regular" color="neutral-500">
              یک بار برای شرکت، توسط دبیرخانه — وضعیت فعلی: {companyLine}
            </Typography>
          </dd>
        </div>
        {target.kind === 'event' ? (
          <>
            <div className="rounded-xl bg-neutral-50 p-3">
              <dt>
                <Typography variant="12/semibold" color="neutral-600">
                  ۲. ارسال پروپوزال برای هر زیرعنوان
                </Typography>
              </dt>
              <dd>
                <Typography variant="12/regular" color="neutral-500">
                  هر زیرعنوان یک پرونده و کد رهگیری مستقل دارد.
                </Typography>
              </dd>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <dt>
                <Typography variant="12/semibold" color="neutral-600">
                  ۳. داوری و تصمیم
                </Typography>
              </dt>
              <dd>
                <Typography variant="12/regular" color="neutral-500">
                  پذیرش پروپوزال جدا از احراز هویت شرکت تعیین می‌شود.
                </Typography>
              </dd>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-neutral-50 p-3">
              <dt>
                <Typography variant="12/semibold" color="neutral-600">
                  ۲. تأیید حضور در نمایشگاه
                </Typography>
              </dt>
              <dd>
                <Typography variant="12/regular" color="neutral-500">
                  برای هر غرفه رزروشده جداگانه و پس از رزرو بررسی می‌شود.
                </Typography>
              </dd>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <dt>
                <Typography variant="12/semibold" color="neutral-600">
                  ۳. اجازه پرداخت
                </Typography>
              </dt>
              <dd>
                <Typography variant="12/regular" color="neutral-500">
                  فقط پس از تأیید حضور همان غرفه، پرداخت و ارسال رسید ممکن می‌شود.
                </Typography>
              </dd>
            </div>
          </>
        )}
      </dl>

      {target.kind === 'exhibition' && state === 'approved' ? (
        <ReservationList reservations={reservations} />
      ) : null}
    </div>
  )
}

function ReservationList({ reservations }: { reservations: ReservationState }) {
  if (reservations.kind === 'idle') return null
  if (reservations.kind === 'loading') {
    return (
      <div role="status" aria-label="در حال دریافت غرفه‌های رزروشده">
        <Skeleton className="h-5 w-1/2 rounded-md bg-neutral-100" />
      </div>
    )
  }
  if (reservations.kind === 'error') {
    return (
      <Typography role="alert" variant="12/regular" className="text-error-600">
        {reservations.message}
      </Typography>
    )
  }
  if (reservations.items.length === 0) {
    return (
      <Typography variant="12/regular" color="neutral-500">
        هنوز غرفه‌ای در این نمایشگاه رزرو نکرده‌اید.
      </Typography>
    )
  }
  return (
    <ul aria-label="غرفه‌های رزروشده" className="flex flex-col gap-2">
      {reservations.items.map((item) => {
        const canPay = item.active && item.allowedActions.includes('submit_receipt')
        return (
          <li
            key={item.id}
            className="flex flex-col gap-1 rounded-xl border border-neutral-100 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <Typography variant="14/semibold" color="neutral-700">
              غرفه {item.boothIdentifier ?? item.boothId}
            </Typography>
            <div className="flex flex-wrap gap-2">
              <Typography as="span" variant="12/regular" className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
                {item.active ? ATTENDANCE_LABEL[item.attendanceStatus] : 'رزرو غیرفعال'}
              </Typography>
              <Typography
                as="span"
                variant="12/regular"
                className={`rounded-full px-2 py-0.5 ${canPay ? 'bg-success-50 text-success-700' : 'bg-neutral-100 text-neutral-500'}`}
              >
                {canPay ? 'مجاز به پرداخت و ارسال رسید' : 'پرداخت هنوز مجاز نیست'}
              </Typography>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
