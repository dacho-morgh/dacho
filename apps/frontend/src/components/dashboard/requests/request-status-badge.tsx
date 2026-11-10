import React from 'react'
import { Typography } from '@/components/ui/typography'
import type { CompanyRequestStage } from '@/utilities/company-request-stage'

export interface RequestStatusBadgeProps {
  /** The company-facing stage (design QA #280); staff lists do not use this badge. */
  stage: CompanyRequestStage
  label: string
  className?: string
}

/**
 * Company stage badge of the requests list (Figma Medium tag: grey 32:9854, primary 32:9860)
 */
export function RequestStatusBadge({
  stage,
  label,
  className = '',
}: RequestStatusBadgeProps) {
  const isBlue = stage === 'reviewing'
  const bgColor = isBlue ? 'bg-brand-50' : 'bg-neutral-100'
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
