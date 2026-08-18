import React from 'react'
import { Typography } from '@/components/ui/typography'
import type { RequestStatus } from './types'

export interface RequestStatusBadgeProps {
  status: RequestStatus
  label: string
  className?: string
}

/**
 * Status Badge for Requests List (Figma Tag node 32:9838)
 */
export function RequestStatusBadge({
  status,
  label,
  className = '',
}: RequestStatusBadgeProps) {
  const isBlue = status === 'in_review'
  const bgColor = isBlue ? 'bg-[#eef2ff]' : 'bg-neutral-100'
  const textColor = isBlue ? 'text-brand-600' : 'text-neutral-600'

  return (
    <div
      className={`inline-flex h-6 items-center rounded-full ${bgColor} px-3 ${className}`}
    >
      <Typography
        as="span"
        variant="14/regular"
        className={`${textColor} whitespace-nowrap select-none`}
      >
        {label}
      </Typography>
    </div>
  )
}
