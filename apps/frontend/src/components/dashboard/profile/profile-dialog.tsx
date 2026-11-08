'use client'

import type { ReactNode } from 'react'

import { DashboardCloseCircle } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { focusFirstField } from '@/components/ui/dialog-focus'

interface ProfileDialogProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** The primary action (save / add). Rendered first, so it sits on the right in RTL. */
  primary: ReactNode
  /** The cancel action. Rendered after the primary one, so it sits on its left. */
  secondary?: ReactNode
}

export function ProfileDialog({ title, onClose, children, primary, secondary }: ProfileDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={focusFirstField}
        className="max-w-md p-4 sm:p-4"
      >
        <div className="flex items-center justify-between">
          <DialogTitle asChild>
            <h3>{title}</h3>
          </DialogTitle>
          <DialogClose asChild>
            <Button type="button" variant="text-gray" size="icon-40" aria-label="بستن پنجره">
              <DashboardCloseCircle className="size-6" />
            </Button>
          </DialogClose>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pe-1">{children}</div>
        <div data-slot="dialog-footer" className="flex items-center gap-2 pt-2">
          {primary}
          {secondary}
        </div>
      </DialogContent>
    </Dialog>
  )
}
