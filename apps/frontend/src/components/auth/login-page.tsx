'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { BrandSandoqLogomark, BrandSandoqLogotype, DashboardEyeIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import { getExplicitSafeReturnUrl, getSafeReturnUrl } from '@/utilities/auth-return-url'

type Notice = { kind: 'error' | 'info'; message: string } | null

export default function LoginPage({
  registered = false,
  expired = false,
  loggedOut = false,
  returnUrl,
}: {
  registered?: boolean
  expired?: boolean
  loggedOut?: boolean
  returnUrl?: string | string[]
}) {
  const explicitReturnUrl = getExplicitSafeReturnUrl(returnUrl)
  const safeReturnUrl = getSafeReturnUrl(returnUrl)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice>(
    expired
      ? { kind: 'info', message: 'نشست قبلی شما پایان یافته است. برای ادامه دوباره وارد شوید.' }
      : loggedOut
        ? { kind: 'info', message: 'با موفقیت از حساب کاربری خارج شدید.' }
      : registered
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

      if (response.status === 401 || response.status === 403) {
        setNotice({ kind: 'error', message: 'شماره تلفن، ایمیل یا رمز عبور صحیح نیست.' })
        return
      }
      if (!response.ok) {
        setNotice({ kind: 'error', message: 'ورود در دسترس نیست. کمی بعد دوباره تلاش کنید.' })
        return
      }

      const payload = (await response.json().catch(() => null)) as {
        user?: { contentEditor?: boolean | null }
      } | null
      const user = payload?.user
      const capabilityResponse = await fetch('/api/dashboard/capabilities', { cache: 'no-store' })
      if (capabilityResponse.status === 401) {
        setNotice({ kind: 'error', message: 'نشست ورود تأیید نشد. دوباره وارد شوید.' })
        return
      }
      if (capabilityResponse.status === 403) {
        if (user?.contentEditor === true) {
          window.location.replace('/admin')
          return
        }
        setNotice({
          kind: 'error',
          message: 'ورود انجام شد، اما دسترسی فعالی برای ورود به پیشخوان پیدا نشد. با پشتیبانی سامانه تماس بگیرید.',
        })
        return
      }
      if (!capabilityResponse.ok) {
        setNotice({ kind: 'error', message: 'ورود انجام شد، اما سرویس دسترسی پاسخ نداد. کمی بعد دوباره تلاش کنید.' })
        return
      }

      const capabilities = (await capabilityResponse.json()) as {
        destinations?: string[]
      }
      const landing = capabilities.destinations?.[0] ?? '/dashboard'
      let destination = landing
      if (explicitReturnUrl) {
        const requestedPath = explicitReturnUrl.split(/[?#]/, 1)[0]
        const accessResponse = await fetch(
          `/api/dashboard/access?path=${encodeURIComponent(requestedPath)}`,
          { cache: 'no-store' },
        )
        if (accessResponse.status === 401) {
          setNotice({ kind: 'error', message: 'نشست ورود تأیید نشد. دوباره وارد شوید.' })
          return
        }
        if (accessResponse.status === 403) {
          destination = '/dashboard?access=denied'
        } else if (!accessResponse.ok) {
          setNotice({ kind: 'error', message: 'ورود انجام شد، اما بررسی نشانی درخواستی در دسترس نیست.' })
          return
        } else {
          const access = (await accessResponse.json().catch(() => null)) as { allowed?: boolean } | null
          destination = access?.allowed ? explicitReturnUrl : '/dashboard?access=denied'
        }
      }
      // Authentication changes server-visible cookie state. A document-level
      // navigation guarantees that the protected route is requested with the
      // newly stored cookie instead of reusing an unauthenticated router cache.
      window.location.replace(destination)
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
      message: 'بازیابی آنلاین رمز عبور در حال حاضر فعال نیست. برای بازیابی رمز عبور با پشتیبانی تماس بگیرید.',
    })
  }

  return (
    <div className="flex min-h-svh w-full items-start justify-center px-5 py-8 min-[480px]:items-center min-[480px]:px-6 min-[480px]:py-12">
      <form
        className="relative flex w-full max-w-[360px] flex-col gap-16"
        onSubmit={handleSubmit}
        aria-label="فرم ورود"
      >
        <div
          className="flex h-[164px] flex-col items-center justify-center gap-6"
          aria-label="کارخانه نوآوری صنایع انرژی بوشهر"
        >
          <BrandSandoqLogomark
            aria-hidden="true"
            className="h-20 w-[94px] text-brand-500"
          />
          <BrandSandoqLogotype
            aria-label="کارخانه نوآوری صنایع انرژی بوشهر"
            className="h-[60px] w-[168px] text-brand-500"
            role="img"
          />
        </div>

        <div className="flex flex-col gap-8">
          <Input
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            className="text-base leading-7 text-neutral-800 placeholder:text-neutral-300"
            containerClassName="h-10 rounded-lg border-neutral-100 px-2 py-2 shadow-none"
            id="login-identifier"
            inputMode="text"
            inputSize="lg"
            label="شماره تلفن همراه / آدرس ایمیل"
            name="identifier"
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="شماره تلفن همراه یا ایمیل خود را وارد کنید"
            required
            value={identifier}
            wrapperClassName="gap-2"
          />

          <div className="flex flex-col gap-4">
            <Input
              autoComplete="current-password"
              className="text-base leading-7 text-neutral-800 placeholder:text-neutral-300"
              containerClassName="h-10 rounded-lg border-neutral-100 px-2 py-2 shadow-none"
              endIcon={
                <Button
                  aria-label={passwordVisible ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                  className="size-9 text-neutral-300 hover:text-neutral-500"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  size="icon-36"
                  type="button"
                  variant="text-gray"
                >
                  <DashboardEyeIcon aria-hidden="true" className="size-5" />
                </Button>
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
              wrapperClassName="gap-2"
            />

            <Typography
              as="p"
              className="flex h-9 items-center gap-1 px-2"
              color="neutral-600"
              variant="14/regular"
            >
              <span>رمز عبور خود را فراموش کرده‌اید؟</span>
              <Button
                className="cursor-pointer border-0 bg-transparent font-[inherit] text-neutral-600"
                onClick={showRecoveryNotice}
                size="clear"
                type="button"
                variant="text-gray"
              >
                <Typography as="span" variant="16/regular" color="neutral-600">
                  اینجا کلیک کنید
                </Typography>
              </Button>
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
              <Typography as="span" variant="16/regular" color="brand">
                ثبت‌نام کنید
              </Typography>
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
