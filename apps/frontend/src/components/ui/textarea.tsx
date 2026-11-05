import * as React from 'react'

import { typographyVariants } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

/** Multi-line input styled like Input (Figma node 263:3294): RTL, 8px radius, brand focus, error on aria-invalid. */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, dir = 'rtl', ...props }, ref) => (
    <textarea
      ref={ref}
      dir={dir}
      data-slot="textarea"
      className={cn(
        typographyVariants({ variant: '16/regular', color: 'neutral-600' }),
        'flex field-sizing-content min-h-24 w-full rounded-lg border border-neutral-100 dark:border-neutral-300 bg-background p-2 text-right outline-none transition-colors placeholder:font-light placeholder:text-neutral-400 hover:border-brand-500 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 aria-invalid:border-error-100 aria-invalid:focus-visible:border-error-500',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export { Textarea }
