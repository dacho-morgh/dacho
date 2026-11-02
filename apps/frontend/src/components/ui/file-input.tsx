import * as React from 'react'

import { typographyVariants } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

/** A native file picker with the Input border and an outline-gray picker button. */
const FileInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<'input'>, 'type'>>(
  ({ className, dir = 'rtl', ...props }, ref) => (
    <input
      ref={ref}
      type="file"
      dir={dir}
      data-slot="file-input"
      className={cn(
        typographyVariants({ variant: '14/regular', color: 'neutral-600' }),
        'block w-full min-w-0 cursor-pointer rounded-lg border border-neutral-100 bg-white p-1.5 outline-none transition-colors hover:border-brand-500 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 aria-invalid:border-error-100',
        'file:me-3 file:h-8 file:cursor-pointer file:rounded-[10px] file:border file:border-solid file:border-neutral-200 file:bg-transparent file:px-2 file:font-sans file:text-sm file:text-neutral-600 hover:file:bg-neutral-100',
        className,
      )}
      {...props}
    />
  ),
)
FileInput.displayName = 'FileInput'

export { FileInput }
