'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardTrashIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { DeleteAccountDialog } from './company-action-dialogs'

/** «حذف حساب شرکت» of the section tabs; only the System Owner may remove an account. */
export function DeleteCompanyAccount({
  userId,
  updatedAt,
  companyName,
  canManage,
  inline = false,
}: {
  userId: string
  updatedAt: string | null | undefined
  companyName?: string
  canManage: boolean
  /** A plain button of its own, instead of an entry of the section tabs. */
  inline?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="text-destructive"
        size="40"
        disabled={!canManage}
        icon={<DashboardTrashIcon className="size-6" aria-hidden="true" />}
        className={inline ? 'w-fit px-4' : 'min-w-0 flex-1 justify-start gap-2 rounded-xl p-2 text-start'}
        title={canManage ? undefined : 'فقط مالک سیستم می‌تواند حساب شرکت را حذف کند'}
        onClick={() => setOpen(true)}
      >
        <Typography as="span" variant="14/regular" sm="16/regular" className="whitespace-nowrap text-inherit">
          حذف حساب شرکت
        </Typography>
      </Button>
      {open ? (
        <DeleteAccountDialog
          userId={userId}
          updatedAt={updatedAt}
          companyName={companyName}
          onClose={() => setOpen(false)}
          onSaved={() => {
            router.push('/dashboard/companies')
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
