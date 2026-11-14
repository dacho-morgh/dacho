'use client'

import { useId, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import { AdminError } from '../owner-admin'
import { setEmployeePassword, type Employee } from './employee-data'

/** Matches the server's minimum for a password (MIN_PASSWORD_LENGTH). */
const MIN_PASSWORD_LENGTH = 8

function failureMessage(cause: unknown): string {
  if (cause instanceof AdminError) {
    if (cause.status === 400 && cause.data?.error === 'weak_password')
      return `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه باشد.`
    if (cause.status === 403) return 'اجازه تغییر رمز عبور را ندارید.'
    if (cause.status === 404) return 'این کارمند دیگر در دسترس نیست.'
    if (cause.status === 409) return 'اطلاعات این کارمند پس از باز شدن صفحه تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.'
  }
  return 'تغییر رمز عبور انجام نشد. دوباره تلاش کنید.'
}

/**
 * The owner's «تغییر رمز عبور» for an employee: a new password typed twice. Saving replaces the password and
 * signs the employee out everywhere, so they log in again with the new one.
 */
export function ChangePasswordDialog({
  employee,
  open,
  onOpenChange,
  onChanged,
}: {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: (employee: Employee) => void
}) {
  const id = useId()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const close = (next: boolean) => {
    if (busy) return
    if (!next) {
      setPassword('')
      setRepeat('')
      setError(null)
    }
    onOpenChange(next)
  }

  const submit = async () => {
    if (busy) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه باشد.`)
      return
    }
    if (password !== repeat) {
      setError('تکرار رمز عبور با رمز عبور یکسان نیست.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await setEmployeePassword(employee, password)
      toast.success('رمز عبور کارمند تغییر کرد.')
      onChanged(updated)
      setPassword('')
      setRepeat('')
      onOpenChange(false)
    } catch (cause) {
      toast.error('تغییر رمز عبور انجام نشد.')
      setError(failureMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="flex flex-col gap-1">
            <DialogTitle>تغییر رمز عبور</DialogTitle>
            <DialogDescription>
              رمز عبور جدید {employee.name || 'کارمند'} را وارد کنید. کارمند از همه دستگاه‌ها خارج می‌شود و باید با رمز جدید وارد شود.
            </DialogDescription>
          </div>

          <div className="flex flex-col gap-2">
            <Typography as="label" htmlFor={`${id}-password`} variant="16/semibold" color="neutral-700">
              رمز عبور جدید
            </Typography>
            <Input
              id={`${id}-password`}
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={busy}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Typography as="label" htmlFor={`${id}-repeat`} variant="16/semibold" color="neutral-700">
              تکرار رمز عبور جدید
            </Typography>
            <Input
              id={`${id}-repeat`}
              type="password"
              autoComplete="new-password"
              value={repeat}
              disabled={busy}
              onChange={(event) => setRepeat(event.target.value)}
            />
          </div>

          {error ? (
            <Typography id={`${id}-error`} role="alert" variant="14/regular" color="error">
              {error}
            </Typography>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" size="40" className="flex-1" loading={busy} disabled={busy}>
              ذخیره رمز عبور
            </Button>
            <Button type="button" variant="outline-primary" size="40" className="flex-1" disabled={busy} onClick={() => close(false)}>
              لغو
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
