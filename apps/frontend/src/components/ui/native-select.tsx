import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { typographyVariants } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

/**
 * A native <select> styled like Input (Figma node 263:3294). Prefer it to the
 * Radix Select inside forms: it keeps the browser's keyboard and mobile pickers
 * and posts with plain GET/POST forms.
 */
const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<'select'> & { containerClassName?: string; selectSize?: 'sm' | 'default' | 'lg' }
>(({ className, containerClassName, selectSize = 'default', dir = 'rtl', ...props }, ref) => (
  <div data-slot="native-select-wrapper" className={cn('relative w-full min-w-0', containerClassName)}>
    <select
      ref={ref}
      dir={dir}
      data-slot="native-select"
      className={cn(
        typographyVariants({ variant: '16/regular', color: 'neutral-600' }),
        'w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-neutral-100 dark:border-neutral-300 bg-background py-1 pr-2 pl-9 text-right outline-none transition-colors hover:border-brand-500 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 aria-invalid:border-error-100 aria-invalid:focus-visible:border-error-500',
        selectSize === 'sm' ? 'h-9' : selectSize === 'lg' ? 'h-12' : 'h-10',
        className,
      )}
      {...props}
    />
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-2 size-5 -translate-y-1/2 text-neutral-400"
    />
  </div>
))
NativeSelect.displayName = 'NativeSelect'

export { NativeSelect }
