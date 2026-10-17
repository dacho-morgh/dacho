'use client'

import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { BrandSandoqLogomark, BrandSandoqLogotype } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import { getSafeReturnUrl } from '@/utilities/auth-return-url'

type Notice = { kind: 'error' | 'info'; message: string } | null

export default function LoginPage({
  registered = false,
  returnUrl = '/dashboard',
}: {
  registered?: boolean
  returnUrl?: string
}) {
  const safeReturnUrl = getSafeReturnUrl(returnUrl)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice>(
    registered
      ? { kind: 'info', message: 'ثبت‌نام با موفقیت انجام شد. اکنون می‌توانید وارد شوید.' }
      : null,
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setNotice(null)

    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier.trim(), password }),
      })

      if (!response.ok) {
        setNotice({ kind: 'error', message: 'شماره تلفن، ایمیل یا رمز عبور صحیح نیست.' })
        return
      }

      const payload = (await response.json().catch(() => null)) as { user?: { roles?: string[] | null } } | null
      const user = payload?.user
      const destination =
        safeReturnUrl && safeReturnUrl !== '/login'
          ? safeReturnUrl
          : Array.isArray(user?.roles) && user.roles.includes('admin')
            ? '/admin'
            : '/dashboard'
      // Authentication changes server-visible cookie state. A document-level
      // navigation guarantees that the protected route is requested with the
      // newly stored cookie instead of reusing an unauthenticated router cache.
      window.location.assign(destination)
    } catch {
      setNotice({
        kind: 'error',
        message: 'در حال حاضر ارتباط با سامانه برقرار نیست. کمی بعد دوباره تلاش کنید.',
      })
    } finally {
      setLoading(false)
    }
  }

  const showRecoveryNotice = () => {
    setNotice({
      kind: 'info',
      message: 'بازیابی رمز عبور در مرحله بعدی این سامانه فعال می‌شود.',
    })
  }

  return (
    <div className="flex min-h-svh w-full items-start justify-center px-5 py-8 min-[480px]:items-center min-[480px]:px-6 min-[480px]:py-12">
      <form
        className="relative flex w-full max-w-[360px] flex-col gap-10 min-[480px]:gap-16"
        onSubmit={handleSubmit}
        aria-label="فرم ورود"
      >
        <div
          className="flex h-[132px] flex-col items-center justify-center gap-[18px] min-[480px]:h-[164px] min-[480px]:gap-6"
          aria-label="کارخانه نوآوری صنایع انرژی بوشهر"
        >
          <BrandSandoqLogomark
            aria-hidden="true"
            className="h-auto w-[62px] text-brand-500 min-[480px]:h-16 min-[480px]:w-[74px]"
          />
          <BrandSandoqLogotype
            aria-label="کارخانه نوآوری صنایع انرژی بوشهر"
            className="h-auto w-[140px] text-brand-500 min-[480px]:h-[60px] min-[480px]:w-[168px]"
            role="img"
          />
        </div>

        <div className="flex flex-col gap-8">
          <Input
            autoComplete="username"
            className="text-sm leading-6 text-neutral-800 placeholder:text-neutral-300"
            containerClassName="h-12 rounded-lg border-neutral-200 px-3 py-2 shadow-none"
            id="login-identifier"
            inputMode="email"
            inputSize="lg"
            label="شماره تلفن همراه / آدرس ایمیل"
            name="identifier"
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="شماره تلفن همراه یا ایمیل خود را وارد کنید"
            required
            value={identifier}
            wrapperClassName="gap-2 [&_label]:text-sm [&_label]:leading-5 [&_label]:font-normal [&_label]:text-neutral-700"
          />

          <div className="flex flex-col gap-4">
            <Input
              autoComplete="current-password"
              className="text-sm leading-6 text-neutral-800 placeholder:text-neutral-300"
              containerClassName="h-12 rounded-lg border-neutral-200 px-3 py-2 shadow-none"
              endIcon={
                <button
                  aria-label={passwordVisible ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                  className="inline-flex size-6 cursor-pointer items-center justify-center border-0 bg-transparent text-neutral-300 transition-colors hover:text-neutral-500 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-brand-500"
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
              id="login-password"
              inputSize="lg"
              label="رمز عبور"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="رمز عبور خود را وارد کنید"
              required
              type={passwordVisible ? 'text' : 'password'}
              value={password}
              wrapperClassName="gap-2 [&_label]:text-sm [&_label]:leading-5 [&_label]:font-normal [&_label]:text-neutral-700"
            />

            <Typography
              as="p"
              className="flex h-9 items-center gap-1 px-2"
              color="neutral-600"
              variant="14/regular"
            >
              <span>رمز عبور خود را فراموش کرده‌اید؟</span>
              <button
                className="cursor-pointer border-0 bg-transparent font-[inherit] text-brand-500"
                onClick={showRecoveryNotice}
                type="button"
              >
                اینجا کلیک کنید
              </button>
            </Typography>
          </div>
        </div>

        <div className="flex h-[104px] flex-col gap-5">
          <Button className="w-full" loading={loading} size="48" type="submit">
            ورود
          </Button>
          <Typography
            as="p"
            className="flex h-9 items-center justify-center gap-1 px-2"
            color="neutral-600"
            variant="14/regular"
          >
            <span>آیا حساب کاربری ندارید؟</span>
            <Link
              className="text-brand-500"
              href={`/register?returnUrl=${encodeURIComponent(safeReturnUrl)}`}
            >
              ثبت‌نام کنید
            </Link>
          </Typography>
        </div>

        <Typography
          aria-live="polite"
          as="p"
          className={`absolute top-[calc(100%+12px)] min-h-5 w-full text-center ${
            notice ? 'block' : 'hidden'
          } ${notice?.kind === 'error' ? 'text-error-500' : 'text-neutral-600'}`}
          data-kind={notice?.kind}
          role={notice?.kind === 'error' ? 'alert' : 'status'}
          variant="12/regular"
        >
          {notice?.message}
        </Typography>
      </form>
    </div>
  )
}
