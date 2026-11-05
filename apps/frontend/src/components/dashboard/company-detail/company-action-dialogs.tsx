'use client'

import { useState, type ComponentProps, type ReactNode } from 'react'
import { useForm, type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { resolver } from '@/components/dashboard/owner-admin'
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
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  MIN_PASSWORD_LENGTH,
  describeMutationFailure,
  toEnglishDigits,
} from '@/utilities/dashboard-api'
import { updateRepresentativeAccount, type AddressInput, type CompanyInfoInput } from './company-admin-api'

export interface CompanyAddress extends AddressInput {
  id: string
}

/* ── Validation ─────────────────────────────────────────────────────────── */

const MAX = 200
const trimmed = z.string().trim()
const digitsOnly = (label: string, length?: readonly number[]) =>
  trimmed.transform(toEnglishDigits).superRefine((value, ctx) => {
    if (!value) return
    if (!/^\d+$/.test(value)) ctx.addIssue({ code: 'custom', message: `${label} باید فقط رقم باشد.` })
    else if (length && !length.includes(value.length)) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} باید ${length.map((item) => item.toLocaleString('fa-IR')).join(' یا ')} رقم باشد.`,
      })
    }
  })

/** «۱۳۹۸/۰۱/۲۵»: Latin digits, slashes and two-digit month and day. */
const normalizeDate = (value: string) => {
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(toEnglishDigits(value))
  return match ? `${match[1]}/${match[2]!.padStart(2, '0')}/${match[3]!.padStart(2, '0')}` : value
}

const companyInfoSchema = z.object({
  name: trimmed.min(1, 'نام شرکت را وارد کنید.').max(MAX, `نام شرکت حداکثر ${MAX.toLocaleString('fa-IR')} نویسه است.`),
  establishmentDate: trimmed
    .superRefine((value, ctx) => {
      if (value && !/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(toEnglishDigits(value))) {
        ctx.addIssue({ code: 'custom', message: 'تاریخ را به شکل ۱۳۹۸/۰۱/۲۵ وارد کنید.' })
      }
    })
    .transform(normalizeDate),
  status: trimmed.max(MAX, 'وضعیت بیش از حد طولانی است.'),
  type: trimmed.max(MAX, 'نوع شرکت بیش از حد طولانی است.'),
  registrationNumber: digitsOnly('شماره ثبت'),
  economicCode: digitsOnly('کد اقتصادی', [12, 14]),
})
export type CompanyInfoValues = z.infer<typeof companyInfoSchema> & CompanyInfoInput

const addressSchema = z.object({
  title: trimmed.min(1, 'نام آدرس را وارد کنید.').max(100, 'نام آدرس بیش از حد طولانی است.'),
  province: trimmed.max(100, 'نام استان بیش از حد طولانی است.'),
  city: trimmed.max(100, 'نام شهر بیش از حد طولانی است.'),
  postalCode: digitsOnly('کد پستی', [10]),
  address: trimmed.min(1, 'نشانی را وارد کنید.').max(500, 'نشانی بیش از حد طولانی است.'),
})
export type AddressValues = z.infer<typeof addressSchema>

const contactSchema = z.object({
  name: trimmed.min(1, 'نام نماینده را وارد کنید.').max(MAX, 'نام بیش از حد طولانی است.'),
  phone: trimmed.transform(toEnglishDigits).superRefine((value, ctx) => {
    if (!value) ctx.addIssue({ code: 'custom', message: 'شماره همراه نماینده را وارد کنید.' })
    else if (!/^09\d{9}$/.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.' })
    }
  }),
  email: trimmed.toLowerCase().superRefine((value, ctx) => {
    if (value && !z.email().safeParse(value).success) {
      ctx.addIssue({ code: 'custom', message: 'آدرس ایمیل معتبر وارد کنید، مثلاً name@example.com.' })
    }
  }),
})
export type ContactValues = z.infer<typeof contactSchema>

const passwordSchema = z
  .object({ password: z.string(), confirmation: z.string() })
  .superRefine((value, ctx) => {
    if (!value.password) ctx.addIssue({ code: 'custom', path: ['password'], message: 'رمز عبور جدید را وارد کنید.' })
    else if (value.password.length < MIN_PASSWORD_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: `رمز عبور باید دست‌کم ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه باشد.`,
      })
    }
    if (value.confirmation !== value.password) {
      ctx.addIssue({ code: 'custom', path: ['confirmation'], message: 'تکرار رمز عبور با رمز واردشده یکسان نیست.' })
    }
  })
export type PasswordValues = z.infer<typeof passwordSchema>

/* ── Refusals ───────────────────────────────────────────────────────────── */

const MESSAGES: Record<string, string> = {
  invalid_company: 'مقادیر واردشده معتبر نیست.',
  invalid_address: 'مقادیر واردشده معتبر نیست.',
  not_found: 'این مورد دیگر وجود ندارد. صفحه را تازه کنید.',
  stale_personnel: 'حساب نماینده پس از باز شدن صفحه تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.',
  rejected_value: 'مقدار واردشده پذیرفته نشد؛ ممکن است برای حساب دیگری ثبت شده یا معتبر نباشد.',
  logo_too_large: 'حجم لوگو حداکثر ۲ مگابایت است.',
}

/** What a refused command means to the person, keeping the typed input on screen. */
export function describeCommandError(cause: unknown, fallback: string): string {
  if (cause instanceof DashboardApiError && MESSAGES[cause.code] && cause.status !== 403) return MESSAGES[cause.code]!
  return describeMutationFailure(cause, fallback)
}

/* ── Shared dialog parts ────────────────────────────────────────────────── */

const REVERIFICATION_NOTE = 'ثبت تغییر، تأیید احراز قبلی شرکت را باطل می‌کند و شرکت باید دوباره احراز شود.'

/** A dialog that is opened with what the person typed before a refusal, and the refusal itself. */
interface FormDialogProps<T> {
  initial: T
  error?: string | null
  onClose: () => void
  /** Called with the validated values; the caller closes the dialog and runs the command. */
  onSubmit: (values: T) => void
}

function FormDialog<T extends FieldValues>({
  form,
  title,
  description,
  submitLabel,
  destructive = false,
  error,
  onClose,
  onSubmit,
  children,
}: {
  form: UseFormReturn<T>
  title: string
  description?: string
  submitLabel: string
  destructive?: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (values: T) => void
  children?: ReactNode
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {error ? (
              <Typography role="alert" variant="14/regular" color="error" className="rounded-lg bg-error-50 p-3">
                {error}
              </Typography>
            ) : null}
            {children}
            <DialogFooter>
              <Button type="submit" size="40" variant={destructive ? 'destructive' : 'primary'} className="px-4">
                {submitLabel}
              </Button>
              <Button type="button" size="40" variant="outline-gray" onClick={onClose} className="px-4">
                انصراف
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function TextField<T extends FieldValues>({
  methods,
  name,
  label,
  className,
  ...input
}: {
  methods: UseFormReturn<T>
  name: FieldPath<T>
  label: string
  className?: string
} & Omit<ComponentProps<typeof Input>, 'name' | 'label' | 'className' | 'form'>) {
  return (
    <FormField
      control={methods.control}
      name={name}
      label={label}
      className={className}
      render={({ field, controlProps }) => <Input {...field} {...controlProps} {...input} />}
    />
  )
}

function useValidatedForm<T extends FieldValues>(schema: z.ZodType<T>, initial: T) {
  return useForm<T>({
    resolver: resolver(schema),
    defaultValues: initial as never,
    // A field is checked when it is left, then again on every change, so its message goes as soon as it is fixed.
    mode: 'onTouched',
  })
}

/* ── Dialogs ────────────────────────────────────────────────────────────── */

/** «ویرایش» of the basic information card (Figma 30537:19248). */
export function CompanyInfoDialog({ initial, error, onClose, onSubmit }: FormDialogProps<CompanyInfoValues>) {
  const form = useValidatedForm<CompanyInfoValues>(companyInfoSchema as z.ZodType<CompanyInfoValues>, initial)
  return (
    <FormDialog
      form={form}
      title="ویرایش اطلاعات پایه"
      description={`شناسه ملی شرکت قابل تغییر نیست. ${REVERIFICATION_NOTE}`}
      submitLabel="ذخیره"
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField methods={form} name="name" label="نام شرکت" placeholder="مثلاً شرکت فناوران انرژی بوشهر" aria-required />
        <TextField methods={form} name="establishmentDate" label="تاریخ تاسیس" placeholder="۱۳۹۸/۰۱/۲۵" dir="ltr" inputMode="numeric" />
        <TextField methods={form} name="status" label="وضعیت شرکت" placeholder="مثلاً فعال" />
        <TextField methods={form} name="type" label="نوع شرکت" placeholder="مثلاً سهامی خاص" />
        <TextField methods={form} name="registrationNumber" label="شماره ثبت" placeholder="مثلاً ۱۵۷۸۱" dir="ltr" inputMode="numeric" />
        <TextField methods={form} name="economicCode" label="کد اقتصادی" placeholder="۱۲ یا ۱۴ رقم" dir="ltr" inputMode="numeric" />
      </div>
    </FormDialog>
  )
}

/** «افزودن» and «ویرایش» of one address (Figma 30537:19273). */
export function AddressDialog({
  isNew,
  initial,
  error,
  onClose,
  onSubmit,
}: FormDialogProps<AddressValues> & { isNew: boolean }) {
  const form = useValidatedForm<AddressValues>(addressSchema as z.ZodType<AddressValues>, initial)
  return (
    <FormDialog
      form={form}
      title={isNew ? 'آدرس جدید' : 'ویرایش آدرس'}
      description={REVERIFICATION_NOTE}
      submitLabel={isNew ? 'افزودن' : 'ذخیره'}
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField methods={form} name="title" label="نام آدرس" placeholder="مثلاً دفتر مرکزی" aria-required className="sm:col-span-2" />
        <TextField methods={form} name="province" label="استان" placeholder="مثلاً بوشهر" />
        <TextField methods={form} name="city" label="شهر" placeholder="مثلاً بوشهر" />
        <TextField methods={form} name="postalCode" label="کد پستی" placeholder="۱۰ رقم، مثلاً ۷۵۱۴۷۱۲۳۴۵" dir="ltr" inputMode="numeric" className="sm:col-span-2" />
        <FormField
          control={form.control}
          name="address"
          label="نشانی"
          className="sm:col-span-2"
          render={({ field, controlProps }) => (
            <Textarea {...field} {...controlProps} rows={3} aria-required placeholder="مثلاً بوشهر، بلوار ساحلی، پلاک ۱۲" />
          )}
        />
      </div>
    </FormDialog>
  )
}

/** The trash button of one address. */
export function DeleteAddressDialog({
  address,
  error,
  onClose,
  onConfirm,
}: {
  address: CompanyAddress
  error?: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  const form = useForm({ defaultValues: {} })
  return (
    <FormDialog
      form={form}
      title="حذف آدرس"
      description={`آدرس «${address.title}» از پروفایل شرکت حذف می‌شود. ${REVERIFICATION_NOTE}`}
      submitLabel="حذف آدرس"
      destructive
      error={error}
      onClose={onClose}
      onSubmit={onConfirm}
    />
  )
}

/** «ویرایش» of the contact card (Figma 30950:17441). */
export function ContactDialog({ initial, error, onClose, onSubmit }: FormDialogProps<ContactValues>) {
  const form = useValidatedForm<ContactValues>(contactSchema as z.ZodType<ContactValues>, initial)
  return (
    <FormDialog
      form={form}
      title="ویرایش اطلاعات تماس"
      description="شماره همراه و ایمیل، اطلاعات ورود نماینده هستند."
      submitLabel="ذخیره"
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField methods={form} name="name" label="نام نماینده" placeholder="مثلاً علی رضایی" aria-required className="sm:col-span-2" />
        <TextField methods={form} name="phone" label="شماره تلفن همراه" placeholder="09123456789" type="tel" dir="ltr" inputMode="numeric" aria-required />
        <TextField methods={form} name="email" label="آدرس ایمیل" placeholder="name@example.com" type="email" dir="ltr" />
      </div>
    </FormDialog>
  )
}

/** «تغییر رمز عبور»: the owner sets a new password for the representative. */
export function PasswordDialog({ error, onClose, onSubmit }: Omit<FormDialogProps<PasswordValues>, 'initial'>) {
  const form = useValidatedForm<PasswordValues>(passwordSchema as z.ZodType<PasswordValues>, {
    password: '',
    confirmation: '',
  })
  return (
    <FormDialog
      form={form}
      title="تغییر رمز عبور"
      description="رمز جدید جایگزین رمز فعلی نماینده می‌شود. آن را به‌صورت امن به نماینده برسانید."
      submitLabel="تغییر رمز عبور"
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-4">
        <TextField methods={form} name="password" label="رمز عبور جدید" placeholder="دست‌کم ۸ نویسه" type="password" dir="ltr" autoComplete="new-password" aria-required />
        <TextField methods={form} name="confirmation" label="تکرار رمز عبور" placeholder="رمز عبور جدید را دوباره وارد کنید" type="password" dir="ltr" autoComplete="new-password" aria-required />
      </div>
    </FormDialog>
  )
}

/**
 * «حذف حساب شرکت»: deactivates the representative's account, as the company list does; nothing is
 * erased. It is not shown optimistically: the dialog waits for the server, since the page is left.
 */
export function DeleteAccountDialog({
  userId,
  updatedAt,
  companyName,
  onClose,
  onSaved,
}: {
  userId: string
  /** The account's version stamp; without it the server cannot accept a change. */
  updatedAt: string | null | undefined
  companyName?: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const form = useForm({ defaultValues: {} })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    if (!updatedAt) return setError('نسخهٔ حساب نماینده در دسترس نیست. صفحه را تازه کنید.')
    setPending(true)
    setError(null)
    try {
      await updateRepresentativeAccount(userId, updatedAt, { isActive: false })
      toast.success('حساب شرکت حذف شد.')
      await onSaved()
      onClose()
    } catch (cause) {
      setError(describeCommandError(cause, 'حذف حساب انجام نشد. دوباره تلاش کنید.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <FormDialog
      form={form}
      title="حذف حساب شرکت"
      description={`حساب نمایندهٔ ${companyName ? `«${companyName}»` : 'این شرکت'} غیرفعال می‌شود و دیگر نمی‌تواند وارد شود. هیچ اطلاعاتی پاک نمی‌شود.`}
      submitLabel={pending ? 'در حال حذف...' : 'حذف حساب'}
      destructive
      error={error}
      onClose={() => !pending && onClose()}
      onSubmit={() => void confirm()}
    />
  )
}
