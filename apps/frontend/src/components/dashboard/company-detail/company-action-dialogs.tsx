'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  MIN_PASSWORD_LENGTH,
  describeMutationFailure,
  toEnglishDigits,
} from '@/utilities/dashboard-api'
import {
  addCompanyAddress,
  deleteCompanyAddress,
  updateCompanyAddress,
  updateCompanyInfo,
  updateRepresentativeAccount,
  type AddressInput,
  type CompanyInfoInput,
} from './company-admin-api'

export interface CompanyAddress extends AddressInput {
  id: string
}

interface DialogProps {
  onClose: () => void
  /** Reloads the page's data after a change went through. */
  onSaved: () => void | Promise<void>
}

type FieldErrors<T> = Partial<Record<keyof T, string>>

/** Runs one command: closes and reloads on success, keeps the dialog and its input on a refusal. */
function useCommand({ onClose, onSaved }: DialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (
    task: () => Promise<void>,
    options: { success: string; fallback: string; messages?: Record<string, string> },
  ) => {
    setSubmitting(true)
    setError(null)
    try {
      await task()
      toast.success(options.success)
      await onSaved()
      onClose()
    } catch (cause) {
      const specific = cause instanceof DashboardApiError ? options.messages?.[cause.code] : undefined
      setError(specific ?? describeMutationFailure(cause, options.fallback))
    } finally {
      setSubmitting(false)
    }
  }
  return { submitting, error, setError, run }
}

function FormDialog({
  title,
  description,
  submitLabel,
  destructive = false,
  submitting,
  error,
  onClose,
  onSubmit,
  children,
}: {
  title: string
  description?: string
  submitLabel: string
  destructive?: boolean
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: () => void
  children?: ReactNode
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-5">
          {error ? (
            <Typography role="alert" variant="14/regular" color="error" className="rounded-lg bg-error-50 p-3">
              {error}
            </Typography>
          ) : null}
          {children}
          <DialogFooter>
            <Button type="submit" size="40" variant={destructive ? 'destructive' : 'primary'} loading={submitting} className="px-4">
              {submitLabel}
            </Button>
            <Button type="button" size="40" variant="outline-gray" disabled={submitting} onClick={onClose} className="px-4">
              انصراف
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const REVERIFICATION_NOTE = 'ثبت تغییر، تأیید احراز قبلی شرکت را باطل می‌کند و شرکت باید دوباره احراز شود.'

/** «ویرایش» of the basic information card (Figma 30537:19248). */
export function CompanyInfoDialog({
  companyId,
  company,
  ...props
}: DialogProps & { companyId: string; company: Partial<CompanyInfoInput> & { nationalId?: string } | undefined }) {
  const { submitting, error, run } = useCommand(props)
  const initial: CompanyInfoInput = {
    name: company?.name ?? '',
    establishmentDate: company?.establishmentDate ?? '',
    status: company?.status ?? '',
    type: company?.type ?? '',
    registrationNumber: company?.registrationNumber ?? '',
    economicCode: company?.economicCode ?? '',
  }
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors<CompanyInfoInput>>({})

  const bind = (field: keyof CompanyInfoInput) => ({
    value: values[field],
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [field]: event.target.value })),
    error: errors[field],
  })

  const submit = () => {
    const next: CompanyInfoInput = {
      name: values.name.trim(),
      establishmentDate: values.establishmentDate.trim(),
      status: values.status.trim(),
      type: values.type.trim(),
      registrationNumber: toEnglishDigits(values.registrationNumber.trim()),
      economicCode: toEnglishDigits(values.economicCode.trim()),
    }
    if (!next.name) return setErrors({ name: 'نام شرکت را وارد کنید.' })
    setErrors({})
    const changed = (Object.keys(next) as (keyof CompanyInfoInput)[]).filter((field) => next[field] !== initial[field])
    if (changed.length === 0) {
      props.onClose()
      return
    }
    void run(
      () => updateCompanyInfo(companyId, Object.fromEntries(changed.map((field) => [field, next[field]]))),
      {
        success: 'اطلاعات شرکت ذخیره شد.',
        fallback: 'ذخیرهٔ اطلاعات شرکت انجام نشد. دوباره تلاش کنید.',
        messages: { invalid_company: 'مقادیر واردشده معتبر نیست.' },
      },
    )
  }

  return (
    <FormDialog
      title="ویرایش اطلاعات پایه"
      description={`شناسه ملی شرکت قابل تغییر نیست. ${REVERIFICATION_NOTE}`}
      submitLabel="ذخیره"
      submitting={submitting}
      error={error}
      onClose={props.onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="نام شرکت" aria-required {...bind('name')} />
        <Input label="تاریخ تاسیس" placeholder="۱۳۹۸/۰۱/۰۱" {...bind('establishmentDate')} />
        <Input label="وضعیت شرکت" {...bind('status')} />
        <Input label="نوع شرکت" {...bind('type')} />
        <Input label="شماره ثبت" dir="ltr" inputMode="numeric" {...bind('registrationNumber')} />
        <Input label="کد اقتصادی" dir="ltr" inputMode="numeric" {...bind('economicCode')} />
      </div>
    </FormDialog>
  )
}

/** «افزودن» and «ویرایش» of one address (Figma 30537:19273). */
export function AddressDialog({
  companyId,
  address,
  ...props
}: DialogProps & { companyId: string; address?: CompanyAddress }) {
  const { submitting, error, run } = useCommand(props)
  const [values, setValues] = useState<AddressInput>({
    title: address?.title ?? '',
    province: address?.province ?? '',
    city: address?.city ?? '',
    postalCode: address?.postalCode ?? '',
    address: address?.address ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors<AddressInput>>({})

  const bind = (field: keyof AddressInput) => ({
    value: values[field],
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [field]: event.target.value })),
    error: errors[field],
  })

  const submit = () => {
    const next: AddressInput = {
      title: values.title.trim(),
      province: values.province.trim(),
      city: values.city.trim(),
      postalCode: toEnglishDigits(values.postalCode.trim()),
      address: values.address.trim(),
    }
    const found: FieldErrors<AddressInput> = {}
    if (!next.title) found.title = 'نام آدرس را وارد کنید.'
    if (!next.address) found.address = 'نشانی را وارد کنید.'
    if (next.postalCode && !/^\d{10}$/.test(next.postalCode)) found.postalCode = 'کد پستی باید ۱۰ رقم باشد.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    void run(
      () => (address ? updateCompanyAddress(companyId, address.id, next) : addCompanyAddress(companyId, next)),
      {
        success: address ? 'آدرس ذخیره شد.' : 'آدرس افزوده شد.',
        fallback: 'ذخیرهٔ آدرس انجام نشد. دوباره تلاش کنید.',
        messages: { invalid_address: 'مقادیر واردشده معتبر نیست.', not_found: 'این آدرس دیگر وجود ندارد.' },
      },
    )
  }

  return (
    <FormDialog
      title={address ? 'ویرایش آدرس' : 'آدرس جدید'}
      description={REVERIFICATION_NOTE}
      submitLabel={address ? 'ذخیره' : 'افزودن'}
      submitting={submitting}
      error={error}
      onClose={props.onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="نام آدرس" aria-required containerClassName="sm:col-span-2" {...bind('title')} />
        <Input label="استان" {...bind('province')} />
        <Input label="شهر" {...bind('city')} />
        <Input label="کد پستی" dir="ltr" inputMode="numeric" containerClassName="sm:col-span-2" {...bind('postalCode')} />
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Typography as="label" htmlFor="company-address-text" variant="16/semibold" color="neutral-700">
            نشانی
          </Typography>
          <Textarea
            id="company-address-text"
            rows={3}
            aria-required
            aria-invalid={errors.address ? true : undefined}
            value={values.address}
            onChange={(event) => setValues((current) => ({ ...current, address: event.target.value }))}
          />
          {errors.address ? (
            <Typography role="alert" variant="12/regular" color="error">
              {errors.address}
            </Typography>
          ) : null}
        </div>
      </div>
    </FormDialog>
  )
}

/** The trash button of one address. */
export function DeleteAddressDialog({
  companyId,
  address,
  ...props
}: DialogProps & { companyId: string; address: CompanyAddress }) {
  const { submitting, error, run } = useCommand(props)
  return (
    <FormDialog
      title="حذف آدرس"
      description={`آدرس «${address.title}» از پروفایل شرکت حذف می‌شود. ${REVERIFICATION_NOTE}`}
      submitLabel="حذف آدرس"
      destructive
      submitting={submitting}
      error={error}
      onClose={props.onClose}
      onSubmit={() =>
        void run(() => deleteCompanyAddress(companyId, address.id), {
          success: 'آدرس حذف شد.',
          fallback: 'حذف آدرس انجام نشد. دوباره تلاش کنید.',
          messages: { not_found: 'این آدرس دیگر وجود ندارد.' },
        })
      }
    />
  )
}

const ACCOUNT_MESSAGES = {
  stale_personnel: 'حساب نماینده پس از باز شدن صفحه تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.',
  rejected_value: 'مقدار واردشده پذیرفته نشد؛ ممکن است برای حساب دیگری ثبت شده یا معتبر نباشد.',
  forbidden: 'فقط مالک سیستم می‌تواند حساب نماینده را تغییر دهد.',
}

interface AccountTarget {
  userId: string
  /** The account's version stamp; without it the server cannot accept a change. */
  updatedAt: string | null | undefined
}

const MISSING_VERSION = 'نسخهٔ حساب نماینده در دسترس نیست. صفحه را تازه کنید.'

/** «ویرایش» of the contact card (Figma 30950:17441). */
export function ContactDialog({
  userId,
  updatedAt,
  representative,
  ...props
}: DialogProps &
  AccountTarget & { representative: { name?: string | null; phone?: string | null; email?: string | null } | undefined }) {
  const { submitting, error, setError, run } = useCommand(props)
  const initial = {
    name: representative?.name ?? '',
    phone: representative?.phone ?? '',
    email: representative?.email ?? '',
  }
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors<typeof initial>>({})

  const bind = (field: keyof typeof initial) => ({
    value: values[field],
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [field]: event.target.value })),
    error: errors[field],
  })

  const submit = () => {
    const next = {
      name: values.name.trim(),
      phone: toEnglishDigits(values.phone.trim()),
      email: values.email.trim().toLowerCase(),
    }
    const found: FieldErrors<typeof initial> = {}
    if (!next.name) found.name = 'نام نماینده را وارد کنید.'
    if (!/^09\d{9}$/.test(next.phone)) found.phone = 'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.'
    if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) found.email = 'آدرس ایمیل معتبر وارد کنید.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((field) => next[field] !== initial[field])
    if (changed.length === 0) {
      props.onClose()
      return
    }
    if (!updatedAt) return setError(MISSING_VERSION)
    void run(
      () => updateRepresentativeAccount(userId, updatedAt, Object.fromEntries(changed.map((field) => [field, next[field]]))),
      { success: 'اطلاعات تماس ذخیره شد.', fallback: 'ذخیرهٔ اطلاعات تماس انجام نشد. دوباره تلاش کنید.', messages: ACCOUNT_MESSAGES },
    )
  }

  return (
    <FormDialog
      title="ویرایش اطلاعات تماس"
      description="شماره همراه و ایمیل، اطلاعات ورود نماینده هستند."
      submitLabel="ذخیره"
      submitting={submitting}
      error={error}
      onClose={props.onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="نام نماینده" aria-required containerClassName="sm:col-span-2" {...bind('name')} />
        <Input label="شماره تلفن همراه" aria-required dir="ltr" inputMode="numeric" {...bind('phone')} />
        <Input label="آدرس ایمیل" type="email" dir="ltr" {...bind('email')} />
      </div>
    </FormDialog>
  )
}

/** «تغییر رمز عبور»: the owner sets a new password for the representative. */
export function PasswordDialog({ userId, updatedAt, ...props }: DialogProps & AccountTarget) {
  const { submitting, error, setError, run } = useCommand(props)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({})

  const submit = () => {
    const found: typeof errors = {}
    if (password.length < MIN_PASSWORD_LENGTH) {
      found.password = `رمز عبور باید دست‌کم ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه باشد.`
    }
    if (confirmation !== password) found.confirmation = 'تکرار رمز عبور با رمز واردشده یکسان نیست.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    if (!updatedAt) return setError(MISSING_VERSION)
    void run(() => updateRepresentativeAccount(userId, updatedAt, { password }), {
      success: 'رمز عبور نماینده تغییر کرد.',
      fallback: 'تغییر رمز عبور انجام نشد. دوباره تلاش کنید.',
      messages: ACCOUNT_MESSAGES,
    })
  }

  return (
    <FormDialog
      title="تغییر رمز عبور"
      description="رمز جدید جایگزین رمز فعلی نماینده می‌شود. آن را به‌صورت امن به نماینده برسانید."
      submitLabel="تغییر رمز عبور"
      submitting={submitting}
      error={error}
      onClose={props.onClose}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <Input
          label="رمز عبور جدید"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          aria-required
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Input
          label="تکرار رمز عبور"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          aria-required
          value={confirmation}
          error={errors.confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
    </FormDialog>
  )
}

/** «حذف حساب شرکت»: deactivates the representative's account, as the company list does. Nothing is erased. */
export function DeleteAccountDialog({
  userId,
  updatedAt,
  companyName,
  ...props
}: DialogProps & AccountTarget & { companyName?: string }) {
  const { submitting, error, setError, run } = useCommand(props)
  return (
    <FormDialog
      title="حذف حساب شرکت"
      description={`حساب نمایندهٔ ${companyName ? `«${companyName}»` : 'این شرکت'} غیرفعال می‌شود و دیگر نمی‌تواند وارد شود. هیچ اطلاعاتی پاک نمی‌شود.`}
      submitLabel="حذف حساب"
      destructive
      submitting={submitting}
      error={error}
      onClose={props.onClose}
      onSubmit={() => {
        if (!updatedAt) return setError(MISSING_VERSION)
        void run(() => updateRepresentativeAccount(userId, updatedAt, { isActive: false }), {
          success: 'حساب شرکت حذف شد.',
          fallback: 'حذف حساب انجام نشد. دوباره تلاش کنید.',
          messages: ACCOUNT_MESSAGES,
        })
      }}
    />
  )
}
