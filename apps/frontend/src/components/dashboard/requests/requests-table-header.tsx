import React from 'react'
import { Typography } from '@/components/ui/typography'

export function RequestsTableHeader() {
  return (
    <thead>
      <tr className="h-11 border-b border-neutral-100">
        <th scope="col" className="h-11 px-4 text-right font-normal">
          <Typography as="span" variant="14/semibold" className="text-neutral-400">
            درخواست
          </Typography>
        </th>
        <th scope="col" className="h-11 px-4 text-right font-normal">
          <Typography as="span" variant="14/semibold" className="text-neutral-400">
            وضعیت
          </Typography>
        </th>
        <th scope="col" className="h-11 px-4 text-right font-normal">
          <Typography as="span" variant="14/semibold" className="text-neutral-400">
            تاریخ سررسید
          </Typography>
        </th>
        <th scope="col" className="h-11 px-4 text-right font-normal">
          <Typography as="span" variant="14/semibold" className="text-neutral-400">
            تاریخ ثبت
          </Typography>
        </th>
        <th scope="col" className="h-11 px-2">
          <span className="sr-only">عملیات</span>
        </th>
      </tr>
    </thead>
  )
}
