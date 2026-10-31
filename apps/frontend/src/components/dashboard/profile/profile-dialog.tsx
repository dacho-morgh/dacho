'use client'

import { useRef, type ReactNode } from 'react'
import { DashboardCloseCircle } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { useDialogFocus } from '../use-dialog-focus'

interface ProfileDialogProps {
  title: string
  onClose: () => void
  children: ReactNode
  actions: ReactNode
}

export function ProfileDialog({ title, onClose, children, actions }: ProfileDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef, onClose)
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-dialog-title"
    >
      <section className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <Typography id="profile-dialog-title" as="h3" variant="20/bold" color="neutral-600">
            {title}
          </Typography>
          <Button
            type="button"
            variant="text-gray"
            size="icon-40"
            onClick={onClose}
            aria-label="بستن پنجره"
          >
            <DashboardCloseCircle className="size-6" />
          </Button>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pe-1">{children}</div>
        <div className="flex items-center gap-2 pt-2">{actions}</div>
      </section>
    </div>
  )
}
