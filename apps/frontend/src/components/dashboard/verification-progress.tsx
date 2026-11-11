import Link from 'next/link'

import { TickCircleIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Typography } from '@/components/ui/typography'
import {
  formatDate,
  formatTime,
  type CompanyVerificationDto,
  type CompanyVerificationHistoryDto,
  type CompanyVerificationStatus,
} from '@/utilities/dashboard-api'
import { cn } from '@/utilities/ui'

const PROFILE_VERIFICATION_HREF = '/dashboard/profile/company#company-verification'

const STEPS = [
  { title: 'تکمیل و ارسال اطلاعات', description: 'اطلاعات و مدارک شرکت' },
  { title: 'بررسی دبیرخانه', description: 'در حال پیگیری توسط دبیرخانه' },
  { title: 'نتیجه احراز هویت', description: 'تأیید، برگشت یا رد' },
]

interface StatusView {
  label: string
  variant: 'green' | 'yellow' | 'red' | 'secondary' | 'gray'
  /** Steps before this index are done, this one is highlighted. */
  current: number
  summary: string
  action: string
}

const STATUS_VIEW: Record<CompanyVerificationStatus, StatusView> = {
  unsubmitted: {
    label: 'ارسال نشده',
    variant: 'gray',
    current: 0,
    summary: 'اطلاعات و مدارک شرکت هنوز برای احراز هویت ارسال نشده است.',
    action: 'تکمیل اطلاعات و ارسال',
  },
  pending: {
    label: 'در انتظار بررسی',
    variant: 'secondary',
    current: 1,
    summary: 'درخواست شما دریافت شده و دبیرخانه در حال پیگیری و بررسی آن است.',
    action: 'مشاهده اطلاعات شرکت',
  },
  returned: {
    label: 'برگشت داده شده',
    variant: 'yellow',
    current: 0,
    summary: 'دبیرخانه درخواست را برای اصلاح برگرداند. اطلاعات را اصلاح و دوباره ارسال کنید.',
    action: 'اصلاح و ارسال مجدد',
  },
  rejected: {
    label: 'رد شده',
    variant: 'red',
    current: 3,
    summary: 'درخواست احراز هویت شرکت رد شده است. ارسال دوباره پس از بازگشایی پرونده توسط دبیرخانه ممکن می‌شود.',
    action: 'مشاهده اطلاعات شرکت',
  },
  approved: {
    label: 'تأیید شده',
    variant: 'green',
    current: 3,
    summary: 'هویت شرکت شما تأیید شده است.',
    action: 'مشاهده اطلاعات شرکت',
  },
}

const fa = (value: number) => value.toLocaleString('fa-IR')

function stamp(iso: string | null): string {
  return iso ? `${formatDate(iso)}، ${formatTime(iso)}` : '—'
}

/** One line of the follow-up trail: what happened to a submission and when. */
function trail(history: CompanyVerificationHistoryDto[]) {
  return [...history]
    .sort((a, b) => b.revision - a.revision)
    .flatMap((entry) => {
      const lines: { key: string; at: string | null; text: string; note?: string | null }[] = []
      if (entry.decidedAt && entry.status !== 'pending') {
        lines.push({
          key: `${entry.revision}:decision`,
          at: entry.decidedAt,
          text: `نتیجه بررسی: ${STATUS_VIEW[entry.status].label}`,
          note: entry.reason,
        })
      }
      lines.push({ key: `${entry.revision}:submitted`, at: entry.submittedAt, text: `ارسال درخواست (نوبت ${fa(entry.revision)})` })
      return lines
    })
}

/** The company's verification as a case: where it stands, what the Secretariat said, and the trail so far. */
export function VerificationProgress({ verification }: { verification: CompanyVerificationDto }) {
  const view = STATUS_VIEW[verification.status]
  const events = trail(verification.history ?? [])
  const note = verification.status === 'returned' || verification.status === 'rejected' ? verification.reason : null

  return (
    <div className="flex flex-col gap-4" data-testid="verification-progress">
      <Card className="rounded-[10px] border-neutral-200 bg-background px-6 py-5 shadow-none">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Typography as="h2" variant="title" color="neutral-800">روند احراز هویت</Typography>
            <Typography as="p" variant="14/regular" color="neutral-500" className="mt-1">{view.summary}</Typography>
          </div>
          <Badge variant={view.variant} size="sm" dot>{view.label}</Badge>
        </div>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => {
            const state = index < view.current ? 'done' : index === view.current ? 'current' : 'next'
            return (
              <li key={step.title} aria-current={state === 'current' ? 'step' : undefined} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full border text-sm',
                    state === 'done' && 'border-success-50 bg-success-50 text-success-700 [&_svg]:size-5',
                    state === 'current' && 'border-brand-600 bg-brand-50 text-brand-600',
                    state === 'next' && 'border-neutral-200 bg-background text-neutral-400',
                  )}
                >
                  {state === 'done' ? <TickCircleIcon /> : fa(index + 1)}
                </span>
                <span className="flex flex-col">
                  <Typography as="span" variant="14/semibold" color={state === 'next' ? 'neutral-500' : 'neutral-800'}>{step.title}</Typography>
                  <Typography as="span" variant="12/regular" color="neutral-500">{step.description}</Typography>
                </span>
              </li>
            )
          })}
        </ol>
        {note ? (
          <Typography as="p" variant="14/regular" className="mt-4 rounded-xl bg-neutral-50 p-3 text-neutral-700">
            توضیح دبیرخانه: {note}
          </Typography>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Button asChild size="40">
            <Link href={PROFILE_VERIFICATION_HREF}>
              <Typography as="span" variant="16/semibold" className="text-inherit">{view.action}</Typography>
            </Link>
          </Button>
        </div>
      </Card>

      <Card className="rounded-[10px] border-neutral-200 bg-background px-6 py-5 shadow-none">
        <Typography as="h2" variant="title" color="neutral-800">تاریخچه پیگیری</Typography>
        {events.length === 0 ? (
          <Typography as="p" variant="14/regular" color="neutral-500" className="mt-3">
            هنوز درخواستی برای احراز هویت ارسال نشده است.
          </Typography>
        ) : (
          <ol className="mt-4 flex flex-col gap-4">
            {events.map((event) => (
              <li key={event.key} className="flex flex-col gap-1 border-s-2 border-neutral-200 ps-4">
                <Typography as="span" variant="14/semibold" color="neutral-800">{event.text}</Typography>
                <Typography as="span" variant="12/regular" color="neutral-500">{stamp(event.at)}</Typography>
                {event.note ? <Typography as="span" variant="14/regular" color="neutral-600">{event.note}</Typography> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
