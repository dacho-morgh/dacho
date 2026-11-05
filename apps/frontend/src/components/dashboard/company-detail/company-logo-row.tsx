'use client'

import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { CompanyBuildingIcon, DashboardTrashIcon, UploadIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { FileInput } from '@/components/ui/file-input'
import { Typography } from '@/components/ui/typography'
import { DashboardApiError, describeMutationFailure } from '@/utilities/dashboard-api'
import {
  COMPANY_LOGO_MAX_BYTES,
  COMPANY_LOGO_MIME_TYPES,
  removeCompanyLogo,
  uploadCompanyLogo,
} from './company-admin-api'

/** The company logo with its upload and removal buttons (Figma 30537:19247). */
export function CompanyLogoRow({
  companyId,
  companyName,
  logo,
  onChanged,
  children,
}: {
  companyId: string
  companyName?: string
  logo: { id: string; url: string } | null | undefined
  onChanged: () => void | Promise<void>
  /** What closes the row, e.g. the verification status. */
  children?: ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)

  const run = async (kind: 'upload' | 'remove', task: () => Promise<void>, success: string, fallback: string) => {
    setBusy(kind)
    try {
      await task()
      toast.success(success)
      await onChanged()
    } catch (cause) {
      toast.error(
        cause instanceof DashboardApiError && cause.code === 'logo_too_large'
          ? 'حجم لوگو حداکثر ۲ مگابایت است.'
          : describeMutationFailure(cause, fallback),
      )
    } finally {
      setBusy(null)
    }
  }

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!COMPANY_LOGO_MIME_TYPES.includes(file.type)) return void toast.error('لوگو باید تصویر PNG، JPG یا WebP باشد.')
    if (file.size > COMPANY_LOGO_MAX_BYTES) return void toast.error('حجم لوگو حداکثر ۲ مگابایت است.')
    void run('upload', () => uploadCompanyLogo(companyId, file), 'لوگوی شرکت ذخیره شد.', 'ذخیرهٔ لوگو انجام نشد. دوباره تلاش کنید.')
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {logo ? (
        <Image
          src={logo.url}
          alt={companyName ? `لوگوی ${companyName}` : 'لوگوی شرکت'}
          width={80}
          height={80}
          // The file route is access-checked by the session cookie, which the image optimizer would not send.
          unoptimized
          className="size-20 rounded-2xl object-cover"
        />
      ) : (
        <span className="flex size-20 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
          <CompanyBuildingIcon className="size-8" aria-hidden="true" />
          <span className="sr-only">لوگو ثبت نشده است</span>
        </span>
      )}
      {/* Small screens: compact buttons with short names keep the logo and both buttons on one line. */}
      <div className="flex items-center gap-2 sm:flex-wrap">
        {/* The picker is driven by the button below, so the native control stays visually hidden. */}
        <div className="sr-only">
          <FileInput
            ref={input}
            accept={COMPANY_LOGO_MIME_TYPES.join(',')}
            tabIndex={-1}
            aria-label="انتخاب لوگوی جدید"
            onChange={pick}
          />
        </div>
        <Button
          type="button"
          variant="outline-gray"
          size="32"
          sm="40"
          icon={<UploadIcon aria-hidden="true" />}
          className="px-2 sm:px-4"
          loading={busy === 'upload'}
          disabled={busy !== null}
          onClick={() => input.current?.click()}
        >
          <Typography as="span" variant="16/semibold" className="text-inherit sm:hidden">
            آپلود جدید
          </Typography>
          <Typography as="span" variant="16/semibold" className="hidden text-inherit sm:inline">
            آپلود پروفایل جدید
          </Typography>
        </Button>
        <Button
          type="button"
          variant="text-destructive"
          size="32"
          sm="40"
          icon={<DashboardTrashIcon aria-hidden="true" />}
          className="px-2 sm:px-4"
          loading={busy === 'remove'}
          disabled={!logo || busy !== null}
          onClick={() => void run('remove', () => removeCompanyLogo(companyId), 'لوگوی شرکت حذف شد.', 'حذف لوگو انجام نشد. دوباره تلاش کنید.')}
        >
          <Typography as="span" variant="16/semibold" className="text-inherit sm:hidden">
            حذف
          </Typography>
          <Typography as="span" variant="16/semibold" className="hidden text-inherit sm:inline">
            حذف پروفایل
          </Typography>
        </Button>
      </div>
      {children}
    </div>
  )
}
