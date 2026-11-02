'use client'

import type { ReactNode } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { focusFirstField } from '@/components/ui/dialog-focus'

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
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel="بستن پنجره" onOpenAutoFocus={focusFirstField} className="max-w-[400px] gap-4 p-4 sm:p-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <div className="flex items-center gap-2 pt-1 [&>*]:flex-1">{actions}</div>
      </DialogContent>
    </Dialog>
  )
}
