'use client'

import { useState } from 'react'
import { DashboardEditIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import type { CompanyDetailResponse } from '@/components/dashboard/company-detail-view'
import { ContactDialog, PasswordDialog } from './company-action-dialogs'
import { DetailCard, InfoField } from './company-detail-parts'

const OWNER_ONLY = 'فقط مالک سیستم می‌تواند اطلاعات حساب نماینده را تغییر دهد'

/** The representative's sign-in contact details (Figma 30950:17441). */
export function CompanyAccountTab({
  userId,
  representative,
  canManage,
  onChanged,
}: {
  userId: string
  representative: CompanyDetailResponse['representative']
  canManage: boolean
  onChanged: () => void | Promise<void>
}) {
  const [dialog, setDialog] = useState<'contact' | 'password' | null>(null)
  const close = () => setDialog(null)

  return (
    <>
      <DetailCard
        title="اطلاعات تماس"
        action={
          <Button
            type="button"
            variant="gray"
            size="32"
            icon={<DashboardEditIcon />}
            className="px-3"
            disabled={!canManage}
            title={canManage ? undefined : OWNER_ONLY}
            onClick={() => setDialog('contact')}
          >
            <Typography as="span" variant="14/regular" className="text-inherit">
              ویرایش
            </Typography>
          </Button>
        }
      >
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <InfoField label="شماره تلفن همراه" value={representative?.phone || '—'} />
          <InfoField label="آدرس ایمیل" value={representative?.email || '—'} />
          <InfoField label="نام نماینده" value={representative?.name || '—'} />
          <InfoField label="سمت" value={representative?.position || '—'} />
        </div>
      </DetailCard>

      <Button
        type="button"
        variant="gray"
        size="40"
        icon={<DashboardEditIcon className="size-6" />}
        className="w-fit px-4"
        disabled={!canManage}
        title={canManage ? undefined : OWNER_ONLY}
        onClick={() => setDialog('password')}
      >
        <Typography as="span" variant="16/semibold" className="text-inherit">
          تغییر رمز عبور
        </Typography>
      </Button>

      {dialog === 'contact' ? (
        <ContactDialog
          userId={userId}
          updatedAt={representative?.updatedAt}
          representative={representative}
          onClose={close}
          onSaved={onChanged}
        />
      ) : null}
      {dialog === 'password' ? (
        <PasswordDialog userId={userId} updatedAt={representative?.updatedAt} onClose={close} onSaved={onChanged} />
      ) : null}
    </>
  )
}
