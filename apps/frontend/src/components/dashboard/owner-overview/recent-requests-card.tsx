import Link from 'next/link'
import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Typography } from '@/components/ui/typography'
import { REQUEST_STATUS_LABELS, formatDate, type RequestStatus } from '@/utilities/dashboard-api'

export interface RecentRequestRow {
  id: string
  title: string
  trackingCode: string
  company: string
  stage: string
  status: RequestStatus
  date: string | null
}

const STATUS_VARIANT: Record<RequestStatus, BadgeProps['variant']> = {
  draft: 'gray',
  in_review: 'primary',
  action_needed: 'yellow',
  approved: 'green',
  rejected: 'red',
}

export function RecentRequestsCard({
  rows,
  notice,
}: {
  rows?: RecentRequestRow[]
  notice?: UnavailableReason
}) {
  return (
    <Card className="gap-0 overflow-hidden rounded-[10px] border-neutral-200 bg-background p-0 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3">
        <div>
          <Typography as="h2" variant="title" color="neutral-800">
            آخرین درخواست‌ها
          </Typography>
          <Typography as="p" variant="12/regular" color="neutral-500">
            همه رویدادها و مراحل
          </Typography>
        </div>
        <Button size="36" variant="outline-gray" asChild>
          <Link href="/dashboard/requests">مشاهده همه</Link>
        </Button>
      </div>
      {notice ? (
        <div className="px-6 pb-5">
          <OfflineNotice reason={notice} retryHref="/dashboard" />
        </div>
      ) : !rows?.length ? (
        <Typography as="p" variant="14/regular" color="neutral-500" className="px-6 pb-6">
          هنوز درخواستی ثبت نشده است.
        </Typography>
      ) : (
        <div className="px-4 pb-3">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>درخواست</TableHead>
                <TableHead>شرکت</TableHead>
                <TableHead>مرحله</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>تاریخ ثبت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/requests/${encodeURIComponent(row.id)}`}
                      className="flex flex-col rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
                    >
                      <Typography as="span" variant="14/semibold" color="neutral-800">
                        {row.title}
                      </Typography>
                      <Typography as="span" variant="12/regular" color="neutral-500">
                        کد پیگیری: {row.trackingCode}
                      </Typography>
                    </Link>
                  </TableCell>
                  <TableCell>{row.company}</TableCell>
                  <TableCell>{row.stage}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status]} size="sm" dot>
                      {REQUEST_STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.date ? formatDate(row.date) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}
