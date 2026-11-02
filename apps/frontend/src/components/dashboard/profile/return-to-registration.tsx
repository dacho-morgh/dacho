import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { getExplicitSafeReturnUrl } from '@/utilities/auth-return-url'

/** Only registration entries are offered as a way back; any other value is ignored. */
export function registrationReturnUrl(value: unknown): string | null {
  const safe = getExplicitSafeReturnUrl(value)
  if (!safe) return null
  const path = safe.split(/[?#]/, 1)[0]
  return path === '/dashboard/events' || path === '/dashboard/new-request' ? safe : null
}

export function ReturnToRegistration({ returnTo }: { returnTo: unknown }) {
  const href = registrationReturnUrl(returnTo)
  if (!href) return null
  return (
    <aside
      aria-label="بازگشت به ثبت‌نام"
      dir="rtl"
      className="flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <Typography variant="14/regular" color="neutral-700">
        پس از تکمیل این بخش، به ثبت‌نامی که شروع کرده بودید بازگردید؛ رویداد، زیرعنوان یا غرفه انتخابی شما حفظ شده است.
      </Typography>
      <Button asChild variant="primary" size="36" className="self-start sm:self-auto">
        <Link href={href}>بازگشت به ثبت‌نام</Link>
      </Button>
    </aside>
  )
}
