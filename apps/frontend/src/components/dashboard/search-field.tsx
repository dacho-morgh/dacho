import * as React from 'react'
import { DashboardSearchIcon } from '@/components/icons'
import { Input } from '@/components/ui/input'
import { cn } from '@/utilities/ui'

/**
 * The one search input used across the dashboard (matches the letters page).
 * Its size is fixed (48px high, 400px wide from `sm` up) so every list looks the same.
 */
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
      containerClassName={cn('w-full px-3 sm:w-[400px]', className)}
      className={cn('max-sm:text-sm', inputClassName)}
      {...props}
    />
  )
}
