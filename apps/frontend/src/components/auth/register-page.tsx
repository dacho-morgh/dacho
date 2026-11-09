'use client'

import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Controller,
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker'
import { SelectField } from '@/components/ui/select-field'
import { Typography } from '@/components/ui/typography'
import {
  citiesOfProvince,
  IRAN_PROVINCES,
  isCityOfProvince,
} from '@/data/iran-locations'
import { getExplicitSafeReturnUrl, getLoginUrl, getSafeReturnUrl } from '@/utilities/auth-return-url'
import { toEnglishDigits } from '@/utilities/digits'
import { compareJalali, parseJalali, todayJalali } from '@/utilities/jalali'
import { resolvePostSignInDestination } from '@/utilities/post-sign-in'
import {
  DIGITS_ONLY_MESSAGE,
  emailProblem,
  isDigitsOnly,
  mobileProblem,
  nationalIdProblem,
  SIGNUP_REASON_MESSAGES,
} from '@/utilities/signup-validation'

const steps = ['اطلاعات شرکت', 'اطلاعات نماینده', 'امنیت حساب'] as const

const COMPANY_TYPES = [
  'سهامی خاص',
  'سهامی عام',
  'مسئولیت محدود',
  'دانش‌بنیان',
  'استارتاپ',
  'سایر',
] as const

const PROVINCE_NAMES = IRAN_PROVINCES.map((province) => province.name)

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
  reason?: unknown
  path?: unknown
  message?: unknown
}

type PayloadErrorBody = {
  errors?: unknown
  message?: unknown
}

type SignupSuccessBody = {
  user?: { contentEditor?: boolean | null }
  session?: { established?: unknown }
}

const registerInputClasses = {
  // Figma 242:10534: placeholder 16/Light, grey/400. The label keeps the shared
  // 16/Regular neutral-600 (Figma 242:10530).
  className: 'text-base leading-7 text-neutral-800 placeholder:font-light placeholder:text-neutral-400',
  containerClassName: 'h-12 rounded-lg border-neutral-200 px-3 py-2 shadow-none',
  wrapperClassName: 'gap-2',
} as const

// The selects and the date field share the inputs' label and 48px control.
const registerFieldClasses = {
  wrapperClassName: 'gap-2',
  className: 'h-12 rounded-lg border-neutral-200 text-base leading-7 text-neutral-800',
} as const

const requiredText = (label: string) =>
  z.string().refine((value) => value.trim().length > 0, `${label} را وارد کنید.`)

/** A required text field with one extra rule that only runs once something is typed. */
const requiredWithRule = (label: string, problem: (value: string) => string | undefined) =>
  z.string().superRefine((value, ctx) => {
    if (!value.trim()) {
      ctx.addIssue({ code: 'custom', message: `${label} را وارد کنید.` })
      return
    }
    const message = problem(value)
    if (message) ctx.addIssue({ code: 'custom', message })
  })

const optionalDigits = z.string().refine((value) => !value.trim() || isDigitsOnly(value), DIGITS_ONLY_MESSAGE)

const signupSchema = z.object({
  companyName: requiredText('نام شرکت'),
  companyNationalId: requiredWithRule('شناسه ملی', (value) => {
    const reason = nationalIdProblem(value)
    return reason ? SIGNUP_REASON_MESSAGES[reason] : undefined
  }),
  activityDomain: requiredText('حوزه فعالیت'),
  companyRegistrationNumber: optionalDigits,
  companyType: z.string(),
  companyProvince: z.string(),
  companyCity: z.string(),
  companyEstablishmentDate: z.string().superRefine((value, ctx) => {
    if (!value.trim()) return
    const date = parseJalali(value)
    if (!date) ctx.addIssue({ code: 'custom', message: 'تاریخ تأسیس معتبر نیست.' })
    else if (compareJalali(date, todayJalali()) > 0)
      ctx.addIssue({ code: 'custom', message: 'تاریخ تأسیس نمی‌تواند در آینده باشد.' })
  }),
  companyStatus: z.string(),
  companyEconomicCode: optionalDigits,
  name: requiredText('نام و نام خانوادگی'),
  position: requiredText('سمت'),
  phone: requiredWithRule('شماره موبایل', (value) => {
    const reason = mobileProblem(value)
    return reason ? SIGNUP_REASON_MESSAGES[reason] : undefined
  }),
  email: requiredWithRule('ایمیل', (value) => {
    const reason = emailProblem(value)
    return reason ? SIGNUP_REASON_MESSAGES[reason] : undefined
  }),
  password: requiredText('رمز عبور').refine(
    (value) => !value || value.length >= 8,
    'رمز عبور باید حداقل ۸ کاراکتر باشد.',
  ),
  passwordConfirmation: requiredText('تکرار رمز عبور'),
})

/** Rules that compare two fields; run next to the schema so a per-field error never hides them. */
function crossFieldIssues(values: FormState): Array<{ name: keyof FormState; message: string }> {
  const issues: Array<{ name: keyof FormState; message: string }> = []
  if (
    values.password &&
    values.passwordConfirmation &&
    values.password !== values.passwordConfirmation
  ) {
    issues.push({ name: 'passwordConfirmation', message: 'رمز عبور و تکرار آن یکسان نیستند.' })
  }
  if (values.companyCity) {
    if (!values.companyProvince) {
      issues.push({ name: 'companyCity', message: 'ابتدا استان را انتخاب کنید.' })
    } else if (!isCityOfProvince(values.companyProvince, values.companyCity)) {
      issues.push({ name: 'companyCity', message: 'این شهر در استان انتخاب‌شده نیست.' })
    }
  }
  return issues
}

// ponytail: flat fields need only Zod's first issue; use a resolver package if nested fields arrive.
const signupResolver: Resolver<FormState> = (values) => {
  const result = signupSchema.safeParse(values)
  const errors: FieldErrors<FormState> = {}
  if (!result.success) {
    for (const issue of result.error.issues) {
      const name = issue.path[0] as keyof FormState
      errors[name] ??= { type: issue.code, message: issue.message }
    }
  }
  for (const issue of crossFieldIssues(values)) {
    errors[issue.name] ??= { type: 'custom', message: issue.message }
  }
  if (result.success && Object.keys(errors).length === 0) return { values: result.data, errors: {} }
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

/**
 * The Persian message for a server `invalid_field`, chosen by the server's
 * stable `reason` (digits_only | length | checksum | mobile_format |
 * email_format). The server's English text is never shown.
 */
function invalidFieldMessage(field: keyof FormState, reason: unknown): string {
  if (field === 'companyNationalId') {
    return reason === 'digits_only' || reason === 'length' || reason === 'checksum'
      ? SIGNUP_REASON_MESSAGES[reason]
      : SIGNUP_REASON_MESSAGES.checksum
  }
  if (field === 'phone') return SIGNUP_REASON_MESSAGES.mobile_format
  if (field === 'email') return SIGNUP_REASON_MESSAGES.email_format
  return 'مقدار واردشده معتبر نیست.'
}

/**
 * A response the browser cannot interpret may still follow a committed signup
 * (a gateway timeout after the server wrote both records, say). The browser
 * never decides the outcome itself: it tells the person to try signing in
 * before resubmitting, and a resubmission is answered by the server's own
 * duplicate rule.
 */
const SIGNUP_TIMEOUT_MS = 30_000

type Recovery = 'login' | 'uncertain-login'

type Notice = { message: string; recovery?: Recovery }

const NOTICES = {
  correctFields: 'لطفاً موارد مشخص‌شده را اصلاح کنید.',
  rejected: 'اطلاعات ارسالی پذیرفته نشد. موارد واردشده را بررسی و دوباره تلاش کنید.',
  duplicateIdentity: 'شماره موبایل یا ایمیل واردشده قبلاً ثبت شده است.',
  duplicateCompany:
    'این شرکت قبلاً در سامانه ثبت شده است و شرکت دیگری با این شناسه ملی ایجاد نشد.',
  duplicateAfterUncertain:
    'این شرکت در سامانه ثبت شده است؛ ممکن است ارسال قبلی شما انجام شده باشد. شرکت دیگری ایجاد نشد.',
  serverFailure:
    'ثبت‌نام به دلیل خطای سامانه انجام نشد. اطلاعات شما حفظ شده است؛ لطفاً دوباره تلاش کنید.',
  uncertainServer:
    'پاسخ قطعی از سامانه دریافت نشد و ممکن است ثبت‌نام انجام شده باشد. اطلاعات شما حفظ شده است.',
  uncertainNetwork:
    'ارتباط با سامانه قطع شد و نتیجه ثبت‌نام مشخص نیست. اطلاعات شما حفظ شده است.',
} as const

const RECOVERY_HINTS: Record<Recovery, string> = {
  login: 'اگر پیش‌تر با این اطلاعات حساب ساخته‌اید، به‌جای ثبت دوباره وارد شوید.',
  'uncertain-login':
    'پیش از ارسال دوباره، با شماره موبایل یا ایمیل خود وارد شوید. اگر ورود ممکن نبود، دوباره ثبت کنید.',
}

function isDuplicateError(error: PayloadError): boolean {
  const message = typeof error.message === 'string' ? error.message.toLocaleLowerCase() : ''
  return /unique|duplicate|already|exists|قبلاً|تکراری/.test(message)
}

export default function RegisterPage({ returnUrl }: { returnUrl?: string | string[] }) {
  const router = useRouter()
  const safeReturnUrl = getSafeReturnUrl(returnUrl)
  const explicitReturnUrl = getExplicitSafeReturnUrl(returnUrl)
  const [step, setStep] = useState(1)
  const {
    register,
    control,
    trigger,
    clearErrors,
    setError,
    setValue,
    getValues,
    getFieldState,
    handleSubmit,
    formState: { errors, isSubmitting: submitting },
  } = useForm<FormState>({
    defaultValues: EMPTY_FORM,
    resolver: signupResolver,
    // A field reports its error after the person has left it (or a step or the
    // form was submitted), never while the step is first shown (design QA #278).
    mode: 'onTouched',
    shouldFocusError: false,
  })
  const province = useWatch({ control, name: 'companyProvince' })
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmationVisible, setConfirmationVisible] = useState(false)
  const [notice, setNoticeState] = useState<Notice | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const submissionLock = useRef(false)
  const pendingRequest = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  // Set when an earlier attempt ended without a definite server answer, so a
  // later duplicate response can be explained as possibly the same signup.
  const outcomeUncertain = useRef(false)
  const loginUrl = getLoginUrl(safeReturnUrl)

  const setNotice = (message: string | null, recovery?: Recovery) =>
    setNoticeState(message ? { message, recovery } : null)

  // E2E fills only after RHF has attached refs and change handlers.
  useEffect(() => {
    mounted.current = true
    formRef.current?.setAttribute('data-hydrated', 'true')
    return () => {
      // A response for a page the person has left must not navigate or
      // update this form; the server result stays authoritative.
      mounted.current = false
      pendingRequest.current?.abort()
    }
  }, [])

  const clearFieldError = (name: keyof FormState) => {
    clearErrors(name)
    setNotice(null)
  }

  const registerField = (name: keyof FormState) =>
    register(name, {
      onChange: () => {
        clearFieldError(name)
        // The confirmation is compared with the password: re-check it once the
        // person has started typing it, not before.
        if (name === 'password' && getValues('passwordConfirmation')) {
          void trigger('passwordConfirmation')
        }
      },
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
    if (await trigger(fields)) {
      setNotice(null)
      setStep(Math.min(3, step + 1))
      return
    }
    const firstInvalid = fields.find((name) => getFieldState(name).error)
    if (firstInvalid) focusField(firstInvalid)
  }

  const submitSignup = async (form: FormState) => {
    setNotice(null)
    const controller = new AbortController()
    pendingRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), SIGNUP_TIMEOUT_MS)

    try {
      const response = await fetch('/api/users/self-signup', {
        method: 'POST',
        signal: controller.signal,
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

      if (!mounted.current) return

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as PayloadErrorBody | null
        if (!mounted.current) return
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
            serverErrors[field] = invalidFieldMessage(field, error.reason)
          } else if ((isDuplicateError(error) || payloadInvalidUniqueField) && field === 'phone') {
            serverErrors.phone = 'این شماره موبایل قبلاً ثبت شده است.'
          } else if ((isDuplicateError(error) || payloadInvalidUniqueField) && field === 'email') {
            serverErrors.email = 'این ایمیل قبلاً ثبت شده است.'
          } else {
            serverErrors[field] = 'مقدار واردشده معتبر نیست.'
          }
        }

        const invalidFields = Object.keys(serverErrors) as Array<keyof FormState>
        const duplicateCompany = responseErrors.some(
          (error) => error.code === 'duplicate_national_id',
        )
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
          if (duplicateCompany) {
            setNotice(
              outcomeUncertain.current
                ? NOTICES.duplicateAfterUncertain
                : NOTICES.duplicateCompany,
              'login',
            )
          } else {
            setNotice(NOTICES.correctFields)
          }
        } else if (responseErrors.some((error) => error.code === 'signup_rejected')) {
          // Deliberately generic: the server does not say which account exists.
          setNotice(NOTICES.rejected, 'login')
          focusNotice()
        } else if (hasAmbiguousIdentityError || response.status === 409) {
          setStep(2)
          setNotice(NOTICES.duplicateIdentity, 'login')
          focusField('phone')
        } else if (responseErrors.some((error) => error.code === 'signup_failed')) {
          // The server reports a rolled-back transaction: nothing was created.
          setNotice(NOTICES.serverFailure)
          focusNotice()
        } else if (response.status >= 500) {
          // A gateway or unreadable failure may follow a committed signup.
          outcomeUncertain.current = true
          setNotice(NOTICES.uncertainServer, 'uncertain-login')
          focusNotice()
        } else {
          setNotice(NOTICES.rejected)
          focusNotice()
        }
        return
      }

      outcomeUncertain.current = false
      const created = (await response.json().catch(() => null)) as SignupSuccessBody | null
      if (!mounted.current) return

      // The server signs the new representative in with the same cookie a login
      // sets (`session.established`). Enter the panel directly, exactly as the
      // login form does; if the sign-in did not happen, or the panel cannot be
      // resolved, the account still exists, so fall back to the login page.
      if (created?.session?.established === true) {
        try {
          const result = await resolvePostSignInDestination({
            user: created.user,
            explicitReturnUrl,
          })
          if (!mounted.current) return
          if ('destination' in result) {
            // A document-level navigation sends the protected route the cookie
            // the signup just stored instead of an unauthenticated router cache.
            window.location.replace(result.destination)
            return
          }
        } catch {
          if (!mounted.current) return
        }
      }
      router.replace(getLoginUrl(safeReturnUrl, { registered: true }))
    } catch {
      if (!mounted.current) return
      // The request may have reached the server before the connection failed
      // or the timeout fired, so the outcome is unknown rather than failed.
      outcomeUncertain.current = true
      setNotice(NOTICES.uncertainNetwork, 'uncertain-login')
      focusNotice()
    } finally {
      clearTimeout(timeout)
      if (pendingRequest.current === controller) pendingRequest.current = null
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[520px] flex-col px-6 pt-8 pb-6 lg:h-svh lg:min-h-0 lg:px-5 lg:pt-10 lg:pb-8">
      <header className="shrink-0">
        {/* Figma 242:12199: 20/Bold, neutral-700, line height 32. */}
        <Typography color="neutral-700" variant="20/bold">
          ثبت شرکت
        </Typography>
        <Typography className="mt-2" color="neutral-500" variant="16/regular">
          اطلاعات شرکت خود را برای ایجاد حساب وارد کنید.
        </Typography>

        <ol className="relative mt-10 grid list-none grid-cols-3" aria-label={`مرحله ${step} از ۳`}>
          <span
            className="absolute top-3.5 start-[calc(16.667%+14px)] end-[calc(16.667%+14px)] h-0.5 bg-neutral-200"
            aria-hidden="true"
          />
          <span
            className="absolute top-3.5 start-[calc(16.667%+14px)] h-0.5 max-w-[calc(66.666%-28px)] bg-brand-500 transition-[width] duration-200 ease-out"
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
        aria-busy={submitting || undefined}
        aria-label="فرم ثبت شرکت"
        noValidate
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
        {/* The pending submission owns these answers: editing them now would
            make the visible form disagree with what the server receives. */}
        <fieldset
          className="m-0 flex min-w-0 flex-col gap-7 border-0 p-0 ps-0.5 pe-3.5 lg:min-h-0 lg:flex-1 lg:[scrollbar-width:thin] lg:[scrollbar-color:var(--neutral-300)_transparent] lg:overflow-y-auto"
          disabled={submitting}
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
                aria-required="true"
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
                aria-required="true"
                {...registerField('companyNationalId')}
                placeholder="شناسه ملی ۱۱ رقمی شرکت را وارد کنید"
              />
              <Input
                {...registerInputClasses}
                error={errors.activityDomain?.message}
                id="register-activityDomain"
                inputSize="lg"
                label="حوزه فعالیت"
                aria-required="true"
                {...registerField('activityDomain')}
                placeholder="حوزه فعالیت شرکت را وارد کنید"
              />
              <Input
                {...registerInputClasses}
                error={errors.companyRegistrationNumber?.message}
                id="register-companyRegistrationNumber"
                inputMode="numeric"
                inputSize="lg"
                label="شماره ثبت (اختیاری)"
                {...registerField('companyRegistrationNumber')}
                placeholder="شماره ثبت شرکت را وارد کنید"
              />
              <Controller
                control={control}
                name="companyType"
                render={({ field }) => (
                  <SelectField
                    {...registerFieldClasses}
                    error={errors.companyType?.message}
                    id="register-companyType"
                    label="نوع شرکت (اختیاری)"
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      field.onChange(event.target.value)
                      clearFieldError('companyType')
                    }}
                    options={COMPANY_TYPES}
                    placeholder="نوع شرکت را انتخاب کنید"
                    ref={field.ref}
                    value={field.value}
                  />
                )}
              />
              <Controller
                control={control}
                name="companyProvince"
                render={({ field }) => (
                  <SelectField
                    {...registerFieldClasses}
                    error={errors.companyProvince?.message}
                    id="register-companyProvince"
                    label="استان (اختیاری)"
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      field.onChange(event.target.value)
                      // The city list depends on the province: a city of the old
                      // province must not survive a change of province.
                      setValue('companyCity', '')
                      clearErrors('companyCity')
                      clearFieldError('companyProvince')
                    }}
                    options={PROVINCE_NAMES}
                    placeholder="استان محل ثبت را انتخاب کنید"
                    ref={field.ref}
                    value={field.value}
                  />
                )}
              />
              <Controller
                control={control}
                name="companyCity"
                render={({ field }) => (
                  <SelectField
                    {...registerFieldClasses}
                    disabled={!province}
                    error={errors.companyCity?.message}
                    id="register-companyCity"
                    label="شهر (اختیاری)"
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      field.onChange(event.target.value)
                      clearFieldError('companyCity')
                    }}
                    options={citiesOfProvince(province)}
                    placeholder={
                      province ? 'شهر محل ثبت را انتخاب کنید' : 'ابتدا استان را انتخاب کنید'
                    }
                    ref={field.ref}
                    value={field.value}
                  />
                )}
              />
              <Controller
                control={control}
                name="companyEstablishmentDate"
                render={({ field }) => (
                  <JalaliDatePicker
                    {...registerFieldClasses}
                    containerClassName="h-12 rounded-lg border-neutral-200 text-base leading-7"
                    error={errors.companyEstablishmentDate?.message}
                    id="register-companyEstablishmentDate"
                    label="تاریخ تأسیس"
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(value) => {
                      field.onChange(value)
                      clearFieldError('companyEstablishmentDate')
                    }}
                    placeholder="تاریخ تأسیس را انتخاب کنید"
                    value={field.value}
                  />
                )}
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
                inputMode="numeric"
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
                aria-required="true"
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
                aria-required="true"
                {...registerField('position')}
                placeholder="سمت خود را در شرکت انتخاب کنید"
              />
              <Input
                {...registerInputClasses}
                autoComplete="tel"
                error={errors.phone?.message}
                id="register-phone"
                inputMode="tel"
                inputSize="lg"
                label="شماره موبایل"
                aria-required="true"
                {...registerField('phone')}
                placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷"
              />
              <Input
                {...registerInputClasses}
                autoComplete="email"
                error={errors.email?.message}
                id="register-email"
                inputMode="email"
                inputSize="lg"
                label="ایمیل"
                aria-required="true"
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
                aria-required="true"
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
                aria-required="true"
                {...registerField('passwordConfirmation')}
                placeholder="رمز عبور خود را دوباره وارد کنید"
                type={confirmationVisible ? 'text' : 'password'}
              />
            </>
          )}
        </fieldset>

        {notice && (
          <div className="mt-4 flex flex-col items-center gap-1 text-center">
            <Typography
              aria-live="polite"
              as="p"
              color="error"
              id="register-notice"
              role="alert"
              tabIndex={-1}
              variant="12/regular"
            >
              {notice.message}
            </Typography>
            {notice.recovery && (
              <Typography as="p" color="neutral-600" id="register-recovery" variant="12/regular">
                {RECOVERY_HINTS[notice.recovery]}{' '}
                <Link className="text-brand-500 underline-offset-4 hover:underline" href={loginUrl}>
                  ورود به حساب
                </Link>
              </Typography>
            )}
          </div>
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

          {/* Distinct keys: the continue and submit buttons must never be one DOM
              element whose type flips to `submit` mid-click, or the click that
              opens step 3 would also submit it and show every error at once. */}
          {step < 3 ? (
            <Button
              className="min-w-32"
              disabled={submitting}
              key="continue"
              onClick={goForward}
              size="48"
              type="button"
            >
              ادامه
              <ArrowLeft />
            </Button>
          ) : (
            <Button
              className="min-w-32"
              disabled={submitting}
              key="submit"
              loading={submitting}
              size="48"
              type="submit"
            >
              ثبت شرکت
            </Button>
          )}
        </footer>

        <Typography
          as="p"
          className="flex min-h-11 shrink-0 flex-wrap items-center justify-center gap-1 pt-4"
          color="neutral-600"
          variant="14/regular"
        >
          <span>حساب کاربری دارید؟</span>
          <Link className="inline-flex min-h-11 items-center text-brand-500" href={loginUrl}>
            <Typography as="span" color="brand" variant="14/semibold">
              وارد شوید
            </Typography>
          </Link>
        </Typography>
      </form>
    </div>
  )
}
