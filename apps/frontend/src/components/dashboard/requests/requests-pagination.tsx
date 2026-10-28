import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { requestQueueHref, type RequestStatus } from './types'

export function RequestsPagination({
  page,
  totalPages,
  status,
}: {
  page: number
  totalPages: number
  status?: RequestStatus
}) {
  if (totalPages <= 1 && page <= 1) return null
  const href = (target: number) => requestQueueHref('/dashboard/requests', status, target)
  return (
    <nav
      aria-label="صفحه‌بندی درخواست‌ها"
      className="mt-5 flex flex-wrap items-center justify-center gap-3"
      dir="rtl"
    >
      {page > 1 && (
        <Button asChild variant="outline-gray">
          <Link href={href(1)}>
            <Typography>صفحه نخست</Typography>
          </Link>
        </Button>
      )}
      {page > 1 && (
        <Button asChild variant="outline-gray">
          <Link href={href(page - 1)}>
            <Typography>صفحه قبل</Typography>
          </Link>
        </Button>
      )}
      <Typography variant="14/regular" color="neutral-600">
        صفحه {page.toLocaleString('fa-IR')} از {Math.max(1, totalPages).toLocaleString('fa-IR')}
      </Typography>
      {page < totalPages && (
        <Button asChild variant="outline-gray">
          <Link href={href(page + 1)}>
            <Typography>صفحه بعد</Typography>
          </Link>
        </Button>
      )}
    </nav>
  )
}
