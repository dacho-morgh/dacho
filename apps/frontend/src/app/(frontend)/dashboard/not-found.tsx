import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

/** Keeps the dashboard navigation around a missing record instead of the public 404 page. */
export default function DashboardNotFound() {
  return (
    <section
      className="m-6 mt-20 flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center md:m-10"
      dir="rtl"
    >
      <Typography as="h1" variant="24/bold" color="neutral-700">
        این مورد پیدا نشد
      </Typography>
      <Typography color="neutral-500">
        ممکن است حذف شده باشد یا نشانی آن درست نباشد.
      </Typography>
      <Button asChild>
        <Link href="/dashboard">
          <Typography as="span" className="text-inherit">
            بازگشت به پیشخوان
          </Typography>
        </Link>
      </Button>
    </section>
  )
}
