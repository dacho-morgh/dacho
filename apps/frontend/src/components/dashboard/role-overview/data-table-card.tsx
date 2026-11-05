import Link from 'next/link'
import type { ReactNode } from 'react'
import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'
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

export interface DataTableRow {
  key: string
  cells: ReactNode[]
}

/** The "latest items" table every role board ends with. */
export function DataTableCard({
  title,
  subtitle,
  href,
  columns,
  rows,
  notice,
  emptyText,
}: {
  title: string
  subtitle: string
  href: string
  columns: string[]
  rows?: DataTableRow[]
  notice?: UnavailableReason
  emptyText: string
}) {
  return (
    <Card className="gap-0 overflow-hidden rounded-[10px] border-neutral-200 bg-background p-0 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3">
        <div>
          <Typography as="h2" variant="title" color="neutral-800">
            {title}
          </Typography>
          <Typography as="p" variant="12/regular" color="neutral-500">
            {subtitle}
          </Typography>
        </div>
        <Button size="36" variant="outline-gray" asChild>
          <Link href={href}>مشاهده همه</Link>
        </Button>
      </div>
      {notice ? (
        <div className="px-6 pb-5">
          <OfflineNotice reason={notice} retryHref="/dashboard" />
        </div>
      ) : !rows?.length ? (
        <Typography as="p" variant="14/regular" color="neutral-500" className="px-6 pb-6">
          {emptyText}
        </Typography>
      ) : (
        <div className="px-4 pb-3">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column, index) => (
                  <TableHead key={`${column}-${index}`}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  {row.cells.map((cell, index) => (
                    <TableCell key={index}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}

/** Case title with its tracking code; links to the dossier. */
export function CaseCell({
  id,
  title,
  trackingCode,
}: {
  id: string
  title: string
  trackingCode: string
}) {
  return (
    <Link
      href={`/dashboard/requests/${encodeURIComponent(id)}`}
      className="flex flex-col rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
    >
      <Typography as="span" variant="14/semibold" color="neutral-800">
        {title}
      </Typography>
      <Typography as="span" variant="12/regular" color="neutral-500">
        کد پیگیری: {trackingCode}
      </Typography>
    </Link>
  )
}

/** The row's one action; `primary` cases the person must act on are outlined, the rest quiet. */
export function RowAction({
  href,
  label,
  primary,
}: {
  href: string
  label: string
  primary?: boolean
}) {
  return (
    <Button size="32" variant={primary ? 'outline' : 'text-gray'} asChild>
      <Link href={href}>{label}</Link>
    </Button>
  )
}
