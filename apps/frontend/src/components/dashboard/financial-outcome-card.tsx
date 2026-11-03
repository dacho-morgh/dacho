import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { formatDate, type PublishedResultDto } from '@/utilities/dashboard-api'

import { FinancialBanner, FinancialCard, FinancialSteps } from './financial-parts'

/**
 * Figma 20: the company's final outcome. Only the text the Secretariat published, and its
 * date, ever reach this card. Publication does not change the case status, so the card
 * names no approval or rejection of its own; the published text carries the outcome.
 */
export function FinancialOutcomeCard({
  result,
  stageOpen,
}: {
  /** `GET /requests/:id/result`; `failed` when the read did not arrive. */
  result: PublishedResultDto | null | 'failed'
  /** The case is at the financial and investment stage. */
  stageOpen: boolean
}) {
  if (result === 'failed') {
    return (
      <Typography role="alert" variant="14/regular" color="error">
        دریافت نتیجه پرونده انجام نشد. صفحه را دوباره بارگذاری کنید.
      </Typography>
    )
  }
  if (!result) {
    return stageOpen ? (
      <Typography variant="14/regular" color="neutral-500" data-testid="result-pending">
        نتیجه این پرونده هنوز منتشر نشده است. پس از انتشار توسط دبیرخانه، متن آن در همین صفحه نمایش داده می‌شود.
      </Typography>
    ) : null
  }
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="published-result">
      <FinancialBanner tone="success" title="نتیجه نهایی درخواست شما منتشر شد">
        متن رسمی نتیجه در ادامه آمده و اطلاع آن در کارتابل شما هم ثبت شده است.
      </FinancialBanner>
      <FinancialCard title="نتیجه رسمی و پیگیری">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success" size="md">منتشر شده</Badge>
          <Typography variant="12/regular" color="neutral-500">تاریخ انتشار: {formatDate(result.publishedAt)}</Typography>
        </div>
        <Typography variant="16/regular" color="neutral-800" className="whitespace-pre-wrap break-words" data-testid="published-result-body">
          {result.body}
        </Typography>
        <FinancialSteps
          steps={[
            { label: 'احراز هویت شرکت', state: 'done' },
            { label: 'بررسی اولیه و داوری', state: 'done' },
            { label: 'تکمیل اطلاعات مالی', state: 'done' },
            { label: 'بررسی و انتشار نتیجه', state: 'done' },
          ]}
        />
        <Button asChild size="40" className="w-fit">
          <Link href="/dashboard/inbox">
            <Typography as="span" variant="14/semibold" className="text-inherit">مشاهده نامه در کارتابل</Typography>
          </Link>
        </Button>
      </FinancialCard>
    </div>
  )
}
