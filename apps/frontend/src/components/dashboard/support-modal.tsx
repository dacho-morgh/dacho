'use client'

import {
  CheckCircle2,
  Mail,
  Phone,
  Send,
  X,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { DashboardUserTagIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { createSupportTicket } from '@/utilities/dashboard-api'

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
  { id: 'normal', label: 'عادی', color: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
  { id: 'important', label: 'مهم', color: 'bg-warning-50 text-warning-500 border-warning-200' },
  { id: 'urgent', label: 'فوری', color: 'bg-error-50 text-error-600 border-error-200' },
] as const

export function SupportModal({ isOpen, onClose, onSuccess }: SupportModalProps) {
  const [category, setCategory] = useState<string>(SUPPORT_CATEGORIES[0])
  const [priority, setPriority] = useState<string>('normal')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [trackingCode, setTrackingCode] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await createSupportTicket({
        subject: `[${category} / ${priority}] ${subject.trim()}`,
        message: `${message.trim()}${phone.trim() ? `\n\nشماره تماس: ${phone.trim()}` : ''}`,
      })
      const generatedCode = result.ticket.id
      setIsSubmitting(false)
      setTrackingCode(generatedCode)
      if (onSuccess) onSuccess(generatedCode)
    } catch {
      setIsSubmitting(false)
      setSubmitError('ارسال پیام انجام نشد. لطفاً دوباره تلاش کنید.')
    }
  }

  const handleReset = () => {
    setCategory(SUPPORT_CATEGORIES[0])
    setPriority('normal')
    setSubject('')
    setMessage('')
    setPhone('')
    setTrackingCode(null)
    setSubmitError(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs transition-opacity duration-200"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <DashboardUserTagIcon className="size-6" />
            </div>
            <div>
              <Typography as="h2" id="support-modal-title" variant="20/bold" className="text-neutral-700">
                پیام به پشتیبانی
              </Typography>
              <Typography variant="12/regular" className="text-neutral-400">
                کارخانه نوآوری صنایع انرژی بوشهر
              </Typography>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex size-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-brand-500"
            aria-label="بستن پنجره"
          >
            <X className="size-5" />
          </button>
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
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`h-8 rounded-lg px-3 text-xs transition-all ${
                        category === cat
                          ? 'bg-brand-500 font-medium text-white shadow-xs'
                          : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {cat}
                    </button>
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
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id)}
                      className={`flex h-8 flex-1 items-center justify-center rounded-lg border text-xs transition-all ${
                        priority === p.id
                          ? `${p.color} font-semibold ring-2 ring-brand-500/20`
                          : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="support-subject" className="mb-1.5 block">
                  <Typography variant="14/semibold" className="text-neutral-700">
                    عنوان پیام <span className="text-error-600">*</span>
                  </Typography>
                </label>
                <input
                  id="support-subject"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="مثال: سوال در خصوص مدارک همایش یا درخواست اصلاح نامه"
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-700 placeholder:text-neutral-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                />
              </div>

              {/* Contact Phone (Optional) */}
              <div>
                <label htmlFor="support-phone" className="mb-1.5 block">
                  <Typography variant="14/semibold" className="text-neutral-700">
                    شماره همراه جهت تماس ضروری <span className="text-xs text-neutral-400">(اختیاری)</span>
                  </Typography>
                </label>
                <input
                  id="support-phone"
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="۰۹۱۲..."
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-left text-sm text-neutral-700 placeholder:text-neutral-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                />
              </div>

              {/* Message Body */}
              <div>
                <label htmlFor="support-message" className="mb-1.5 block">
                  <Typography variant="14/semibold" className="text-neutral-700">
                    متن پیام / شرح درخواست <span className="text-error-600">*</span>
                  </Typography>
                </label>
                <textarea
                  id="support-message"
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="توضیحات کامل درخواست یا سوال خود را اینجا یادداشت فرمایید..."
                  className="w-full rounded-xl border border-neutral-200 bg-white p-3.5 text-sm leading-relaxed text-neutral-700 placeholder:text-neutral-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline-gray"
                  size="48"
                  onClick={handleReset}
                  className="rounded-xl px-5"
                >
                  انصراف
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="48"
                  disabled={isSubmitting || !subject.trim() || !message.trim()}
                  className="rounded-xl px-6"
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
          )}
        </div>
      </div>
    </div>
  )
}
