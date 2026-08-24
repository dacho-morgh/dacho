'use client'

import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'

const steps = ['اطلاعات شرکت', 'اطلاعات نماینده', 'امنیت حساب'] as const

const companyFields = [
  { label: 'نام شرکت', name: 'companyName', placeholder: 'نام رسمی شرکت را وارد کنید' },
  { label: 'شناسه ملی', name: 'nationalId', placeholder: 'شناسه ملی ۱۱ رقمی شرکت' },
  { label: 'شماره ثبت', name: 'registrationNumber', placeholder: 'شماره ثبت شرکت را وارد کنید' },
  { label: 'نوع شرکت', name: 'companyType', placeholder: 'نوع شرکت را انتخاب کنید' },
  { label: 'استان', name: 'province', placeholder: 'استان محل ثبت را انتخاب کنید' },
  { label: 'شهر', name: 'city', placeholder: 'شهر محل ثبت را انتخاب کنید' },
] as const

const representativeFields = [
  {
    label: 'نام و نام خانوادگی',
    name: 'fullName',
    placeholder: 'نام و نام خانوادگی را وارد کنید',
    inputMode: 'text',
  },
  { label: 'سمت', name: 'role', placeholder: 'سمت خود را در شرکت انتخاب کنید', inputMode: 'text' },
  { label: 'شماره موبایل', name: 'mobile', placeholder: 'مثلاً ۰۹۱۲۱۲۳۴۵۶۷', inputMode: 'tel' },
  { label: 'ایمیل', name: 'email', placeholder: 'مثلاً example@company.ir', inputMode: 'email' },
] as const

const registerInputClasses = {
  className: 'text-sm leading-6 text-neutral-800 placeholder:text-neutral-300',
  containerClassName: 'h-12 rounded-lg border-neutral-200 px-3 py-2 shadow-none',
  wrapperClassName:
    'gap-2 [&_label]:text-sm [&_label]:leading-5 [&_label]:font-normal [&_label]:text-neutral-700',
} as const

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmationVisible, setConfirmationVisible] = useState(false)

  const goBack = () => setStep((currentStep) => Math.max(1, currentStep - 1))
  const goForward = () => setStep((currentStep) => Math.min(3, currentStep + 1))

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[520px] flex-col px-6 pt-8 pb-6 lg:h-svh lg:min-h-0 lg:px-5 lg:pt-10 lg:pb-8">
      <header className="shrink-0">
        <Typography
          asChild
          className="inline-flex items-center gap-2 transition-colors hover:text-neutral-800"
          color="neutral-600"
          variant="16/regular"
        >
          <Link href="/login">
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

      <form className="flex min-h-0 flex-1 flex-col pt-11" aria-label="فرم ثبت شرکت">
        <div
          className="flex flex-col gap-7 ps-0.5 pe-3.5 lg:min-h-0 lg:flex-1 lg:[scrollbar-width:thin] lg:[scrollbar-color:var(--neutral-300)_transparent] lg:overflow-y-auto"
          key={step}
        >
          {step === 1 &&
            companyFields.map((field) => (
              <Input
                {...registerInputClasses}
                id={`register-${field.name}`}
                inputSize="lg"
                key={field.name}
                label={field.label}
                name={field.name}
                placeholder={field.placeholder}
              />
            ))}

          {step === 2 &&
            representativeFields.map((field) => (
              <Input
                {...registerInputClasses}
                id={`register-${field.name}`}
                inputMode={field.inputMode}
                inputSize="lg"
                key={field.name}
                label={field.label}
                name={field.name}
                placeholder={field.placeholder}
              />
            ))}

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
                id="register-password"
                inputSize="lg"
                label="رمز عبور"
                name="password"
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
                id="register-password-confirmation"
                inputSize="lg"
                label="تکرار رمز عبور"
                name="passwordConfirmation"
                placeholder="رمز عبور خود را دوباره وارد کنید"
                type={confirmationVisible ? 'text' : 'password'}
              />
            </>
          )}
        </div>

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
            <Button size="40" type="button">
              ثبت شرکت
            </Button>
          )}
        </footer>
      </form>
    </div>
  )
}
