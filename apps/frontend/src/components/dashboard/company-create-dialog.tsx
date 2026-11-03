'use client'

import { useState, type ComponentProps } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { DashboardAddIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { Form, FormField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import {
  AccountApiError,
  createOwnerCompany,
  describeMutationFailure,
  MIN_PASSWORD_LENGTH,
  toEnglishDigits,
} from '@/utilities/dashboard-api'
import { resolver } from './owner-admin'

const companySchema = z.object({
  companyName: z.string().trim().min(1, 'نام شرکت را وارد کنید.'),
  companyNationalId: z
    .string()
    .trim()
    .transform(toEnglishDigits)
    .refine((value) => /^\d+$/.test(value), 'شناسه ملی باید فقط رقم باشد.'),
  activityDomain: z.string().trim().min(1, 'حوزه فعالیت را وارد کنید.'),
  companyType: z.string().trim(),
  name: z.string().trim().min(1, 'نام نماینده را وارد کنید.'),
  position: z.string().trim().min(1, 'سمت نماینده را وارد کنید.'),
  phone: z
    .string()
    .trim()
    .transform(toEnglishDigits)
    .refine((value) => /^09\d{9}$/.test(value), 'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.'),
  email: z.string().trim().toLowerCase().email('آدرس ایمیل معتبر وارد کنید.'),
  password: z.string().min(MIN_PASSWORD_LENGTH, `رمز موقت باید دست‌کم ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه باشد.`),
})
type CompanyValues = z.infer<typeof companySchema>
const EMPTY: CompanyValues = {
  companyName: '', companyNationalId: '', activityDomain: '', companyType: '',
  name: '', position: '', phone: '', email: '', password: '',
}

const SERVER_FIELD: Record<string, keyof CompanyValues> = {
  companyNationalId: 'companyNationalId',
  companyName: 'companyName',
  activityDomain: 'activityDomain',
  phone: 'phone',
  email: 'email',
  name: 'name',
  position: 'position',
  password: 'password',
}
const SERVER_MESSAGE: Record<string, string> = {
  duplicate_national_id: 'شرکتی با این شناسه ملی قبلاً ثبت شده است.',
  phone_taken: 'این شماره همراه برای حساب دیگری ثبت شده است.',
  email_taken: 'این ایمیل برای حساب دیگری ثبت شده است.',
  missing_field: 'این مورد الزامی است.',
  invalid_field: 'این مقدار معتبر نیست.',
}

/**
 * FE34 / T57: the System Owner enrolls a company with its representative.
 * The company starts unverified and goes through the Secretariat's review.
 */
export function CompanyCreateDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const form = useForm<CompanyValues>({ resolver: resolver(companySchema), defaultValues: EMPTY })
  const { isSubmitting } = form.formState

  const close = (next: boolean) => {
    if (next) return setOpen(true)
    if (isSubmitting) return
    form.reset(EMPTY)
    setSubmitError(null)
    setOpen(false)
  }

  const submit = async (values: CompanyValues) => {
    setSubmitError(null)
    try {
      await createOwnerCompany({ ...values, companyType: values.companyType || undefined })
      toast.success('شرکت جدید ثبت شد.')
      form.reset(EMPTY)
      setOpen(false)
      onCreated()
    } catch (cause) {
      toast.error('ثبت شرکت انجام نشد.')
      if (cause instanceof AccountApiError && cause.fieldErrors.length > 0) {
        for (const { field, code } of cause.fieldErrors) {
          const target = SERVER_FIELD[field]
          if (target) form.setError(target, { message: SERVER_MESSAGE[code] ?? 'این مقدار پذیرفته نشد.' })
        }
        setSubmitError('شرکت ثبت نشد. موارد مشخص‌شده را اصلاح کنید.')
        return
      }
      if (cause instanceof AccountApiError && cause.code === 'signup_rejected') {
        setSubmitError('شرکت با این اطلاعات ثبت نشد. شماره همراه و ایمیل نماینده را بررسی کنید.')
        return
      }
      setSubmitError(describeMutationFailure(cause, 'ثبت شرکت انجام نشد. دوباره تلاش کنید.'))
    }
  }

  const text = (name: keyof CompanyValues, label: string, extra: Partial<ComponentProps<typeof Input>> = {}) => (
    <FormField
      control={form.control}
      name={name}
      label={label}
      render={({ field, controlProps }) => <Input {...field} {...controlProps} {...extra} />}
    />
  )

  return (
    <>
      <Button size="48" icon={<DashboardAddIcon className="size-6" />} onClick={() => setOpen(true)}>
        <Typography variant="16/regular" color="white">
          شرکت جدید
        </Typography>
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ثبت شرکت جدید</DialogTitle>
            <DialogDescription>
              شرکت احرازنشده ساخته می‌شود. نماینده با رمز موقت وارد می‌شود و آن را در پروفایل تغییر می‌دهد.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5">
              {submitError && (
                <Typography role="alert" variant="14/regular" color="error" className="rounded-lg bg-error-50 p-3">
                  {submitError}
                </Typography>
              )}
              <FieldSet disabled={isSubmitting} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldLegend className="sm:col-span-2">اطلاعات شرکت</FieldLegend>
                {text('companyName', 'نام شرکت', { 'aria-required': true })}
                {text('companyNationalId', 'شناسه ملی', { dir: 'ltr', inputMode: 'numeric', 'aria-required': true })}
                {text('activityDomain', 'حوزه فعالیت', { 'aria-required': true })}
                {text('companyType', 'نوع شرکت (اختیاری)')}
              </FieldSet>
              <FieldSet disabled={isSubmitting} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldLegend className="sm:col-span-2">نماینده شرکت</FieldLegend>
                {text('name', 'نام و نام خانوادگی', { autoComplete: 'off', 'aria-required': true })}
                {text('position', 'سمت در شرکت', { 'aria-required': true })}
                {text('phone', 'شماره تلفن همراه', { type: 'tel', dir: 'ltr', inputMode: 'numeric', autoComplete: 'off', 'aria-required': true })}
                {text('email', 'آدرس ایمیل', { type: 'email', dir: 'ltr', autoComplete: 'off', 'aria-required': true })}
                {text('password', 'رمز موقت ورود', { type: 'password', dir: 'ltr', autoComplete: 'new-password', 'aria-required': true })}
              </FieldSet>
              <DialogFooter>
                <Button type="submit" size="40" loading={isSubmitting}>
                  ثبت شرکت
                </Button>
                <Button type="button" variant="outline-gray" size="40" disabled={isSubmitting} onClick={() => close(false)}>
                  انصراف
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
