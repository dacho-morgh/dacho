'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardMoreVerticalIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Typography } from '@/components/ui/typography'
import {
  REQUEST_STATUS_LABELS,
  formatDate,
  type Paginated,
  type RequestDto,
} from '@/utilities/dashboard-api'

type LoadState = 'loading' | 'ready' | 'unavailable'

/** The newest requests of the company's representative; the server filters them by owner. */
const REQUEST_PAGE_SIZE = 100

const HEADERS = ['درخواست', 'وضعیت', 'تاریخ سررسید', 'تاریخ ثبت']

function HeaderText({ children }: { children: string }) {
  return (
    <Typography as="span" variant="14/semibold" color="neutral-400">
      {children}
    </Typography>
  )
}

/** The company's requests as a table (Figma 30583:19419). */
export function CompanyRequestsTab({ companyId }: { companyId: string }) {
  const [state, setState] = useState<LoadState>('loading')
  const [requests, setRequests] = useState<RequestDto[]>([])

  useEffect(() => {
    let current = true
    fetch(`/api/dashboard/admin/requests?ownerId=${encodeURIComponent(companyId)}&limit=${REQUEST_PAGE_SIZE}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable')
        return (await response.json()) as Paginated<RequestDto>
      })
      .then((page) => {
        if (!current) return
        setRequests(page.items)
        setState('ready')
      })
      .catch(() => {
        if (current) setState('unavailable')
      })
    return () => {
      current = false
    }
  }, [companyId])

  if (state === 'unavailable') {
    return (
      <Typography role="alert" variant="14/regular" color="error">
        دریافت درخواست‌های این شرکت انجام نشد. دوباره تلاش کنید.
      </Typography>
    )
  }

  return (
    <Table dir="rtl">
      <TableHeader>
        <TableRow className="border-neutral-100 hover:bg-transparent">
          {HEADERS.map((header) => (
            <TableHead key={header} className="h-11 px-4">
              <HeaderText>{header}</HeaderText>
            </TableHead>
          ))}
          <TableHead className="w-[52px] px-4">
            <span className="sr-only">عملیات</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {state === 'loading'
          ? Array.from({ length: 3 }, (_, index) => (
              <TableRow key={index}>
                <TableCell colSpan={HEADERS.length + 1} className="h-[72px] p-4">
                  <Skeleton aria-hidden="true" className="h-6 w-full rounded-lg bg-neutral-100 motion-reduce:animate-none" />
                </TableCell>
              </TableRow>
            ))
          : requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="h-[72px] p-4">
                  <Link href={`/dashboard/companies/${encodeURIComponent(companyId)}/requests/${encodeURIComponent(request.id)}`}>
                    <Typography as="span" variant="16/regular" color="secondary">
                      {request.title}
                    </Typography>
                  </Link>
                </TableCell>
                <TableCell className="p-4">
                  <Badge variant={request.status === 'in_review' ? 'primary' : 'gray'}>
                    {REQUEST_STATUS_LABELS[request.status]}
                  </Badge>
                </TableCell>
                <TableCell className="p-4">
                  <Typography as="span" variant="16/regular" color="secondary">
                    {formatDate(request.dueDate) || '—'}
                  </Typography>
                </TableCell>
                <TableCell className="p-4">
                  <Typography as="span" variant="16/regular" color="secondary">
                    {formatDate(request.createdAt) || '—'}
                  </Typography>
                </TableCell>
                <TableCell className="p-4">
                  <Button asChild variant="text-gray" size="icon-32">
                    <Link
                      href={`/dashboard/companies/${encodeURIComponent(companyId)}/requests/${encodeURIComponent(request.id)}`}
                      aria-label={`مشاهده درخواست ${request.title}`}
                    >
                      <DashboardMoreVerticalIcon aria-hidden="true" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        {state === 'ready' && requests.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={HEADERS.length + 1} className="h-[72px] p-4 text-center">
              <Typography as="span" variant="14/regular" color="muted">
                درخواستی برای این شرکت ثبت نشده است.
              </Typography>
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  )
}
