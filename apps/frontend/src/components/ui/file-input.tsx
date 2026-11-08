'use client'

import * as React from 'react'

import { DashboardCloseCircle } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography, typographyVariants } from '@/components/ui/typography'
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
        'block w-full min-w-0 cursor-pointer rounded-lg border border-neutral-100 dark:border-neutral-300 bg-background p-1.5 outline-none transition-colors hover:border-brand-500 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 aria-invalid:border-error-100',
        'file:me-3 file:h-8 file:cursor-pointer file:rounded-[10px] file:border file:border-solid file:border-neutral-200 file:bg-transparent file:px-2 file:font-sans file:text-sm file:text-neutral-600 hover:file:bg-neutral-100',
        className,
      )}
      {...props}
    />
  ),
)
FileInput.displayName = 'FileInput'

/**
 * A file the user picked but has not sent yet, with an x to take it back out.
 * Use it under a FileInput; an uploaded file in PrivateDocumentField has the same x.
 */
function SelectedFile({
  file,
  onRemove,
  disabled,
  className,
}: {
  file: Pick<File, 'name' | 'size'>
  onRemove: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div
      data-slot="selected-file"
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-1',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col">
        <Typography variant="14/semibold" color="neutral-700" className="truncate">
          <bdi dir="auto">{file.name}</bdi>
        </Typography>
        <Typography variant="12/light" color="neutral-400">
          {(file.size / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت
        </Typography>
      </div>
      <Button
        type="button"
        variant="text-gray"
        size="icon-32"
        disabled={disabled}
        aria-label={`حذف ${file.name}`}
        onClick={onRemove}
      >
        <DashboardCloseCircle aria-hidden="true" />
      </Button>
    </div>
  )
}

export { FileInput, SelectedFile }
