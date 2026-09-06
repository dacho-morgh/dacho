import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'

const fieldLabels = [
  'متن نمونه لیبل',
  'متن نمونه لیبل',
  'متن نمونه لیبل',
  'متن نمونه لیبل',
  'متن نمونه لیبل',
  'متن نمونه لیبل',
  'متن نمونه لیبل',
]

export function AdminRequestEvaluation({ id }: { id: string }) {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/admin/requests/${id}`}>
          <Typography variant="16/regular" color="muted">
            درخواست ها
          </Typography>
        </Link>
        <Typography variant="16/regular" color="muted">
          / درخواست شرکت آریانا فناوران /
        </Typography>
        <Typography variant="24/bold" color="neutral-900">
          ارزیابی درخواست
        </Typography>
      </div>
      <section className="flex min-h-[912px] flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <Typography variant="20/bold" color="neutral-900">
          نمایشگاه بین‌المللی نفت، گاز، پالایش و پتروشیمی پارس جنوبی (عسلویه)
        </Typography>
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="order-2 flex max-h-[828px] w-full max-w-[654px] flex-col gap-4 overflow-y-auto lg:order-1">
            <FormCard title="نام فرم شماره ۱" columns={1} />
            <FormCard title="نام فرم شماره ۲" columns={2} />
          </div>
          <div className="order-1 flex h-[768px] w-full max-w-[438px] flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm lg:order-2">
            <Typography variant="20/bold" color="neutral-900">
              فرم ارزیابی
            </Typography>
            <Typography variant="16/semibold" color="secondary" className="mt-5">
              متن پیام
            </Typography>
            <Textarea
              className="mt-2 min-h-0 flex-1 resize-none rounded-lg"
              placeholder="متن پلیس هولدر"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline-gray" size="40">
                <Typography variant="16/semibold" color="secondary">
                  رد درخواست
                </Typography>
              </Button>
              <Button size="40">
                <Typography variant="16/semibold" color="white">
                  تایید درخواست
                </Typography>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function FormCard({ title, columns }: { title: string; columns: 1 | 2 }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <Typography variant="20/bold" color="neutral-900">
        {title}
      </Typography>
      <div className={`mt-8 grid gap-8 ${columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        {fieldLabels.map((label, index) => (
          <label key={`${title}-${index}`} className="flex flex-col gap-2">
            <Typography variant="16/semibold" color="secondary">
              {label}
            </Typography>
            <Input readOnly placeholder="متن پلیس هولدر" className="h-10 rounded-lg bg-white" />
          </label>
        ))}
      </div>
    </section>
  )
}
