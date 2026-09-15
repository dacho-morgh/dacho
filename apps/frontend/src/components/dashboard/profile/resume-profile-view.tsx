import { Typography } from '@/components/ui/typography'

export function ResumeProfileView() {
  return (
    <section
      className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-100 bg-white p-8 text-center"
      dir="rtl"
    >
      <Typography as="h2" variant="20/bold" color="neutral-600">
        رزومه و سوابق شرکت
      </Typography>
      <Typography color="neutral-400" className="max-w-md">
        هنوز رزومه یا سابقه‌ای برای این شرکت ثبت نشده است.
      </Typography>
    </section>
  )
}
