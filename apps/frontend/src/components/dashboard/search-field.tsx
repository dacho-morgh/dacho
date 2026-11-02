import * as React from 'react'
import { DashboardSearchIcon } from '@/components/icons'
import { Input } from '@/components/ui/input'
import { cn } from '@/utilities/ui'

/** The one search input used across the dashboard (matches the letters page). */
export function SearchField({
  className,
  inputClassName,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type' | 'size'> & { inputClassName?: string }) {
  return (
    <Input
      type="search"
      inputSize="lg"
      startIcon={<DashboardSearchIcon aria-hidden="true" />}
      containerClassName={cn('max-w-[400px] px-3', className)}
      className={inputClassName}
      {...props}
    />
  )
}
