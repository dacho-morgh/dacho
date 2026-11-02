'use client'

import { useId, useRef, type ReactNode } from 'react'

import { DashboardCloseCircle } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

import { useDialogFocus } from './use-dialog-focus'

interface DecisionDialogProps {
  title: string
  description: string
  onClose: () => void
  children?: ReactNode
  actions: ReactNode
}

/**
 * The confirm-and-explain modal of the dashboard decisions (Figma 31885:6566,
 * «درخواست اصلاحیه» and «رد درخواست»): a title with a close control, the
 * consequence in one sentence, an optional field and the two actions.
 */
export function DecisionDialog({ title, description, onClose, children, actions }: DecisionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useDialogFocus(dialogRef, onClose)

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      dir="rtl"
    >
      <section className="flex max-h-[90vh] w-full max-w-[400px] flex-col gap-4 overflow-y-auto rounded-2xl border border-neutral-100 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <Typography id={titleId} as="h2" variant="20/bold" color="neutral-700">
            {title}
          </Typography>
          <Button type="button" variant="text-gray" size="icon-40" onClick={onClose} aria-label="بستن پنجره">
            <DashboardCloseCircle className="size-6" />
          </Button>
        </div>
        <Typography id={descriptionId} variant="14/regular" color="neutral-600">
          {description}
        </Typography>
        {children}
        <div className="flex items-center gap-2 pt-1 [&>*]:flex-1">{actions}</div>
      </section>
    </div>
  )
}
