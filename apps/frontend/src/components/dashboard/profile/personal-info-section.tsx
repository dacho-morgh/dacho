'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { DashboardEditIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Form, FormField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import {
  AccountApiError,
  describeMutationFailure,
  toEnglishDigits,
  updateOwnAccount,
  type OwnAccountDto,
} from '@/utilities/dashboard-api'
import { resolver } from '../owner-admin'
import { ChangePasswordDialog } from './change-password-dialog'

const accountSchema = z.object({
  name: z.string().trim().min(1, 'نام و نام خانوادگی را وارد کنید.').max(120, 'نام حداکثر ۱۲۰ نویسه است.'),
  phone: z
    .string()
    .trim()
    .transform(toEnglishDigits)
    .refine((value) => /^09\d{9}$/.test(value), 'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.'),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().email('آدرس ایمیل معتبر وارد کنید.')]),
})
type AccountValues = z.infer<typeof accountSchema>

const FIELD_ERRORS: Record<string, Record<string, string>> = {
  phone: { taken: 'این شماره همراه برای حساب دیگری ثبت شده است.', invalid: 'شماره همراه معتبر نیست.' },
  email: { taken: 'این ایمیل برای حساب دیگری ثبت شده است.', invalid: 'آدرس ایمیل معتبر نیست.' },
  name: { invalid: 'نام معتبر نیست.' },
}

/**
 * The signed-in person's own name, mobile and email (T58), for every role.
 * Role, position and identity fields are shown read-only by the caller.
 */
export function PersonalInfoSection({
  initialAccount,
  readOnlyFields = [],
}: {
  initialAccount: OwnAccountDto
  /** Fields the person may see but not change here, such as role and position. */
  readOnlyFields?: { label: string; value: string }[]
}) {
  const [account, setAccount] = useState(initialAccount)
  const [isEditing, setIsEditing] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const form = useForm<AccountValues>({ resolver: resolver(accountSchema), defaultValues: toValues(initialAccount) })
  const { isSubmitting } = form.formState

  const startEdit = () => {
    form.reset(toValues(account))
    setSubmitError(null)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    form.reset(toValues(account))
    setSubmitError(null)
    setIsEditing(false)
  }

  const save = async (values: AccountValues) => {
    setSubmitError(null)
    const changes: Partial<Record<keyof AccountValues, string>> = {}
    for (const field of Object.keys(values) as (keyof AccountValues)[]) {
      if (values[field] !== (account[field] ?? '')) changes[field] = values[field]
    }
    if (Object.keys(changes).length === 0) {
      setIsEditing(false)
      return
    }
    try {
      const saved = await updateOwnAccount({ ...changes, expectedUpdatedAt: account.updatedAt })
      setAccount(saved)
      form.reset(toValues(saved))
      setIsEditing(false)
      toast.success('اطلاعات کاربری ذخیره شد.')
    } catch (cause) {
      toast.error('ذخیره اطلاعات کاربری انجام نشد.')
      if (cause instanceof AccountApiError && cause.fieldErrors.length > 0) {
        for (const { field, code } of cause.fieldErrors) {
          if (field === 'name' || field === 'phone' || field === 'email') {
            form.setError(field, { message: FIELD_ERRORS[field]?.[code] ?? 'این مقدار پذیرفته نشد.' })
          }
        }
        setSubmitError('برخی از مقادیر پذیرفته نشد. موارد مشخص‌شده را اصلاح کنید.')
        return
      }
      setSubmitError(describeMutationFailure(cause, 'ذخیره اطلاعات کاربری انجام نشد. دوباره تلاش کنید.'))
    }
  }

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <section
        aria-labelledby="personal-info-title"
        className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Typography as="h2" id="personal-info-title" variant="20/bold" color="neutral-600">
              اطلاعات کاربری
            </Typography>
            <Typography className="mt-1" variant="14/regular" color="neutral-400">
              شماره همراه و ایمیل برای ورود به سامانه هم استفاده می‌شوند.
            </Typography>
          </div>
          {!isEditing && (
            <Button type="button" variant="gray" size="32" onClick={startEdit}>
              <DashboardEditIcon className="size-5" />
              ویرایش
            </Button>
          )}
        </div>

        {submitError && (
          <Typography role="alert" variant="14/regular" color="error" className="rounded-lg bg-error-50 p-3">
            {submitError}
          </Typography>
        )}

        {isEditing ? (
          <Form {...form}>
            <form noValidate onSubmit={form.handleSubmit(save)} className="flex flex-col gap-5">
              <fieldset disabled={isSubmitting} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  label="نام و نام خانوادگی"
                  render={({ field, controlProps }) => (
                    <Input {...field} {...controlProps} autoComplete="name" aria-required="true" />
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  label="شماره تلفن همراه"
                  render={({ field, controlProps }) => (
                    <Input {...field} {...controlProps} type="tel" dir="ltr" autoComplete="tel" inputMode="numeric" aria-required="true" />
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  label="آدرس ایمیل"
                  render={({ field, controlProps }) => (
                    <Input {...field} {...controlProps} type="email" dir="ltr" autoComplete="email" />
                  )}
                />
              </fieldset>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
                <Button type="submit" size="40" loading={isSubmitting}>
                  ذخیره
                </Button>
                <Button type="button" variant="outline-gray" size="40" disabled={isSubmitting} onClick={cancelEdit}>
                  انصراف
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadOnlyField label="نام و نام خانوادگی" value={account.name} />
            <ReadOnlyField label="شماره تلفن همراه" value={account.phone} dir="ltr" />
            <ReadOnlyField label="آدرس ایمیل" value={account.email} dir="ltr" />
            {readOnlyFields.map((item) => (
              <ReadOnlyField key={item.label} label={item.label} value={item.value} />
            ))}
          </dl>
        )}
        {isEditing && readOnlyFields.length > 0 && (
          <dl className="grid grid-cols-1 gap-4 border-t border-neutral-100 pt-4 md:grid-cols-2">
            {readOnlyFields.map((item) => (
              <ReadOnlyField key={item.label} label={item.label} value={item.value} />
            ))}
          </dl>
        )}
      </section>

      <section
        aria-labelledby="password-title"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6"
      >
        <div>
          <Typography as="h2" id="password-title" variant="20/bold" color="neutral-600">
            رمز عبور
          </Typography>
          <Typography className="mt-1" variant="14/regular" color="neutral-400">
            برای تغییر رمز، رمز فعلی را وارد کنید. پس از تغییر، نشست‌های دیگر شما بسته می‌شوند.
          </Typography>
        </div>
        <Button type="button" variant="outline-gray" size="40" onClick={() => setPasswordOpen(true)}>
          تغییر رمز عبور
        </Button>
      </section>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  )
}

function toValues(account: OwnAccountDto): AccountValues {
  return { name: account.name ?? '', phone: account.phone ?? '', email: account.email ?? '' }
}

function ReadOnlyField({ label, value, dir }: { label: string; value: string; dir?: 'ltr' }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 p-3 text-start">
      <Typography as="dt" variant="14/semibold" color="neutral-400">
        {label}
      </Typography>
      <Typography as="dd" color="neutral-700" dir={value ? dir : undefined} className="text-start">
        {value || '—'}
      </Typography>
    </div>
  )
}
