'use client'

import {
  CheckCircle2,
  Mail,
  Phone,
  Send,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { DashboardUserTagIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Typography } from '@/components/ui/typography'
import { createSupportTicket } from '@/utilities/dashboard-api'
import { Form, FormField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { resolver } from './owner-admin'

export interface SupportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (trackingCode: string) => void
}

const SUPPORT_CATEGORIES = [
  'پشتیبانی فنی سامانه',
  'پیگیری نامه‌ها و درخواست‌ها',
  'خدمات نمایشگاهی و رویدادها',
  'تأمین مالی و سرمایه‌گذاری',
  'سایر موضوعات',
] as const

const PRIORITIES = [
  { id: 'normal', label: 'عادی' },
  { id: 'important', label: 'مهم' },
  { id: 'urgent', label: 'فوری' },
] as const

const supportSchema = z.object({
  subject: z.string().trim().min(1, 'عنوان پیام را بنویسید.'),
  phone: z.string().trim(),
  message: z.string().trim().min(1, 'متن پیام را بنویسید.'),
})
type SupportValues = z.infer<typeof supportSchema>
const EMPTY_SUPPORT: SupportValues = { subject: '', phone: '', message: '' }

export function SupportModal({ isOpen, onClose, onSuccess }: SupportModalProps) {
  const [category, setCategory] = useState<string>(SUPPORT_CATEGORIES[0])
  const [priority, setPriority] = useState<string>('normal')
  const form = useForm<SupportValues>({ resolver: resolver(supportSchema), defaultValues: EMPTY_SUPPORT })
  const { isSubmitting } = form.formState
  const [trackingCode, setTrackingCode] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!isOpen) return null

  // A failed send keeps every field as typed; only a successful one moves on.
  const submit = async ({ subject, phone, message }: SupportValues) => {
    setSubmitError(null)
    try {
      const result = await createSupportTicket({
        subject: `[${category} / ${priority}] ${subject}`,
        message: `${message}${phone ? `\n\nشماره تماس: ${phone}` : ''}`,
      })
      const generatedCode = result.ticket.id
      setTrackingCode(generatedCode)
      if (onSuccess) onSuccess(generatedCode)
    } catch {
      setSubmitError('ارسال پیام انجام نشد. لطفاً دوباره تلاش کنید.')
    }
  }

  const handleReset = () => {
    setCategory(SUPPORT_CATEGORIES[0])
    setPriority('normal')
    form.reset(EMPTY_SUPPORT)
    setTrackingCode(null)
    setSubmitError(null)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleReset()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-h-[90vh] max-w-xl gap-0 overflow-hidden p-0 sm:p-0"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <DashboardUserTagIcon className="size-6" />
            </div>
            <div>
              <DialogTitle asChild>
                <Typography as="h2" id="support-modal-title" variant="20/bold" className="text-neutral-700">
                  پیام به پشتیبانی
                </Typography>
              </DialogTitle>
              <Typography variant="12/regular" className="text-neutral-400">
                کارخانه نوآوری صنایع انرژی بوشهر
              </Typography>
            </div>
          </div>
          <Button variant="text-gray" size="icon-32"
            type="button"
            onClick={handleReset}
            aria-label="بستن پنجره"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {trackingCode ? (
            /* Success State */
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-success-50 text-success-500">
                <CheckCircle2 className="size-10" />
              </div>
              <Typography as="h3" variant="20/bold" className="mt-4 text-neutral-700">
                پیام شما با موفقیت ارسال شد
              </Typography>
              <Typography variant="14/regular" className="mt-2 text-neutral-500">
                درخواست شما در صف بررسی کارشناسان پشتیبانی قرار گرفت و در سریع‌ترین زمان ممکن پاسخ داده خواهد شد.
              </Typography>

              <div className="mt-6 flex flex-col items-center gap-1 rounded-xl border border-neutral-100 bg-neutral-50 px-6 py-3">
                <Typography variant="12/regular" className="text-neutral-400">
                  کد پیگیری پشتیبانی
                </Typography>
                <span className="font-mono text-lg font-bold tracking-wider text-brand-600">
                  {trackingCode}
                </span>
              </div>

              <div className="mt-8 flex w-full justify-center">
                <Button
                  type="button"
                  variant="primary"
                  size="48"
                  onClick={handleReset}
                  className="w-full sm:w-48"
                >
                  بازگشت به کارتابل
                </Button>
              </div>
            </div>
          ) : (
            /* Form View */
            <Form {...form}>
            <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-4">
              {submitError && <Typography role="alert" variant="14/regular" className="text-error-600">{submitError}</Typography>}
              {/* Quick Contact Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-brand-600" />
                  <span>تلفن تماس: ۰۷۷-۳۱۵۵۰۰۰۰</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-brand-600" />
                  <span>support@dacho.ir</span>
                </div>
              </div>

              {/* Department / Category */}
              <div>
                <label className="mb-1.5 block">
                  <Typography variant="14/semibold" className="text-neutral-700">
                    موضوع کلی / دپارتمان
                  </Typography>
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUPPORT_CATEGORIES.map((cat) => (
                    <Button
                      key={cat}
                      type="button"
                      variant="chip"
                      size="32"
                      aria-pressed={category === cat}
                      onClick={() => setCategory(cat)}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1.5 block">
                  <Typography variant="14/semibold" className="text-neutral-700">
                    اولویت رسیدگی
                  </Typography>
                </label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant="chip"
                      size="32"
                      className="flex-1"
                      aria-pressed={priority === p.id}
                      onClick={() => setPriority(p.id)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <FormField
                control={form.control}
                name="subject"
                label={<>عنوان پیام <span className="text-error-600">*</span></>}
                render={({ field, controlProps }) => (
                  <Input {...field} {...controlProps} type="text" aria-required="true" placeholder="مثال: سوال در خصوص مدارک همایش یا درخواست اصلاح نامه" />
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                label={<>شماره همراه جهت تماس ضروری <span className="text-neutral-400">(اختیاری)</span></>}
                render={({ field, controlProps }) => (
                  <Input {...field} {...controlProps} type="tel" dir="ltr" placeholder="۰۹۱۲..." />
                )}
              />

              <FormField
                control={form.control}
                name="message"
                label={<>متن پیام / شرح درخواست <span className="text-error-600">*</span></>}
                render={({ field, controlProps }) => (
                  <Textarea {...field} {...controlProps} aria-required="true" rows={4} placeholder="توضیحات کامل درخواست یا سوال خود را اینجا یادداشت فرمایید..." />
                )}
              />

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline-gray"
                  size="48"
                  onClick={handleReset}
                >
                  انصراف
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="48"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    'در حال ارسال...'
                  ) : (
                    <>
                      <span>ارسال پیام</span>
                      <Send className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
