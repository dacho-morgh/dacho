'use client'

import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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
type FormState = {
  companyName: string
  companyNationalId: string
  companyRegistrationNumber: string
  companyType: string
  companyProvince: string
  companyCity: string
  name: string
  position: string
  phone: string
  email: string
  password: string
  passwordConfirmation: string
}

const EMPTY_FORM: FormState = {
  companyName: '',
  companyNationalId: '',
  companyRegistrationNumber: '',
  companyType: '',
  companyProvince: '',
  companyCity: '',
  name: '',
  position: '',
  phone: '',
  email: '',
  password: '',
  passwordConfirmation: '',
}

type FormErrors = Partial<Record<keyof FormState, string>>

const registerInputClasses = {
  className: 'text-sm leading-6 text-neutral-800 placeholder:text-neutral-300',
  containerClassName: 'h-12 rounded-lg border-neutral-200 px-3 py-2 shadow-none',
  wrapperClassName:
    'gap-2 [&_label]:text-sm [&_label]:leading-5 [&_label]:font-normal [&_label]:text-neutral-700',
} as const

const required = (value: string, label: string): string | undefined =>
  value.trim() ? undefined : `${label} را وارد کنید.`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RegisterPage({ returnUrl = '/dashboard' }: { returnUrl?: string }) {
  const router = useRouter()
  const safeReturnUrl = getSafeReturnUrl(returnUrl)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmationVisible, setConfirmationVisible] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Marks the form hydrated so e2e tests wait until React has attached its
  // handlers before filling the controlled inputs (a fill before hydration is
  // discarded when React re-renders the initial empty state).
  useEffect(() => {
    formRef.current?.setAttribute('data-hydrated', 'true')
  }, [])

  const setField = (name: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const validateStep = (stepNumber: number): boolean => {
    const next: FormErrors = {}

    if (stepNumber === 1) {
      next.companyName = required(form.companyName, 'نام شرکت')
      next.companyNationalId = required(form.companyNationalId, 'شناسه ملی')
      next.companyRegistrationNumber = required(form.companyRegistrationNumber, 'شماره ثبت')
      next.companyType = required(form.companyType, 'نوع شرکت')
      next.companyProvince = required(form.companyProvince, 'استان')
      next.companyCity = required(form.companyCity, 'شهر')
    }

    if (stepNumber === 2) {
      next.name = required(form.name, 'نام و نام خانوادگی')
      next.position = required(form.position, 'سمت')
      next.phone = required(form.phone, 'شماره موبایل')
      next.email = required(form.email, 'ایمیل')
      if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
        next.email = 'ایمیل معتبر نیست.'
      }
    }

    if (stepNumber === 3) {
      next.password = required(form.password, 'رمز عبور')
      if (form.password && form.password.length < 8) {
        next.password = 'رمز عبور باید حداقل ۸ کاراکتر باشد.'
      }
      next.passwordConfirmation = required(form.passwordConfirmation, 'تکرار رمز عبور')
      if (
        form.password &&
        form.passwordConfirmation &&
        form.password !== form.passwordConfirmation
      ) {
        next.passwordConfirmation = 'رمز عبور و تکرار آن یکسان نیستند.'
      }
    }

    setErrors(next)
    return Object.values(next).every((error) => !error)
  }

  const goBack = () => setStep((current) => Math.max(1, current - 1))
  const goForward = () => {
    if (validateStep(step)) {
      setStep((current) => Math.min(3, current + 1))
    }
  }

  const handleSubmit = async () => {
    if (!validateStep(3)) return
    setSubmitting(true)
    setNotice(null)

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          username: form.phone.trim(),
          password: form.password,
          phone: form.phone.trim(),
          name: form.name.trim(),
          position: form.position.trim(),
          companyName: form.companyName.trim(),
          companyNationalId: form.companyNationalId.trim(),
          companyRegistrationNumber: form.companyRegistrationNumber.trim(),
          companyType: form.companyType,
          companyProvince: form.companyProvince.trim(),
          companyCity: form.companyCity.trim(),
        }),
      })

      if (!response.ok) {
        // Payload returns validation errors keyed by field when a unique
        // phone/email already exists; surface a single friendly message.
        setNotice('ثبت‌نام انجام نشد. ممکن است این شماره موبایل یا ایمیل قبلاً ثبت شده باشد.')
        return
      }

      router.replace(getLoginUrl(safeReturnUrl, { registered: true }))
    } catch {
      setNotice('در حال حاضر ارتباط با سامانه برقرار نیست. کمی بعد دوباره تلاش کنید.')
    } finally {
      setSubmitting(false)
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
          if (step < 3) goForward()
          else void handleSubmit()
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
                error={errors.companyName}
                id="register-companyName"
                inputSize="lg"
                label="نام شرکت"
                name="companyName"
                onChange={(event) => setField('companyName')(event.target.value)}
                placeholder="نام رسمی شرکت را وارد کنید"
                value={form.companyName}
              />
              <Input
                {...registerInputClasses}
                error={errors.companyNationalId}
                id="register-companyNationalId"
                inputSize="lg"
                label="شناسه ملی"
                name="companyNationalId"
                onChange={(event) => setField('companyNationalId')(event.target.value)}
                placeholder="شناسه ملی ۱۱ رقمی شرکت"
                value={form.companyNationalId}
              />
              <Input
                {...registerInputClasses}
                error={errors.companyRegistrationNumber}
                id="register-companyRegistrationNumber"
                inputSize="lg"
                label="شماره ثبت"
                name="companyRegistrationNumber"
                onChange={(event) => setField('companyRegistrationNumber')(event.target.value)}
                placeholder="شماره ثبت شرکت را وارد کنید"
                value={form.companyRegistrationNumber}
              />
              <div className="flex flex-col gap-2 [&_label]:text-sm [&_label]:leading-5 [&_label]:font-normal [&_label]:text-neutral-700">
                <Typography as="label" color="neutral-700" variant="14/regular">
                  نوع شرکت
                </Typography>
                <Select
                  onValueChange={(value) => setField('companyType')(value)}
                  value={form.companyType || undefined}
                >
                  <SelectTrigger className="h-12 rounded-lg border-neutral-200 px-3 py-2 shadow-none">
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
                {errors.companyType && (
                  <Typography as="p" color="error" variant="12/light">
                    {errors.companyType}
                  </Typography>
                )}
              </div>
              <Input
                {...registerInputClasses}
                error={errors.companyProvince}
                id="register-companyProvince"
                inputSize="lg"
                label="استان"
                name="companyProvince"
                onChange={(event) => setField('companyProvince')(event.target.value)}
                placeholder="استان محل ثبت را وارد کنید"
                value={form.companyProvince}
              />
              <Input
                {...registerInputClasses}
                error={errors.companyCity}
                id="register-companyCity"
                inputSize="lg"
                label="شهر"
                name="companyCity"
                onChange={(event) => setField('companyCity')(event.target.value)}
                placeholder="شهر محل ثبت را وارد کنید"
                value={form.companyCity}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Input
                {...registerInputClasses}
                error={errors.name}
                id="register-name"
                inputMode="text"
                inputSize="lg"
                label="نام و نام خانوادگی"
                name="name"
                onChange={(event) => setField('name')(event.target.value)}
                placeholder="نام و نام خانوادگی را وارد کنید"
                value={form.name}
              />
              <Input
                {...registerInputClasses}
                error={errors.position}
                id="register-position"
                inputMode="text"
                inputSize="lg"
                label="سمت"
                name="position"
                onChange={(event) => setField('position')(event.target.value)}
                placeholder="سمت خود را در شرکت انتخاب کنید"
                value={form.position}
              />
              <Input
                {...registerInputClasses}
                error={errors.phone}
                id="register-phone"
                inputMode="tel"
                inputSize="lg"
                label="شماره موبایل"
                name="phone"
                onChange={(event) => setField('phone')(event.target.value)}
                placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷"
                value={form.phone}
              />
              <Input
                {...registerInputClasses}
                error={errors.email}
                id="register-email"
                inputMode="email"
                inputSize="lg"
                label="ایمیل"
                name="email"
                onChange={(event) => setField('email')(event.target.value)}
                placeholder="مثلاً example@company.ir"
                value={form.email}
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
                error={errors.password}
                id="register-password"
                inputSize="lg"
                label="رمز عبور"
                name="password"
                onChange={(event) => setField('password')(event.target.value)}
                placeholder="رمز عبور خود را وارد کنید"
                type={passwordVisible ? 'text' : 'password'}
                value={form.password}
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
                error={errors.passwordConfirmation}
                id="register-password-confirmation"
                inputSize="lg"
                label="تکرار رمز عبور"
                name="passwordConfirmation"
                onChange={(event) => setField('passwordConfirmation')(event.target.value)}
                placeholder="رمز عبور خود را دوباره وارد کنید"
                type={confirmationVisible ? 'text' : 'password'}
                value={form.passwordConfirmation}
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
            role="alert"
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
            <Button loading={submitting} size="40" type="submit">
              ثبت شرکت
            </Button>
          )}
        </footer>
      </form>
    </div>
  )
}
