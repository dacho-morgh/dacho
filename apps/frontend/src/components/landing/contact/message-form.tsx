import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

type MessageFormProps = {
  className?: string
}

export function MessageForm({ className }: MessageFormProps) {
  return (
    <form
      className={cn(
        'grid gap-6 rounded-[32px] bg-white p-5 shadow-[0_8px_32px_rgb(23_23_23/0.06)] sm:p-8 lg:grid-cols-2 lg:p-10',
        className,
      )}
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

      <Button className="w-full sm:w-fit lg:col-span-2 lg:justify-self-end" size="40" type="submit">
        ارسال پیام
        <ArrowLeft aria-hidden="true" />
      </Button>
    </form>
  )
}
