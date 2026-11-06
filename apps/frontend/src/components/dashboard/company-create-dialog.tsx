'use client'

import { useState, useTransition, type ComponentProps } from 'react'
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

const required = (message: string) => z.string().trim().min(1, message)

// One message per field: the first problem found, so the field never lists two at once.
const companySchema = z.object({
  companyName: required('نام شرکت را وارد کنید.'),
  companyNationalId: z
    .string()
    .trim()
    .transform(toEnglishDigits)
    .superRefine((value, ctx) => {
      if (!value) ctx.addIssue({ code: 'custom', message: 'شناسه ملی شرکت را وارد کنید.' })
      else if (!/^\d+$/.test(value)) ctx.addIssue({ code: 'custom', message: 'شناسه ملی باید فقط رقم باشد.' })
    }),
  activityDomain: required('حوزه فعالیت را وارد کنید.'),
  companyType: z.string().trim(),
  name: required('نام و نام خانوادگی نماینده را وارد کنید.'),
  position: required('سمت نماینده در شرکت را وارد کنید.'),
  phone: z
    .string()
    .trim()
    .transform(toEnglishDigits)
    .superRefine((value, ctx) => {
      if (!value) ctx.addIssue({ code: 'custom', message: 'شماره همراه نماینده را وارد کنید.' })
      else if (!/^09\d{9}$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: 'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.' })
      }
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .superRefine((value, ctx) => {
      if (!value) ctx.addIssue({ code: 'custom', message: 'آدرس ایمیل نماینده را وارد کنید.' })
      else if (!z.email().safeParse(value).success) {
        ctx.addIssue({ code: 'custom', message: 'آدرس ایمیل معتبر وارد کنید، مثلاً name@example.com.' })
      }
    }),
  password: z.string().superRefine((value, ctx) => {
    if (!value) ctx.addIssue({ code: 'custom', message: 'رمز موقت ورود را وارد کنید.' })
    else if (value.length < MIN_PASSWORD_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        message: `رمز موقت باید دست‌کم ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه باشد.`,
      })
    }
  }),
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
export function CompanyCreateDialog({
  onCreated,
  onOptimisticCreate,
}: {
  /** Reloads the list; the new company stays on screen until it resolves. */
  onCreated: () => void | Promise<void>
  /** Shows the new company at once (e.g. through `useOptimistic`), before the server has answered. */
  onOptimisticCreate?: (values: CompanyValues) => void
}) {
  const [open, setOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [creating, startCreating] = useTransition()
  const form = useForm<CompanyValues>({
    resolver: resolver(companySchema),
    defaultValues: EMPTY,
    // A field is checked when it is left, then again on every change, so its message goes as soon as it is fixed.
    mode: 'onTouched',
  })

  const close = (next: boolean) => {
    if (next) return setOpen(true)
    form.reset(EMPTY)
    setSubmitError(null)
    setOpen(false)
  }

  // The dialog closes at once and the company appears in the list; if the server refuses it, the
  // row goes away again and the dialog reopens, with what was typed and the reasons.
  const submit = (values: CompanyValues) => {
    setSubmitError(null)
    setOpen(false)
    startCreating(async () => {
      onOptimisticCreate?.(values)
      try {
        await createOwnerCompany({ ...values, companyType: values.companyType || undefined })
        toast.success('شرکت جدید ثبت شد.')
        form.reset(EMPTY)
        await onCreated()
      } catch (cause) {
        toast.error('ثبت شرکت انجام نشد.')
        if (cause instanceof AccountApiError && cause.fieldErrors.length > 0) {
          for (const { field, code } of cause.fieldErrors) {
            const target = SERVER_FIELD[field]
            if (target) form.setError(target, { message: SERVER_MESSAGE[code] ?? 'این مقدار پذیرفته نشد.' })
          }
          setSubmitError('شرکت ثبت نشد. موارد مشخص‌شده را اصلاح کنید.')
        } else if (cause instanceof AccountApiError && cause.code === 'signup_rejected') {
          setSubmitError('شرکت با این اطلاعات ثبت نشد. شماره همراه و ایمیل نماینده را بررسی کنید.')
        } else {
          setSubmitError(describeMutationFailure(cause, 'ثبت شرکت انجام نشد. دوباره تلاش کنید.'))
        }
        setOpen(true)
      }
    })
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
      <Button
        size="48"
        className="w-full min-w-0 shrink sm:w-auto sm:shrink-0"
        loading={creating}
        onClick={() => setOpen(true)}
      >
        <DashboardAddIcon className="size-5 sm:size-6" />
        <Typography variant="16/regular" color="white" className="max-sm:text-sm">
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
              <FieldSet className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldLegend className="sm:col-span-2">اطلاعات شرکت</FieldLegend>
                {text('companyName', 'نام شرکت', { placeholder: 'مثلاً شرکت فناوران انرژی بوشهر', 'aria-required': true })}
                {text('companyNationalId', 'شناسه ملی', { placeholder: 'مثلاً 10101010101', dir: 'ltr', inputMode: 'numeric', 'aria-required': true })}
                {text('activityDomain', 'حوزه فعالیت', { placeholder: 'مثلاً تجهیزات نفت و گاز', 'aria-required': true })}
                {text('companyType', 'نوع شرکت (اختیاری)', { placeholder: 'مثلاً سهامی خاص' })}
              </FieldSet>
              <FieldSet className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldLegend className="sm:col-span-2">نماینده شرکت</FieldLegend>
                {text('name', 'نام و نام خانوادگی', { placeholder: 'مثلاً علی رضایی', autoComplete: 'off', 'aria-required': true })}
                {text('position', 'سمت در شرکت', { placeholder: 'مثلاً مدیرعامل', 'aria-required': true })}
                {text('phone', 'شماره تلفن همراه', { placeholder: '09123456789', type: 'tel', dir: 'ltr', inputMode: 'numeric', autoComplete: 'off', 'aria-required': true })}
                {text('email', 'آدرس ایمیل', { placeholder: 'name@example.com', type: 'email', dir: 'ltr', autoComplete: 'off', 'aria-required': true })}
                {text('password', 'رمز موقت ورود', { placeholder: 'دست‌کم ۸ نویسه', type: 'password', dir: 'ltr', autoComplete: 'new-password', 'aria-required': true })}
              </FieldSet>
              <DialogFooter>
                <Button type="submit" size="40">
                  ثبت شرکت
                </Button>
                <Button type="button" variant="outline-gray" size="40" onClick={() => close(false)}>
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
