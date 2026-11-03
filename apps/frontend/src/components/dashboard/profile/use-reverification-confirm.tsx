'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CompanyVerificationStatus } from '@/utilities/dashboard-api'
import { editWithdrawsVerification } from './company-verification-card'

/**
 * FE38: before an edit that would withdraw an approved or pending verification
 * is saved, the representative confirms it. `confirm()` resolves true at once
 * when there is nothing to lose.
 */
export function useReverificationConfirm(status: CompanyVerificationStatus | undefined): {
  confirm: () => Promise<boolean>
  dialog: ReactNode
} {
  const [open, setOpen] = useState(false)
  const resolveRef = useRef<((accepted: boolean) => void) | null>(null)

  const settle = useCallback((accepted: boolean) => {
    resolveRef.current?.(accepted)
    resolveRef.current = null
    setOpen(false)
  }, [])

  const confirm = useCallback(() => {
    if (!editWithdrawsVerification(status)) return Promise.resolve(true)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setOpen(true)
    })
  }, [status])

  const dialog = (
    <Dialog open={open} onOpenChange={(next) => !next && settle(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ذخیره تغییر نیازمند احراز مجدد است</DialogTitle>
          <DialogDescription>
            {status === 'approved'
              ? 'شرکت شما احراز هویت شده است. با ذخیره این تغییر، تأیید فعلی باطل می‌شود و تا تأیید دوباره دبیرخانه، ثبت درخواست رسمی و رزرو غرفه جدید امکان‌پذیر نیست. درخواست‌هایی که پیش‌تر ارسال کرده‌اید با اطلاعات تأییدشده همان زمان باقی می‌مانند.'
              : 'درخواست احراز هویت شما در حال بررسی است. با ذخیره این تغییر، درخواست فعلی از صف بررسی خارج می‌شود و باید پرونده را دوباره برای احراز ارسال کنید.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" size="40" onClick={() => settle(true)}>
            ذخیره و احراز مجدد
          </Button>
          <Button type="button" variant="outline-gray" size="40" onClick={() => settle(false)}>
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { confirm, dialog }
}
