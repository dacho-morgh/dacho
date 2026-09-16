'use client'

import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

type MessageFormProps = {
  className?: string
  /** ID of the Payload `forms` doc this form submits to (from seed-forms.ts). */
  formId?: number | null
}

type Notice = { kind: 'error' | 'success'; message: string } | null

export function MessageForm({ className, formId }: MessageFormProps) {
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formId) return
    setLoading(true)
    setNotice(null)

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const submissionData = [
      { field: 'fullName', value: String(form.get('fullName') ?? '') },
      { field: 'email', value: String(form.get('email') ?? '') },
      { field: 'phone', value: String(form.get('phone') ?? '') },
      { field: 'subject', value: String(form.get('subject') ?? '') },
      { field: 'message', value: String(form.get('message') ?? '') },
    ]

    try {
      const response = await fetch('/api/form-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form: formId, submissionData }),
      })

      if (!response.ok) {
        setNotice({ kind: 'error', message: 'ارسال پیام انجام نشد. لطفاً دوباره تلاش کنید.' })
        return
      }

      formElement.reset()
      setNotice({ kind: 'success', message: 'پیام شما با موفقیت ارسال شد.' })
    } catch {
      setNotice({ kind: 'error', message: 'در حال حاضر ارتباط با سامانه برقرار نیست. کمی بعد دوباره تلاش کنید.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      className={cn(
        'grid gap-6 rounded-[32px] bg-white p-5 shadow-[0_8px_32px_rgb(23_23_23/0.06)] sm:p-8 lg:grid-cols-2 lg:p-10',
        className,
      )}
      onSubmit={handleSubmit}
    >
      <Input
        autoComplete="name"
        label="نام و نام خانوادگی"
        name="fullName"
        placeholder="نام و نام خانوادگی را وارد کنید"
        required
      />
      <Input
        autoComplete="email"
        label="ایمیل"
        name="email"
        placeholder="مثلا example@company.ir"
        required
        type="email"
      />
      <Input
        autoComplete="tel"
        inputMode="tel"
        label="شماره همراه"
        name="phone"
        placeholder="مثلا ۰۹۱۲۳۴۵۶۷۸۹"
        required
        type="tel"
      />
      <Input label="موضوع" name="subject" placeholder="موضوع پیام" required />

      <div className="flex flex-col gap-2 lg:col-span-2">
        <Typography
          as="label"
          className="cursor-pointer select-none"
          color="neutral-600"
          htmlFor="message"
          variant="16/regular"
        >
          پیام
        </Typography>
        <textarea
          className="min-h-48 w-full resize-y rounded-lg border border-neutral-100 bg-white p-3 text-right text-base leading-7 text-neutral-600 transition-colors outline-none placeholder:font-light placeholder:text-neutral-400 hover:border-brand-500 focus:border-brand-500"
          id="message"
          name="message"
          placeholder="پیام خود را در اینجا وارد کنید"
          required
        />
      </div>

      <div className="flex flex-col items-start gap-4 lg:col-span-2 lg:items-end">
        <Button className="w-full sm:w-fit" disabled={!formId} loading={loading} size="40" type="submit">
          ارسال پیام
          <ArrowLeft aria-hidden="true" />
        </Button>

        {notice && (
          <Typography
            aria-live="polite"
            as="p"
            className="text-center sm:text-right"
            color={notice.kind === 'success' ? 'neutral-600' : 'error'}
            role={notice.kind === 'error' ? 'alert' : 'status'}
            variant="14/regular"
          >
            {notice.message}
          </Typography>
        )}
      </div>
    </form>
  )
}
