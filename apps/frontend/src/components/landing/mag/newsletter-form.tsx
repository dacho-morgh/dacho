'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState(false)

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setStatus('')
    try {
      const response = await fetch('/api/mag/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      setStatus(response.ok ? 'عضویت شما ثبت شد.' : result.error || 'ثبت ایمیل انجام نشد.')
      if (response.ok) setEmail('')
    } catch {
      setStatus('ارتباط برقرار نشد. دوباره تلاش کنید.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={subscribe} className="flex w-full shrink-0 flex-col gap-4 md:max-w-52">
      <input
        type="email"
        required
        maxLength={254}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-label="آدرس ایمیل شما"
        placeholder="آدرس ایمیل شما"
        className="h-12 rounded-xl border border-neutral-200 bg-white px-4 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-brand-500"
      />
      <Button
        type="submit"
        disabled={pending}
        variant="primary"
        size="48"
        className="w-full text-base"
      >
        <Typography as="span" variant="16/semibold" color="white">
          {pending ? 'در حال ثبت...' : 'عضویت در خبرنامه'}
        </Typography>
      </Button>
      {status && (
        <Typography as="p" role="status" variant="14/regular" color="neutral-600">
          {status}
        </Typography>
      )}
    </form>
  )
}
