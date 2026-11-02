import * as React from 'react'
import { DashboardSearchIcon } from '@/components/icons'
import { cn } from '@/utilities/ui'

/** The one search input used across the dashboard (matches the letters page). */
export function SearchField({
  className,
  inputClassName,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'> & { inputClassName?: string }) {
  return (
    <div
      className={cn(
        'flex h-12 w-full max-w-[400px] items-center gap-2 overflow-hidden rounded-lg border border-neutral-100 bg-white px-3 py-2 transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100',
        className,
      )}
    >
      <input
        type="search"
        className={cn(
          'h-7 min-w-0 flex-1 bg-transparent text-right font-sans text-base leading-7 text-neutral-600 outline-none placeholder:text-neutral-300',
          inputClassName,
        )}
        {...props}
      />
      <DashboardSearchIcon aria-hidden="true" className="size-6 shrink-0 text-neutral-300" />
    </div>
  )
}
