'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  dossierFieldLabel,
  formatDate,
  groupMissingByLocation,
  type CompanyVerificationDto,
  type MissingDossierItemsDto,
} from '@/utilities/dashboard-api'
import { cn } from '@/utilities/ui'

/** Kept equal to the server's `COMPANY_EDIT_REVERIFICATION_REASON` (T59). */
export const COMPANY_EDIT_REVERIFICATION_REASON = 'ویرایش اطلاعات شرکت؛ نیازمند احراز مجدد'

/** Approval or a pending review is withdrawn by any company edit (T59). */
export function editWithdrawsVerification(status: CompanyVerificationDto['status'] | undefined): boolean {
  return status === 'approved' || status === 'pending'
}

type Tone = 'warning' | 'info' | 'success' | 'error'

const BANNER_TONE: Record<Tone, string> = {
  warning: 'bg-warning-50 text-warning-700',
  info: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-700',
  error: 'bg-error-50 text-error-700',
}

const BLOCKED_NOTE = 'تا تأیید احراز هویت، ثبت درخواست رسمی و رزرو غرفه برای شرکت امکان‌پذیر نیست.'

interface Banner {
  tone: Tone
  title: string
  body: string
}

function bannerFor(verification: CompanyVerificationDto, missing: MissingDossierItemsDto): Banner {
  switch (verification.status) {
    case 'pending':
      return {
        tone: 'info',
        title: 'احراز هویت در حال بررسی است',
        body: 'درخواست احراز هویت شما برای دبیرخانه ارسال شده است. نتیجه در کارتابل نامه اعلام می‌شود.',
      }
    case 'approved':
      return {
        tone: 'success',
        title: 'شرکت شما احراز هویت شده است',
        body: 'اکنون می‌توانید رویدادها را مشاهده و درخواست خود را ثبت کنید.',
      }
    case 'rejected':
      return {
        tone: 'error',
        title: 'احراز هویت شرکت تایید نشد',
        body: 'علت تصمیم را مطالعه کنید. تا زمانی که دبیرخانه پرونده را بازگشایی نکند امکان ارسال دوباره ندارید؛ برای پیگیری به پشتیبانی پیام دهید.',
      }
    case 'returned':
      return verification.reason === COMPANY_EDIT_REVERIFICATION_REASON
        ? {
            tone: 'warning',
            title: 'اطلاعات شرکت ویرایش شد؛ احراز مجدد لازم است',
            body: 'تأیید قبلی با ویرایش پرونده باطل شد. پس از بررسی اطلاعات، پرونده را دوباره برای احراز ارسال کنید.',
          }
        : {
            tone: 'error',
            title: 'پرونده برای اصلاح بازگشت',
            body: 'موارد خواسته‌شده دبیرخانه را اصلاح کنید و پرونده را دوباره برای احراز ارسال کنید.',
          }
    default:
      return missing.canRequestVerification
        ? {
            tone: 'info',
            title: 'پرونده آماده ارسال برای احراز است',
            body: 'اطلاعات و مدارک الزامی کامل است؛ درخواست احراز هویت هنوز ارسال نشده است.',
          }
        : {
            tone: 'warning',
            title: 'اطلاعات شرکت هنوز کامل نیست',
            body: 'برای ارسال درخواست احراز هویت، اطلاعات نماینده و مدارک شرکت را تکمیل کنید.',
          }
  }
}

type StepState = 'done' | 'active' | 'waiting'
const STEP_BADGE: Record<StepState, { label: string; variant: 'success' | 'primary' | 'gray' }> = {
  done: { label: 'انجام شده', variant: 'success' },
  active: { label: 'در حال بررسی', variant: 'primary' },
  waiting: { label: 'در انتظار', variant: 'gray' },
}

/**
 * The company's verification state on its own profile (Figma *Workflow —
 * Missing Screens* 16, 22, 23, 24), with the submit / resubmit action.
 */
export function CompanyVerificationCard({
  verification,
  missing,
  companyName,
  nationalId,
  submitting,
  onSubmit,
}: {
  verification: CompanyVerificationDto
  missing: MissingDossierItemsDto
  companyName: string
  nationalId: string
  submitting: boolean
  onSubmit: () => void
}) {
  const banner = bannerFor(verification, missing)
  const { status } = verification
  const canSubmit = verification.canRequestVerification && status !== 'pending' && status !== 'approved'
  const resubmit = status === 'returned' || status === 'rejected'

  return (
    <section id="company-verification" aria-labelledby="company-verification-title" className="flex scroll-mt-6 flex-col gap-4">
      <div role="status" className={cn('flex flex-col gap-2 rounded-2xl p-4', BANNER_TONE[banner.tone])}>
        <Typography as="h2" id="company-verification-title" variant="16/semibold" className="text-inherit">
          {banner.title}
        </Typography>
        <Typography variant="14/regular" className="text-inherit">
          {banner.body}
        </Typography>
        {status !== 'approved' && (
          <Typography variant="12/regular" className="text-inherit">
            {BLOCKED_NOTE}
          </Typography>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6">
        <Typography as="h3" variant="20/bold" color="neutral-800">
          {status === 'pending'
            ? 'اطلاعات ارسال‌شده'
            : status === 'approved'
              ? 'نتیجه بررسی احراز هویت'
              : status === 'returned' && verification.reason === COMPANY_EDIT_REVERIFICATION_REASON
                ? 'علت احراز مجدد'
                : status === 'rejected' || (status === 'returned' && verification.reason)
                  ? 'دلیل تصمیم'
                : 'اطلاعات مورد نیاز'}
        </Typography>

        {(status === 'pending' || status === 'approved' || status === 'rejected' || status === 'returned') && (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Fact label="شرکت" value={companyName} />
            {status === 'pending' && <Fact label="تاریخ ارسال" value={formatDate(verification.submittedAt)} />}
            {status === 'approved' && <Fact label="شناسه ملی" value={nationalId} ltr />}
            {status === 'approved' && <Fact label="تاریخ تایید" value={formatDate(verification.decidedAt)} />}
            {(status === 'rejected' || status === 'returned') && (
              <Fact label="تاریخ تصمیم" value={formatDate(verification.decidedAt ?? verification.submittedAt)} />
            )}
            {status === 'pending' && <Fact label="وضعیت" value="در انتظار بررسی دبیرخانه" />}
          </dl>
        )}

        {status === 'pending' && (
          <ol className="flex flex-col gap-3">
            {(
              [
                ['تکمیل اطلاعات شرکت', 'done'],
                ['ارسال مدارک احراز هویت', 'done'],
                ['بررسی دبیرخانه', 'active'],
                ['دریافت نتیجه', 'waiting'],
              ] as const
            ).map(([label, state]) => (
              <li key={label} className="flex items-center justify-between gap-3">
                <Typography variant="14/regular" color="neutral-700">
                  {label}
                </Typography>
                <Badge variant={STEP_BADGE[state].variant} size="sm">
                  {STEP_BADGE[state].label}
                </Badge>
              </li>
            ))}
          </ol>
        )}

        {status === 'approved' && (
          <Typography variant="14/regular" color="neutral-700">
            اطلاعات و مدارک شرکت بررسی و تأیید شد. برای شرکت در رویداد، فرم درخواست همان رویداد را تکمیل کنید.
          </Typography>
        )}

        {(status === 'rejected' || status === 'returned') && verification.reason && (
          <Typography variant="14/regular" color="neutral-700" className="whitespace-pre-line">
            {verification.reason}
          </Typography>
        )}

        {status !== 'pending' && status !== 'approved' && status !== 'rejected' && missing.required.length > 0 && (
          <div className="flex flex-col gap-3">
            <Typography variant="14/semibold" color="neutral-600">
              اطلاعات یا مدارک الزامی ناقص:
            </Typography>
            <ul className="flex flex-col gap-3">
              {groupMissingByLocation(missing.required).map((group) => (
                <li
                  key={`${group.page}-${group.section}`}
                  data-slot="missing-group"
                  className="flex flex-col gap-2 rounded-lg border border-neutral-100 p-3"
                >
                  <Typography variant="14/regular" color="neutral-600">
                    صفحهٔ «{group.page}»، بخش «{group.section}»؛ این موارد را پر کنید:
                  </Typography>
                  <ul className="flex flex-wrap gap-2">
                    {group.keys.map((key) => (
                      <li key={key}>
                        <Badge variant="error" size="md">
                          {dossierFieldLabel(key)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
        {status !== 'pending' && status !== 'approved' && status !== 'rejected' && missing.optional.length > 0 && (
          <div className="flex flex-col gap-2">
            <Typography variant="12/regular" color="neutral-500">
              موارد اختیاری بدون پاسخ (در صورت نداشتن، آن‌ها را خالی بگذارید):
            </Typography>
            <ul className="flex flex-wrap gap-1.5">
              {missing.optional.map((key) => (
                <li key={key}>
                  <Badge variant="gray" size="sm">
                    {dossierFieldLabel(key)}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        {status === 'rejected' && (
          <Badge variant="error" size="md">
            ثبت درخواست در انتظار احراز هویت
          </Badge>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
          {status !== 'pending' && status !== 'approved' && !verification.canRequestVerification && (
            <Button type="button" size="40" disabled aria-describedby="company-verification-title">
              {resubmit ? 'ارسال دوباره برای احراز' : 'ارسال برای احراز'}
            </Button>
          )}
          {canSubmit && (
            <Button type="button" size="40" loading={submitting} onClick={onSubmit}>
              {resubmit ? 'ارسال دوباره برای احراز' : 'ارسال برای احراز'}
            </Button>
          )}
          {status === 'approved' && (
            <>
              <Button asChild size="40">
                <Link href="/dashboard/events">مشاهده رویدادها</Link>
              </Button>
              {/* The decision letter lands in the inbox (verification-repo writes it). */}
              <Button asChild size="40" variant="outline-gray">
                <Link href="/dashboard/inbox">نامه تایید احراز هویت</Link>
              </Button>
            </>
          )}
          {status === 'pending' && (
            <Button asChild size="40">
              <Link href="/dashboard/inbox">مشاهده کارتابل نامه</Link>
            </Button>
          )}
          {(status === 'rejected' || status === 'returned') && (
            <Button asChild size="40" variant={canSubmit ? 'outline-gray' : 'primary'}>
              <Link href="/dashboard/inbox">مشاهده نامه دبیرخانه</Link>
            </Button>
          )}
          {status === 'rejected' && (
            <Button asChild size="40" variant="outline-gray">
              <Link href="/dashboard/letters/new?mode=support">پیام به پشتیبانی</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

function Fact({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Typography as="dt" variant="12/regular" color="neutral-500">
        {label}
      </Typography>
      <Typography as="dd" variant="14/semibold" color="neutral-800" dir={ltr && value ? 'ltr' : undefined} className="text-start">
        {value || '—'}
      </Typography>
    </div>
  )
}
