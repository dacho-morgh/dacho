import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import type { CompanyVerificationStatus } from '@/utilities/dashboard-api'

const VERIFICATION_PROFILE_HREF = '/dashboard/profile/company#company-verification'

const VERIFICATION_GATE_COPY: Record<
  Exclude<CompanyVerificationStatus, 'approved'>,
  { title: string; description: string; action: string }
> = {
  unsubmitted: {
    title: 'ابتدا اطلاعات شرکت را تکمیل کنید',
    description: 'برای مشاهده و ثبت‌نام در رویدادها و نمایشگاه‌ها، اطلاعات شرکت را تکمیل کنید و احراز هویت را ارسال کنید.',
    action: 'تکمیل اطلاعات و احراز هویت',
  },
  pending: {
    title: 'احراز هویت شرکت در حال بررسی است',
    description: 'پس از تأیید دبیرخانه، رویدادها و نمایشگاه‌ها برای شما فعال می‌شود.',
    action: 'مشاهده وضعیت احراز هویت',
  },
  returned: {
    title: 'پرونده شرکت برای اصلاح بازگشته است',
    description: 'موارد خواسته‌شده را اصلاح کنید و احراز هویت را دوباره ارسال کنید.',
    action: 'اصلاح و ارسال مجدد',
  },
  rejected: {
    title: 'احراز هویت شرکت رد شده است',
    description: 'برای دسترسی به رویدادها و نمایشگاه‌ها، وضعیت احراز هویت را در پروفایل بررسی کنید.',
    action: 'مشاهده وضعیت احراز هویت',
  },
}

/** The blurred layer over the events list for a company that is not yet verified. */
export function VerificationGate({ status }: { status?: CompanyVerificationStatus }) {
  if (!status || status === 'approved') return null
  const copy = VERIFICATION_GATE_COPY[status]
  return (
    <div
      role="region"
      aria-labelledby="events-verification-gate-title"
      data-testid="events-verification-gate"
      data-status={status}
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-4 backdrop-blur-md"
    >
      <div className="flex max-w-[420px] flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-background p-6 text-center shadow-xs">
        <Typography as="h2" id="events-verification-gate-title" variant="20/bold" color="neutral-700">
          {copy.title}
        </Typography>
        <Typography variant="14/regular" color="neutral-600">
          {copy.description}
        </Typography>
        <Button asChild size="40">
          <Link href={VERIFICATION_PROFILE_HREF}>{copy.action}</Link>
        </Button>
      </div>
    </div>
  )
}
