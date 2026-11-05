'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronUpIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

/** A bordered section with a bold title and an optional action opposite it (Figma 30537:19248). */
export function DetailCard({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={title}
      className={cn('flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-background p-4', className)}
    >
      <div className="flex min-h-8 items-center justify-between gap-4">
        <Typography as="h2" variant="16/bold" sm="20/bold" color="secondary">
          {title}
        </Typography>
        {action}
      </div>
      {children}
    </section>
  )
}

/** One read-only value: a quiet label over the value, in the soft bordered tile of the Figma text field. */
export function InfoField({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 rounded-lg border border-neutral-100 p-2', className)}>
      <Typography as="span" variant="12/semibold" sm="14/semibold" color="neutral-400">
        {label}
      </Typography>
      <Typography as="span" variant="14/semibold" sm="16/semibold" color="secondary" className="break-words">
        {value}
      </Typography>
    </div>
  )
}

/** A disabled form field that shows a stored answer: label above, soft grey box below (Figma 32:10162). */
export function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Typography as="span" variant="14/semibold" sm="16/semibold" color="neutral-700">
        {label}
      </Typography>
      <div className="flex min-h-10 items-center rounded-lg border border-neutral-100 bg-neutral-50 p-2">
        <Typography as="span" variant="14/regular" sm="16/regular" color={value ? 'secondary' : 'neutral-400'} className="break-words">
          {value || '—'}
        </Typography>
      </div>
    </div>
  )
}

/** A card whose body folds away behind the chevron opposite its title (Figma 30950:10003). */
export function CollapsibleCard({
  title,
  children,
  defaultOpen = true,
  className,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()

  return (
    <section
      aria-label={title}
      className={cn('flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-background p-4', className)}
    >
      <div className="flex items-center justify-between gap-4">
        <Typography as="h2" variant="16/bold" sm="20/extrabold" color="neutral-800">
          {title}
        </Typography>
        <Button
          type="button"
          variant="text-gray"
          size="icon-32"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? `بستن ${title}` : `باز کردن ${title}`}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronUpIcon className={cn('size-6', !open && 'rotate-180')} aria-hidden="true" />
        </Button>
      </div>
      <div id={bodyId} hidden={!open} className="flex flex-col gap-6">
        {children}
      </div>
    </section>
  )
}
