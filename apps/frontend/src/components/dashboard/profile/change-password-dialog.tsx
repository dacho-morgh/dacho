'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import {
  AccountApiError,
  changeOwnPassword,
  describeMutationFailure,
  MIN_PASSWORD_LENGTH,
} from '@/utilities/dashboard-api'
import { resolver } from '../owner-admin'

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'رمز فعلی را وارد کنید.'),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, `رمز جدید باید دست‌کم ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه باشد.`),
    confirmPassword: z.string(),
  })
  .superRefine((values, context) => {
    if (values.confirmPassword !== values.newPassword) {
      context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'تکرار رمز با رمز جدید یکسان نیست.' })
    }
    if (values.newPassword && values.newPassword === values.currentPassword) {
      context.addIssue({ code: 'custom', path: ['newPassword'], message: 'رمز جدید باید با رمز فعلی متفاوت باشد.' })
    }
  })
type PasswordValues = z.infer<typeof passwordSchema>
const EMPTY: PasswordValues = { currentPassword: '', newPassword: '', confirmPassword: '' }

/** Password change with the current password (T58). */
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useForm<PasswordValues>({ resolver: resolver(passwordSchema), defaultValues: EMPTY })
  const { isSubmitting } = form.formState
  const [submitError, setSubmitError] = useState<string | null>(null)

  const close = (next: boolean) => {
    if (next || isSubmitting) return
    form.reset(EMPTY)
    setSubmitError(null)
    onOpenChange(false)
  }

  const submit = async ({ currentPassword, newPassword }: PasswordValues) => {
    setSubmitError(null)
    try {
      await changeOwnPassword({ currentPassword, newPassword })
      toast.success('رمز عبور تغییر کرد.')
      form.reset(EMPTY)
      onOpenChange(false)
    } catch (cause) {
      toast.error('تغییر رمز عبور انجام نشد.')
      if (cause instanceof AccountApiError && cause.code === 'invalid_current_password') {
        form.setError('currentPassword', { message: 'رمز فعلی درست نیست.' })
        setSubmitError('رمز فعلی درست نیست؛ رمز عبور تغییر نکرد.')
        return
      }
      if (cause instanceof AccountApiError && (cause.code === 'weak_password' || cause.code === 'same_password')) {
        form.setError('newPassword', {
          message: cause.code === 'same_password'
            ? 'رمز جدید باید با رمز فعلی متفاوت باشد.'
            : `رمز جدید باید دست‌کم ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه باشد.`,
        })
        setSubmitError('رمز جدید پذیرفته نشد.')
        return
      }
      setSubmitError(describeMutationFailure(cause, 'تغییر رمز عبور انجام نشد. دوباره تلاش کنید.'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تغییر رمز عبور</DialogTitle>
          <DialogDescription>پس از تغییر رمز، از دستگاه‌ها و نشست‌های دیگر خارج می‌شوید.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5">
            {submitError && (
              <Typography role="alert" variant="14/regular" color="error" className="rounded-lg bg-error-50 p-3">
                {submitError}
              </Typography>
            )}
            <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="currentPassword"
                label="رمز فعلی"
                render={({ field, controlProps }) => (
                  <Input {...field} {...controlProps} type="password" dir="ltr" autoComplete="current-password" aria-required="true" />
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                label="رمز جدید"
                description={`دست‌کم ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه`}
                render={({ field, controlProps }) => (
                  <Input {...field} {...controlProps} type="password" dir="ltr" autoComplete="new-password" aria-required="true" />
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                label="تکرار رمز جدید"
                render={({ field, controlProps }) => (
                  <Input {...field} {...controlProps} type="password" dir="ltr" autoComplete="new-password" aria-required="true" />
                )}
              />
            </fieldset>
            <DialogFooter>
              <Button type="submit" size="40" loading={isSubmitting}>
                تغییر رمز
              </Button>
              <Button type="button" variant="outline-gray" size="40" disabled={isSubmitting} onClick={() => close(false)}>
                انصراف
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
