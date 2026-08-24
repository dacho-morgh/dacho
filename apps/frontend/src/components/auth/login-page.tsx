'use client'

import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Notice = { kind: 'error' | 'info'; message: string } | null

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

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

      router.replace('/dashboard')
      router.refresh()
    } catch {
      setNotice({
        kind: 'error',
        message: 'در حال حاضر ارتباط با سامانه برقرار نیست. کمی بعد دوباره تلاش کنید.',
      })
    } finally {
      setLoading(false)
    }
  }

  const showPlannedFlow = (flow: 'register' | 'recovery') => {
    setNotice({
      kind: 'info',
      message:
        flow === 'register'
          ? 'ثبت‌نام با شماره تلفن در مرحله بعدی این سامانه فعال می‌شود.'
          : 'بازیابی رمز عبور در مرحله بعدی این سامانه فعال می‌شود.',
    })
  }

  return (
    <main className="flex min-h-svh w-full overflow-hidden">
      <div className="hidden flex-1 justify-center lg:flex">
        <aside
          className="relative m-[40px_40px_40px_0] w-full min-w-0 overflow-hidden rounded-[40px] lg:block"
          aria-label="معرفی فضای نوآوری"
        >
          <Image
            alt="فضای خلاق یادگیری و کارآفرینی"
            className="aspect-4/5 object-cover"
            fill
            priority
            sizes="(min-width: 1024px) 47vw, 0px"
            src="/figma/login/login-hero.png"
          />
          <div className="absolute inset-x-10 bottom-10 flex h-[200px] flex-col justify-between gap-5 rounded-[20px] border border-white/25 bg-white/10 p-5 text-white shadow-[0_0_40px_rgb(21_21_21/10%)] backdrop-blur-[20px]">
            <div>
              <h2 className="mb-2.5 text-2xl leading-9 font-bold">پناه امنی برای کارآفرینان</h2>
              <p className="m-0 max-w-[540px] text-base leading-7 font-normal">
                کارآفرینی حرفه‌ای، شبیه عبور از رودخانه‌ای خروشان است؛ جایی که چالش‌ها مسیر رشد را
                می‌سازند.
              </p>
            </div>
            <div
              aria-label="اسلاید یک از چند"
              className="flex gap-[18px] text-[22px] [direction:ltr]"
            >
              <span aria-hidden="true">←</span>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        </aside>
      </div>
      <section
        className="flex min-h-svh min-w-0 flex-1 items-start justify-center px-5 py-8 min-[480px]:items-center min-[480px]:px-6 min-[480px]:py-12 lg:px-8"
        aria-label="فرم ورود"
      >
        <form
          className="relative flex w-full max-w-[360px] flex-col gap-10 min-[480px]:gap-16"
          onSubmit={handleSubmit}
        >
          <div
            className="flex h-[132px] flex-col items-center justify-center gap-[18px] min-[480px]:h-[164px] min-[480px]:gap-6"
            aria-label="کارخانه نوآوری صنایع انرژی بوشهر"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="h-auto w-[62px] min-[480px]:h-16 min-[480px]:w-[74px]"
              height={64}
              priority
              src="/logo/sandoq-logomark.svg"
              width={74}
            />
            <Image
              alt="کارخانه نوآوری صنایع انرژی بوشهر"
              className="h-auto w-[140px] min-[480px]:h-[60px] min-[480px]:w-[168px]"
              height={60}
              priority
              src="/logo/sandoq-logotype.svg"
              width={168}
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

              <p className="m-0 flex h-9 items-center gap-1 px-2 text-sm leading-7 font-normal text-neutral-600">
                <span>رمز عبور خود را فراموش کرده‌اید؟</span>
                <button
                  className="cursor-pointer border-0 bg-transparent font-[inherit] text-blue-500"
                  onClick={() => showPlannedFlow('recovery')}
                  type="button"
                >
                  اینجا کلیک کنید
                </button>
              </p>
            </div>
          </div>

          <div className="flex h-[104px] flex-col gap-5">
            <Button className="w-full" loading={loading} size="48" type="submit">
              ورود
            </Button>
            <p className="m-0 flex h-9 items-center justify-center gap-1 px-2 text-sm leading-7 font-normal text-neutral-600">
              <span>آیا حساب کاربری ندارید؟</span>
              <button
                className="cursor-pointer border-0 bg-transparent font-[inherit] text-blue-500"
                onClick={() => showPlannedFlow('register')}
                type="button"
              >
                ثبت نام کنید
              </button>
            </p>
          </div>

          <p
            aria-live="polite"
            className={`absolute top-[calc(100%+12px)] m-0 min-h-5 w-full text-center text-[13px] leading-5 ${
              notice ? 'block' : 'hidden'
            } ${notice?.kind === 'error' ? 'text-red-700' : 'text-neutral-600'}`}
            data-kind={notice?.kind}
            role={notice?.kind === 'error' ? 'alert' : 'status'}
          >
            {notice?.message}
          </p>
        </form>
      </section>
    </main>
  )
}
