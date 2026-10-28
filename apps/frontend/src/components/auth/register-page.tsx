'use client'

import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, type FieldErrors, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Typography } from '@/components/ui/typography'
import { getLoginUrl, getSafeReturnUrl } from '@/utilities/auth-return-url'

const steps = ['اطلاعات شرکت', 'اطلاعات نماینده', 'امنیت حساب'] as const

const COMPANY_TYPES = [
  'سهامی خاص',
  'سهامی عام',
  'مسئولیت محدود',
  'دانش‌بنیان',
  'استارتاپ',
  'سایر',
] as const

// Form field names mirror the Users collection: the representative's
// fullName/mobile/email map to name/phone/email, and company fields carry a
// `company` prefix. `role`/`cmsRole` are deliberately omitted — the server
// forces every self-signup to `applicant` / `cmsRole: null`.
type FormState = z.infer<typeof signupSchema>

const EMPTY_FORM: FormState = {
  companyName: '',
  companyNationalId: '',
  activityDomain: '',
  companyRegistrationNumber: '',
  companyType: '',
  companyProvince: '',
  companyCity: '',
  companyEstablishmentDate: '',
  companyStatus: '',
  companyEconomicCode: '',
  name: '',
  position: '',
  phone: '',
  email: '',
  password: '',
  passwordConfirmation: '',
}

type FormErrors = Partial<Record<keyof FormState, string>>

type PayloadError = {
  code?: unknown
  field?: unknown
  path?: unknown
  message?: unknown
}

type PayloadErrorBody = {
  errors?: unknown
  message?: unknown
}

const registerInputClasses = {
  className: 'text-sm leading-6 text-neutral-800 placeholder:text-neutral-300',
  containerClassName: 'h-12 rounded-lg border-neutral-200 px-3 py-2 shadow-none',
  wrapperClassName:
    'gap-2 [&_label]:text-sm [&_label]:leading-5 [&_label]:font-normal [&_label]:text-neutral-700',
} as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NATIONAL_ID_RE = /^\d+$/
const IRANIAN_MOBILE_RE = /^09\d{9}$/

const toEnglishDigits = (value: string): string =>
  value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))

const requiredText = (label: string) =>
  z.string().refine((value) => value.trim().length > 0, `${label} را وارد کنید.`)

const signupSchema = z
  .object({
    companyName: requiredText('نام شرکت'),
    companyNationalId: requiredText('شناسه ملی').refine(
      (value) => !value.trim() || NATIONAL_ID_RE.test(toEnglishDigits(value.trim())),
      'شناسه ملی باید فقط شامل رقم باشد.',
    ),
    activityDomain: requiredText('حوزه فعالیت'),
    companyRegistrationNumber: z.string(),
    companyType: z.string(),
    companyProvince: z.string(),
    companyCity: z.string(),
    companyEstablishmentDate: z.string(),
    companyStatus: z.string(),
    companyEconomicCode: z.string(),
    name: requiredText('نام و نام خانوادگی'),
    position: requiredText('سمت'),
    phone: requiredText('شماره موبایل').refine(
      (value) => !value.trim() || IRANIAN_MOBILE_RE.test(toEnglishDigits(value.trim())),
      'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
    ),
    email: requiredText('ایمیل').refine(
      (value) => !value.trim() || EMAIL_RE.test(value.trim()),
      'ایمیل معتبر نیست.',
    ),
    password: requiredText('رمز عبور').refine(
      (value) => !value || value.length >= 8,
      'رمز عبور باید حداقل ۸ کاراکتر باشد.',
    ),
    passwordConfirmation: requiredText('تکرار رمز عبور'),
  })
  .refine(
    (values) =>
      !values.password ||
      !values.passwordConfirmation ||
      values.password === values.passwordConfirmation,
    { path: ['passwordConfirmation'], message: 'رمز عبور و تکرار آن یکسان نیستند.' },
  )

// ponytail: flat fields need only Zod's first issue; use a resolver package if nested fields arrive.
const signupResolver: Resolver<FormState> = (values) => {
  const result = signupSchema.safeParse(values)
  if (result.success) return { values: result.data, errors: {} }
  const errors: FieldErrors<FormState> = {}
  for (const issue of result.error.issues) {
    const name = issue.path[0] as keyof FormState
    errors[name] ??= { type: issue.code, message: issue.message }
  }
  return { values: {}, errors }
}

const fieldStep: Record<keyof FormState, number> = {
  companyName: 1,
  companyNationalId: 1,
  activityDomain: 1,
  companyRegistrationNumber: 1,
  companyType: 1,
  companyProvince: 1,
  companyCity: 1,
  companyEstablishmentDate: 1,
  companyStatus: 1,
  companyEconomicCode: 1,
  name: 2,
  position: 2,
  phone: 2,
  email: 2,
  password: 3,
  passwordConfirmation: 3,
}

const fieldElementId: Partial<Record<keyof FormState, string>> = {
  companyName: 'register-companyName',
  companyNationalId: 'register-companyNationalId',
  activityDomain: 'register-activityDomain',
  companyRegistrationNumber: 'register-companyRegistrationNumber',
  companyType: 'register-companyType',
  companyProvince: 'register-companyProvince',
  companyCity: 'register-companyCity',
  companyEstablishmentDate: 'register-companyEstablishmentDate',
  companyStatus: 'register-companyStatus',
  companyEconomicCode: 'register-companyEconomicCode',
  name: 'register-name',
  position: 'register-position',
  phone: 'register-phone',
  email: 'register-email',
  password: 'register-password',
  passwordConfirmation: 'register-password-confirmation',
}

function payloadErrors(body: PayloadErrorBody | null): PayloadError[] {
  return Array.isArray(body?.errors) ? (body.errors as PayloadError[]) : []
}

function payloadErrorField(error: PayloadError): keyof FormState | undefined {
  const raw =
    typeof error.path === 'string' ? error.path : typeof error.field === 'string' ? error.field : ''
  const message = typeof error.message === 'string' ? error.message : ''
  const messageField = message.match(/field is invalid:\s*([\w.-]+)/i)?.[1]
  const candidate = (raw || messageField || '').split('.').at(-1)
  // Payload reports either a duplicate phone-as-username or a duplicate email
  // as `invalid: username`, so it cannot be assigned honestly to one field.
  if (candidate === 'username') return undefined
  return candidate && candidate in EMPTY_FORM ? (candidate as keyof FormState) : undefined
}

function isDuplicateError(error: PayloadError): boolean {
  const message = typeof error.message === 'string' ? error.message.toLocaleLowerCase() : ''
  return /unique|duplicate|already|exists|قبلاً|تکراری/.test(message)
}

export default function RegisterPage({ returnUrl = '/dashboard' }: { returnUrl?: string }) {
  const router = useRouter()
  const safeReturnUrl = getSafeReturnUrl(returnUrl)
  const [step, setStep] = useState(1)
  const {
    register,
    control,
    trigger,
    clearErrors,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting: submitting },
  } = useForm<FormState>({
    defaultValues: EMPTY_FORM,
    resolver: signupResolver,
    shouldFocusError: false,
  })
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmationVisible, setConfirmationVisible] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const submissionLock = useRef(false)

  // E2E fills only after RHF has attached refs and change handlers.
  useEffect(() => {
    formRef.current?.setAttribute('data-hydrated', 'true')
  }, [])

  const clearFieldError = (name: keyof FormState) => {
    clearErrors(name)
    setNotice(null)
  }

  const registerField = (name: keyof FormState) =>
    register(name, {
      onChange: () => clearFieldError(name),
    })

  const focusField = (name: keyof FormState) => {
    const id = fieldElementId[name]
    if (id) requestAnimationFrame(() => document.getElementById(id)?.focus())
  }

  const focusNotice = () => {
    requestAnimationFrame(() => document.getElementById('register-notice')?.focus())
  }

  const focusErrors = (invalid: FieldErrors<FormState>) => {
    const firstField = (Object.keys(fieldStep) as Array<keyof FormState>).find(
      (name) => invalid[name],
    )
    if (firstField) {
      setStep(fieldStep[firstField])
      focusField(firstField)
    }
  }

  const goBack = () => {
    if (submitting) return
    setNotice(null)
    setStep((current) => Math.max(1, current - 1))
  }
  const goForward = async () => {
    if (submitting) return
    const fields = (Object.keys(fieldStep) as Array<keyof FormState>).filter(
      (name) => fieldStep[name] === step,
    )
    if (await trigger(fields, { shouldFocus: true })) {
      setNotice(null)
      setStep(Math.min(3, step + 1))
    }
  }

  const submitSignup = async (form: FormState) => {
    setNotice(null)

    try {
      const response = await fetch('/api/users/self-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLocaleLowerCase(),
          password: form.password,
          phone: toEnglishDigits(form.phone.trim()),
          name: form.name.trim(),
          position: form.position.trim(),
          companyName: form.companyName.trim(),
          companyNationalId: toEnglishDigits(form.companyNationalId.trim()),
          activityDomain: form.activityDomain.trim(),
          companyRegistrationNumber: toEnglishDigits(form.companyRegistrationNumber.trim()),
          companyType: form.companyType,
          companyProvince: form.companyProvince.trim(),
          companyCity: form.companyCity.trim(),
          companyEstablishmentDate: toEnglishDigits(form.companyEstablishmentDate.trim()),
          companyStatus: form.companyStatus.trim(),
          companyEconomicCode: toEnglishDigits(form.companyEconomicCode.trim()),
        }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as PayloadErrorBody | null
        const serverErrors: FormErrors = {}
        const responseErrors = payloadErrors(body)
        const hasAmbiguousIdentityError = responseErrors.some((error) =>
          /field is invalid:\s*username/i.test(
            typeof error.message === 'string' ? error.message : '',
          ),
        )

        for (const error of responseErrors) {
          const field = payloadErrorField(error)
          if (!field) continue
          const message = typeof error.message === 'string' ? error.message : ''
          const code = typeof error.code === 'string' ? error.code : ''
          const payloadInvalidUniqueField = /field is invalid:\s*(username|phone|email)/i.test(
            message,
          )

          // One company, one representative: a national id that already belongs
          // to a company cannot register a second person.
          if (code === 'duplicate_national_id' && field === 'companyNationalId') {
            serverErrors.companyNationalId =
              'این شناسه ملی قبلاً ثبت شده است. هر شرکت تنها یک نماینده دارد؛ برای افزودن نماینده جدید با دبیرخانه تماس بگیرید.'
          } else if (code === 'missing_field') {
            serverErrors[field] = 'این فیلد الزامی است.'
          } else if (code === 'invalid_field') {
            serverErrors[field] =
              field === 'companyNationalId'
                ? 'شناسه ملی باید فقط شامل رقم باشد.'
                : field === 'phone'
                  ? 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.'
                  : 'مقدار واردشده معتبر نیست.'
          } else if ((isDuplicateError(error) || payloadInvalidUniqueField) && field === 'phone') {
            serverErrors.phone = 'این شماره موبایل قبلاً ثبت شده است.'
          } else if ((isDuplicateError(error) || payloadInvalidUniqueField) && field === 'email') {
            serverErrors.email = 'این ایمیل قبلاً ثبت شده است.'
          } else {
            serverErrors[field] = 'مقدار واردشده معتبر نیست.'
          }
        }

        const invalidFields = Object.keys(serverErrors) as Array<keyof FormState>
        if (invalidFields.length > 0) {
          const firstField = invalidFields.sort(
            (left, right) => fieldStep[left] - fieldStep[right],
          )[0]
          for (const field of invalidFields) {
            setError(field, { type: 'server', message: serverErrors[field] })
          }
          if (firstField) {
            setStep(fieldStep[firstField])
            focusField(firstField)
          }
          setNotice('لطفاً موارد مشخص‌شده را اصلاح کنید.')
        } else if (responseErrors.some((error) => error.code === 'signup_rejected')) {
          setNotice('اطلاعات ارسالی پذیرفته نشد. موارد واردشده را بررسی و دوباره تلاش کنید.')
          focusNotice()
        } else if (hasAmbiguousIdentityError || response.status === 409) {
          setStep(2)
          setNotice('شماره موبایل یا ایمیل واردشده قبلاً ثبت شده است.')
          focusField('phone')
        } else if (response.status >= 500) {
          setNotice(
            'ثبت‌نام به دلیل خطای سامانه انجام نشد. اطلاعات شما حفظ شده است؛ لطفاً دوباره تلاش کنید.',
          )
          focusNotice()
        } else {
          setNotice('اطلاعات ارسالی پذیرفته نشد. موارد واردشده را بررسی و دوباره تلاش کنید.')
          focusNotice()
        }
        return
      }

      router.replace(getLoginUrl(safeReturnUrl, { registered: true }))
    } catch {
      setNotice('در حال حاضر ارتباط با سامانه برقرار نیست. کمی بعد دوباره تلاش کنید.')
      focusNotice()
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[520px] flex-col px-6 pt-8 pb-6 lg:h-svh lg:min-h-0 lg:px-5 lg:pt-10 lg:pb-8">
      <header className="shrink-0">
        <Typography
          asChild
          className="inline-flex items-center gap-2 transition-colors hover:text-neutral-800"
          color="neutral-600"
          variant="16/regular"
        >
          <Link href={getLoginUrl(safeReturnUrl)}>
            <ArrowRight aria-hidden="true" className="size-5 stroke-[1.5]" />
            بازگشت
          </Link>
        </Typography>

        <Typography className="mt-7" color="neutral-800" variant="24/bold">
          ثبت شرکت
        </Typography>
        <Typography className="mt-2" color="neutral-500" variant="16/regular">
          اطلاعات شرکت خود را برای ایجاد حساب وارد کنید.
        </Typography>

        <ol className="relative mt-10 grid list-none grid-cols-3" aria-label={`مرحله ${step} از ۳`}>
          <span
            className="absolute top-3.5 right-[calc(16.667%+14px)] left-[calc(16.667%+14px)] h-0.5 bg-neutral-200"
            aria-hidden="true"
          />
          <span
            className="absolute top-3.5 right-[calc(16.667%+14px)] h-0.5 max-w-[calc(66.666%-28px)] bg-brand-500 transition-[width] duration-200 ease-out"
            style={{
              width:
                step === 1 ? '0' : step === 2 ? 'calc(33.333% - 28px)' : 'calc(66.666% - 28px)',
            }}
            aria-hidden="true"
          />

          {steps.map((label, index) => {
            const stepNumber = index + 1
            const isComplete = stepNumber < step
            const isActive = stepNumber === step

            return (
              <li className="relative z-10 flex flex-col items-center gap-3" key={label}>
                <span
                  className={`inline-flex size-7 items-center justify-center rounded-full text-sm leading-none font-semibold ${
                    isActive
                      ? 'bg-brand-500 text-white'
                      : isComplete
                        ? 'border-2 border-brand-500 bg-blue-100 text-brand-500'
                        : 'bg-neutral-200 text-neutral-500'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isComplete ? (
                    <Check aria-hidden="true" className="size-4 stroke-[2.5]" />
                  ) : (
                    stepNumber
                  )}
                </span>
                <Typography
                  as="span"
                  color={isActive || isComplete ? 'neutral-700' : 'neutral-500'}
                  variant="14/semibold"
                >
                  {label}
                </Typography>
              </li>
            )
          })}
        </ol>
      </header>

      <form
        className="flex min-h-0 flex-1 flex-col pt-11"
        aria-label="فرم ثبت شرکت"
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault()
          if (submissionLock.current) return
          if (step < 3) void goForward()
          else {
            submissionLock.current = true
            void handleSubmit(submitSignup, focusErrors)().finally(() => {
              submissionLock.current = false
            })
          }
        }}
      >
        <div
          className="flex flex-col gap-7 ps-0.5 pe-3.5 lg:min-h-0 lg:flex-1 lg:[scrollbar-width:thin] lg:[scrollbar-color:var(--neutral-300)_transparent] lg:overflow-y-auto"
          key={step}
        >
          {step === 1 && (
            <>
              <Input
                {...registerInputClasses}
                error={errors.companyName?.message}
                id="register-companyName"
                inputSize="lg"
                label="نام شرکت"
                {...registerField('companyName')}
                placeholder="نام رسمی شرکت را وارد کنید"
              />
              <Input
                {...registerInputClasses}
                error={errors.companyNationalId?.message}
                id="register-companyNationalId"
                inputMode="numeric"
                inputSize="lg"
                label="شناسه ملی"
                {...registerField('companyNationalId')}
                placeholder="شناسه ملی شرکت را وارد کنید"
              />
              <Input
                {...registerInputClasses}
                error={errors.activityDomain?.message}
                id="register-activityDomain"
                inputSize="lg"
                label="حوزه فعالیت"
                {...registerField('activityDomain')}
                placeholder="حوزه فعالیت شرکت را وارد کنید"
              />
              <Input
                {...registerInputClasses}
                error={errors.companyRegistrationNumber?.message}
                id="register-companyRegistrationNumber"
                inputSize="lg"
                label="شماره ثبت (اختیاری)"
                {...registerField('companyRegistrationNumber')}
                placeholder="شماره ثبت شرکت را وارد کنید"
              />
              <div className="flex flex-col gap-2 [&_label]:text-sm [&_label]:leading-5 [&_label]:font-normal [&_label]:text-neutral-700">
                <Typography
                  as="label"
                  htmlFor="register-companyType"
                  color="neutral-700"
                  variant="14/regular"
                >
                  نوع شرکت (اختیاری)
                </Typography>
                <Controller
                  control={control}
                  name="companyType"
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        clearFieldError('companyType')
                      }}
                      value={field.value || undefined}
                    >
                      <SelectTrigger
                        ref={field.ref}
                        onBlur={field.onBlur}
                        aria-describedby={
                          errors.companyType ? 'register-companyType-error' : undefined
                        }
                        aria-invalid={Boolean(errors.companyType) || undefined}
                        className="h-12 rounded-lg border-neutral-200 px-3 py-2 shadow-none"
                        id="register-companyType"
                      >
                        <SelectValue placeholder="نوع شرکت را انتخاب کنید" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.companyType && (
                  <Typography
                    as="p"
                    id="register-companyType-error"
                    color="error"
                    variant="12/light"
                  >
                    {errors.companyType.message}
                  </Typography>
                )}
              </div>
              <Input
                {...registerInputClasses}
                error={errors.companyProvince?.message}
                id="register-companyProvince"
                inputSize="lg"
                label="استان (اختیاری)"
                {...registerField('companyProvince')}
                placeholder="استان محل ثبت را وارد کنید"
              />
              <Input
                {...registerInputClasses}
                error={errors.companyCity?.message}
                id="register-companyCity"
                inputSize="lg"
                label="شهر (اختیاری)"
                {...registerField('companyCity')}
                placeholder="شهر محل ثبت را وارد کنید"
              />
              <Input
                {...registerInputClasses}
                error={errors.companyEstablishmentDate?.message}
                id="register-companyEstablishmentDate"
                inputSize="lg"
                label="تاریخ تأسیس"
                {...registerField('companyEstablishmentDate')}
                placeholder="۱۳۷۵/۰۵/۱۲"
              />
              <Input
                {...registerInputClasses}
                error={errors.companyStatus?.message}
                id="register-companyStatus"
                inputSize="lg"
                label="وضعیت شرکت"
                {...registerField('companyStatus')}
                placeholder="فعال"
              />
              <Input
                {...registerInputClasses}
                error={errors.companyEconomicCode?.message}
                id="register-companyEconomicCode"
                inputSize="lg"
                label="کد اقتصادی"
                {...registerField('companyEconomicCode')}
                placeholder="کد اقتصادی شرکت"
              />
            </>
          )}

          {step === 2 && (
            <>
              <Input
                {...registerInputClasses}
                error={errors.name?.message}
                id="register-name"
                inputMode="text"
                inputSize="lg"
                label="نام و نام خانوادگی"
                {...registerField('name')}
                placeholder="نام و نام خانوادگی را وارد کنید"
              />
              <Input
                {...registerInputClasses}
                error={errors.position?.message}
                id="register-position"
                inputMode="text"
                inputSize="lg"
                label="سمت"
                {...registerField('position')}
                placeholder="سمت خود را در شرکت انتخاب کنید"
              />
              <Input
                {...registerInputClasses}
                error={errors.phone?.message}
                id="register-phone"
                inputMode="tel"
                inputSize="lg"
                label="شماره موبایل"
                {...registerField('phone')}
                placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷"
              />
              <Input
                {...registerInputClasses}
                error={errors.email?.message}
                id="register-email"
                inputMode="email"
                inputSize="lg"
                label="ایمیل"
                {...registerField('email')}
                placeholder="مثلاً example@company.ir"
              />
            </>
          )}

          {step === 3 && (
            <>
              <Input
                {...registerInputClasses}
                autoComplete="new-password"
                endIcon={
                  <button
                    aria-label={passwordVisible ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                    className="inline-flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-neutral-300 transition-colors hover:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    type="button"
                  >
                    {passwordVisible ? (
                      <EyeOff aria-hidden="true" className="size-5 stroke-[1.5]" />
                    ) : (
                      <Eye aria-hidden="true" className="size-5 stroke-[1.5]" />
                    )}
                  </button>
                }
                error={errors.password?.message}
                id="register-password"
                inputSize="lg"
                label="رمز عبور"
                {...registerField('password')}
                placeholder="رمز عبور خود را وارد کنید"
                type={passwordVisible ? 'text' : 'password'}
              />

              <Input
                {...registerInputClasses}
                autoComplete="new-password"
                endIcon={
                  <button
                    aria-label={
                      confirmationVisible ? 'پنهان کردن تکرار رمز عبور' : 'نمایش تکرار رمز عبور'
                    }
                    className="inline-flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-neutral-300 transition-colors hover:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    onClick={() => setConfirmationVisible((visible) => !visible)}
                    type="button"
                  >
                    {confirmationVisible ? (
                      <EyeOff aria-hidden="true" className="size-5 stroke-[1.5]" />
                    ) : (
                      <Eye aria-hidden="true" className="size-5 stroke-[1.5]" />
                    )}
                  </button>
                }
                error={errors.passwordConfirmation?.message}
                id="register-password-confirmation"
                inputSize="lg"
                label="تکرار رمز عبور"
                {...registerField('passwordConfirmation')}
                placeholder="رمز عبور خود را دوباره وارد کنید"
                type={confirmationVisible ? 'text' : 'password'}
              />
            </>
          )}
        </div>

        {notice && (
          <Typography
            aria-live="polite"
            as="p"
            className="mt-4 text-center"
            color="error"
            id="register-notice"
            role="alert"
            tabIndex={-1}
            variant="12/regular"
          >
            {notice}
          </Typography>
        )}

        <footer
          className={`flex shrink-0 items-center pt-8 ${step === 1 ? 'justify-end' : 'justify-between'}`}
        >
          {step > 1 && (
            <Button
              disabled={submitting}
              icon={<ArrowRight />}
              onClick={goBack}
              size="clear"
              type="button"
              variant="text-gray"
            >
              بازگشت
            </Button>
          )}

          {step < 3 ? (
            <Button onClick={goForward} size="40" type="button">
              ادامه
              <ArrowLeft />
            </Button>
          ) : (
            <Button disabled={submitting} loading={submitting} size="40" type="submit">
              ثبت شرکت
            </Button>
          )}
        </footer>
      </form>
    </div>
  )
}
