'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { formatFileSize, getRfpDownloadUrl } from '@/utilities/dashboard-api'
import {
  AdminError,
  Field,
  RequestError,
  adminRequest,
  cardClass,
  controlClass,
  loadPeople,
  resolver,
  type Person,
} from './owner-admin'

type Event = {
  id: string
  title: string
  description: string
  registrationOpenAt: string
  registrationCloseAt: string
  responsibleChiefId: string
  responsibleInvestmentId: string
  revision: number
}
const labels = {
  title: 'عنوان رویداد',
  description: 'شرح رویداد',
  registrationOpenAt: 'شروع ثبت‌نام (UTC)',
  registrationCloseAt: 'پایان ثبت‌نام (UTC)',
  responsibleChiefId: 'سردبیر مسئول',
  responsibleInvestmentId: 'مسئول سرمایه‌گذاری',
  reason: 'دلیل تغییر',
}
const required = z.string().trim().min(1, 'این فیلد الزامی است.')
const eventSchema = z
  .object({
    title: required,
    description: z.string().trim(),
    registrationOpenAt: required,
    registrationCloseAt: required,
    responsibleChiefId: required,
    responsibleInvestmentId: required,
    reason: z.string().trim(),
  })
  .superRefine((value, context) => {
    const openAt = Date.parse(`${value.registrationOpenAt}Z`)
    const closeAt = Date.parse(`${value.registrationCloseAt}Z`)
    if (!Number.isFinite(openAt))
      context.addIssue({
        code: 'custom',
        path: ['registrationOpenAt'],
        message: 'تاریخ معتبر وارد کنید.',
      })
    if (!Number.isFinite(closeAt) || closeAt <= openAt)
      context.addIssue({
        code: 'custom',
        path: ['registrationCloseAt'],
        message: 'پایان ثبت‌نام باید پس از شروع باشد.',
      })
  })
type Values = z.infer<typeof eventSchema>
function defaults(event?: Event): Values {
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    registrationOpenAt: event?.registrationOpenAt.replace(/Z$/, '') ?? '',
    registrationCloseAt: event?.registrationCloseAt.replace(/Z$/, '') ?? '',
    responsibleChiefId: event?.responsibleChiefId ?? '',
    responsibleInvestmentId: event?.responsibleInvestmentId ?? '',
    reason: '',
  }
}
function EventForm({
  event: initialEvent,
  people,
  onSaved,
  onCancel,
}: {
  event?: Event
  people: Person[]
  onSaved: () => void
  onCancel: () => void
}) {
  const [event, setEvent] = useState(initialEvent)
  const [failure, setFailure] = useState<unknown>(null)
  const [stale, setStale] = useState(false)
  const [reloading, setReloading] = useState(false)
  const busy = useRef(false)
  const schema = eventSchema.superRefine((value, context) => {
    if (event && !value.reason)
      context.addIssue({ code: 'custom', path: ['reason'], message: 'دلیل تغییر را وارد کنید.' })
    for (const field of ['responsibleChiefId', 'responsibleInvestmentId'] as const) {
      const role = field === 'responsibleChiefId' ? 'chief-reviewer' : 'investment-reviewer'
      if (
        !people.some(
          (person) =>
            String(person.id) === value[field] &&
            person.isActive &&
            person.operationalRole === role,
        )
      )
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'یک شخص فعال با نقش مناسب انتخاب کنید.',
        })
    }
  })
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: resolver(schema), defaultValues: defaults(event) })
  async function save(values: Values) {
    setFailure(null)
    const { reason, ...input } = values
    try {
      const result = await adminRequest(
        event
          ? `/api/dashboard/admin/events/${encodeURIComponent(event.id)}`
          : '/api/dashboard/admin/events',
        {
          method: event ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...input,
            registrationOpenAt: new Date(`${input.registrationOpenAt}Z`).toISOString(),
            registrationCloseAt: new Date(`${input.registrationCloseAt}Z`).toISOString(),
            ...(event ? { revision: event.revision, reason } : {}),
          }),
        },
      )
      if (!result.event?.id) throw new Error('invalid_event_response')
      onSaved()
    } catch (error) {
      setFailure(error)
      if (error instanceof AdminError) {
        if (error.status === 409) setStale(true)
        const fields = Array.isArray(error.data.fields)
          ? error.data.fields
          : error.data.field
            ? [error.data.field]
            : error.data.error === 'invalid_registration_window'
              ? ['registrationCloseAt']
              : []
        for (const field of fields)
          if (typeof field === 'string' && field in labels)
            setError(
              field as keyof Values,
              { message: 'سرور این مقدار را نپذیرفت؛ بررسی کنید.' },
              { shouldFocus: true },
            )
      }
    }
  }
  async function reload() {
    if (!event || reloading) return
    setReloading(true)
    try {
      const result = await adminRequest(
        `/api/dashboard/admin/events/${encodeURIComponent(event.id)}`,
      )
      if (!result.event?.id) throw new Error('invalid_event_response')
      setEvent(result.event)
      reset(defaults(result.event))
      setStale(false)
      setFailure(null)
    } catch (error) {
      setFailure(error)
    } finally {
      setReloading(false)
    }
  }
  return (
    <form
      aria-label="پیکربندی رویداد"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (busy.current || stale || reloading) return
        busy.current = true
        void handleSubmit(save)(event).finally(() => {
          busy.current = false
        })
      }}
      className="flex flex-col gap-5"
    >
      <fieldset
        disabled={isSubmitting || reloading}
        className={`${cardClass} grid gap-x-5 gap-y-8 sm:grid-cols-2`}
      >
        <Typography variant="20/bold" className="break-words sm:col-span-2">
          {event ? `ویرایش ${event.title}` : 'رویداد جدید'}
        </Typography>
        {event && (
          <Typography variant="14/regular" className="break-all sm:col-span-2">
            شناسه: {event.id} — نسخه ویرایش: {event.revision}
          </Typography>
        )}
        {(['title', 'description', 'registrationOpenAt', 'registrationCloseAt'] as const).map(
          (name) => (
            <Field key={name} name={name} label={labels[name]} error={errors[name]?.message}>
              {name === 'description' ? (
                <textarea id={name} className={`${controlClass} h-24 py-2`} {...register(name)} />
              ) : (
                <input
                  id={name}
                  type={name.startsWith('registration') ? 'datetime-local' : 'text'}
                  step={name.startsWith('registration') ? '0.001' : undefined}
                  dir={name.startsWith('registration') ? 'ltr' : 'rtl'}
                  aria-invalid={!!errors[name]}
                  aria-describedby={errors[name] ? `${name}-error` : undefined}
                  className={controlClass}
                  {...register(name)}
                />
              )}
            </Field>
          ),
        )}
        {(['responsibleChiefId', 'responsibleInvestmentId'] as const).map((name) => {
          const eligible = people.filter(
            (person) =>
              person.isActive &&
              person.operationalRole ===
                (name === 'responsibleChiefId' ? 'chief-reviewer' : 'investment-reviewer'),
          )
          return (
            <Field key={name} name={name} label={labels[name]} error={errors[name]?.message}>
              <select
                id={name}
                aria-invalid={!!errors[name]}
                aria-describedby={errors[name] ? `${name}-error` : undefined}
                className={controlClass}
                {...register(name)}
              >
                <option value="">انتخاب شخص</option>
                {eligible.map((person) => (
                  <option key={person.id} value={String(person.id)}>
                    {person.name || 'بدون نام'} — {person.phone || person.id}
                  </option>
                ))}
              </select>
              {eligible.length === 0 && (
                <Typography variant="14/regular" color="warning">
                  شخص واجد شرایط وجود ندارد؛ ابتدا حساب فعال بسازید.
                </Typography>
              )}
            </Field>
          )
        })}
        {event && (
          <Field name="reason" label={labels.reason} error={errors.reason?.message}>
            <input
              id="reason"
              className={controlClass}
              aria-invalid={!!errors.reason}
              aria-describedby={errors.reason ? 'reason-error' : undefined}
              {...register('reason')}
            />
          </Field>
        )}
        <Typography variant="14/regular" color="muted" className="sm:col-span-2">
          فرم‌های سیستم ثابت هستند. زمان‌ها به وقت UTC است. این پیکربندی عملیاتی مستقل از محتوای عمومی
          CMS است؛ تاریخ برگزاری و انتشار در این API وجود ندارد.
        </Typography>
      </fieldset>
      {failure !== null && <RequestError error={failure} returnTo="/dashboard/events" />}
      {failure instanceof AdminError && typeof failure.data.revision === 'number' && (
        <Typography variant="14/regular">نسخه فعلی سرور: {failure.data.revision}</Typography>
      )}
      {stale && (
        <>
          <Typography variant="14/regular">
            ویرایش شما حفظ شده است. بررسی نسخه جدید، فرم را با اطلاعات سرور جایگزین می‌کند.
          </Typography>
          <Button type="button" variant="outline" disabled={reloading} onClick={reload}>
            <Typography variant="14/regular">بررسی نسخه جدید</Typography>
          </Button>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting || stale || reloading}>
          <Typography variant="16/semibold">
            {isSubmitting ? 'در حال ذخیره...' : 'ذخیره رویداد'}
          </Typography>
        </Button>
        <Button
          type="button"
          variant="outline-gray"
          disabled={isSubmitting || reloading}
          onClick={onCancel}
        >
          <Typography variant="16/regular">بازگشت به فهرست</Typography>
        </Button>
      </div>
    </form>
  )
}

type EventCategory = {
  id: string
  eventId: string
  title: string
}

type EventSubtopic = {
  id: string
  eventId: string
  categoryId: string
  categoryTitle?: string
  title: string
  employerId: string
  currentRfpVersionId: string | null
}

type RfpFile = {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
}

type RfpVersion = {
  id: string
  subtopicId: string
  createdBy: string
  createdAt: string
  reason: string
  files: RfpFile[]
}

const categorySchema = z.object({
  title: z.string().trim().min(1, 'عنوان دسته را وارد کنید.'),
})
type CategoryValues = z.infer<typeof categorySchema>

function CategoryForm({
  eventId,
  onSaved,
  onCancel,
}: {
  eventId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [failure, setFailure] = useState<unknown>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryValues>({
    resolver: resolver(categorySchema),
    defaultValues: { title: '' },
  })

  async function save(values: CategoryValues) {
    setFailure(null)
    try {
      const result = await adminRequest(
        `/api/dashboard/admin/events/${encodeURIComponent(eventId)}/categories`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      )
      if (!result.category?.id) throw new Error('invalid_category_response')
      onSaved()
    } catch (error) {
      setFailure(error)
      if (error instanceof AdminError) {
        setError(
          'title',
          { message: 'عنوان دسته نامعتبر است یا سرور آن را نپذیرفت.' },
          { shouldFocus: true },
        )
      }
    }
  }

  return (
    <form
      aria-label="دسته فناوری جدید"
      noValidate
      onSubmit={handleSubmit(save)}
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
    >
      <Typography variant="16/semibold">افزودن دسته فناوری</Typography>
      <Field name="title" label="عنوان دسته فناوری" error={errors.title?.message}>
        <input
          id="title"
          className={controlClass}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
          {...register('title')}
        />
      </Field>
      {failure !== null && <RequestError error={failure} returnTo="/dashboard/events" />}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting}>
          <Typography variant="14/regular">
            {isSubmitting ? 'در حال ذخیره...' : 'ذخیره دسته'}
          </Typography>
        </Button>
        <Button type="button" variant="outline-gray" disabled={isSubmitting} onClick={onCancel}>
          <Typography variant="14/regular">انصراف</Typography>
        </Button>
      </div>
    </form>
  )
}

const subtopicSchema = z.object({
  title: z.string().trim().min(1, 'عنوان زیرعنوان را وارد کنید.'),
  categoryId: z.string().trim().min(1, 'دسته فناوری را انتخاب کنید.'),
  employerId: z.string().trim().min(1, 'کارفرمای مسئول را انتخاب کنید.'),
})
type SubtopicValues = z.infer<typeof subtopicSchema>

function SubtopicForm({
  eventId,
  categories,
  people,
  onSaved,
  onCancel,
}: {
  eventId: string
  categories: EventCategory[]
  people: Person[]
  onSaved: () => void
  onCancel: () => void
}) {
  const [failure, setFailure] = useState<unknown>(null)
  const eligibleEmployers = people.filter(
    (p) => p.isActive && p.operationalRole === 'employer-reviewer',
  )
  const schema = subtopicSchema.superRefine((value, context) => {
    if (!categories.some((c) => c.id === value.categoryId)) {
      context.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: 'دسته انتخاب‌شده متعلق به این رویداد نیست.',
      })
    }
    if (!eligibleEmployers.some((p) => String(p.id) === value.employerId)) {
      context.addIssue({
        code: 'custom',
        path: ['employerId'],
        message: 'یک شخص فعال با نقش کارفرما انتخاب کنید.',
      })
    }
  })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubtopicValues>({
    resolver: resolver(schema),
    defaultValues: { title: '', categoryId: categories[0]?.id ?? '', employerId: '' },
  })

  async function save(values: SubtopicValues) {
    setFailure(null)
    try {
      const result = await adminRequest(
        `/api/dashboard/admin/events/${encodeURIComponent(eventId)}/subtopics`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      )
      if (!result.subtopic?.id) throw new Error('invalid_subtopic_response')
      onSaved()
    } catch (error) {
      setFailure(error)
      if (error instanceof AdminError) {
        if (error.data?.error === 'invalid_category_event') {
          setError(
            'categoryId',
            { message: 'دسته انتخاب‌شده متعلق به این رویداد نیست.' },
            { shouldFocus: true },
          )
        } else if (error.data?.error === 'ineligible_employer') {
          setError(
            'employerId',
            { message: 'کارفرمای انتخاب‌شده نامعتبر یا دارای شرکت است.' },
            { shouldFocus: true },
          )
        } else if (error.data?.error === 'invalid_subtopic') {
          setError(
            'title',
            { message: 'عنوان زیرعنوان نامعتبر است.' },
            { shouldFocus: true },
          )
        }
      }
    }
  }

  return (
    <form
      aria-label="زیرعنوان جدید"
      noValidate
      onSubmit={handleSubmit(save)}
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
    >
      <Typography variant="16/semibold">افزودن زیرعنوان جدید</Typography>
      <Field name="categoryId" label="دسته فناوری" error={errors.categoryId?.message}>
        <select
          id="categoryId"
          className={controlClass}
          aria-invalid={!!errors.categoryId}
          aria-describedby={errors.categoryId ? 'categoryId-error' : undefined}
          {...register('categoryId')}
        >
          <option value="">انتخاب دسته</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </Field>

      <Field name="title" label="عنوان زیرعنوان" error={errors.title?.message}>
        <input
          id="title"
          className={controlClass}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
          {...register('title')}
        />
      </Field>

      <Field name="employerId" label="کارفرمای مسئول" error={errors.employerId?.message}>
        <select
          id="employerId"
          className={controlClass}
          aria-invalid={!!errors.employerId}
          aria-describedby={errors.employerId ? 'employerId-error' : undefined}
          {...register('employerId')}
        >
          <option value="">انتخاب کارفرما</option>
          {eligibleEmployers.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name || 'بدون نام'} — {p.phone || p.id}
            </option>
          ))}
        </select>
        {eligibleEmployers.length === 0 && (
          <Typography variant="14/regular" color="warning">
            شخص کارفرمای واجد شرایط وجود ندارد؛ ابتدا در بخش پرسنل حساب فعال با نقش کارفرما بسازید.
          </Typography>
        )}
      </Field>

      {failure !== null && <RequestError error={failure} returnTo="/dashboard/events" />}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting || eligibleEmployers.length === 0}>
          <Typography variant="14/regular">
            {isSubmitting ? 'در حال ذخیره...' : 'ذخیره زیرعنوان'}
          </Typography>
        </Button>
        <Button type="button" variant="outline-gray" disabled={isSubmitting} onClick={onCancel}>
          <Typography variant="14/regular">انصراف</Typography>
        </Button>
      </div>
    </form>
  )
}

function RfpManager({
  eventId,
  subtopic,
  onUpdated,
  onClose,
}: {
  eventId: string
  subtopic: EventSubtopic
  onUpdated: (newVersionId: string) => void
  onClose: () => void
}) {
  const [version, setVersion] = useState<RfpVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Upload form state (preserved across 409 stale conflict)
  const [reason, setReason] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const fetchRfp = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await adminRequest(
        `/api/dashboard/events/${encodeURIComponent(eventId)}/subtopics/${encodeURIComponent(subtopic.id)}/rfp`,
      )
      if (res.version) {
        setVersion(res.version)
      } else {
        setVersion(null)
      }
    } catch (err) {
      if (err instanceof AdminError && err.status === 404) {
        setVersion(null)
      } else {
        setLoadError(err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchRfp()
  }, [eventId, subtopic.id])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFailure(null)
    setSavedSuccess(false)
    if (!reason.trim()) {
      setFormError('توضیحات و دلیل نسخه جدید الزامی است.')
      return
    }
    if (selectedFiles.length === 0) {
      setFormError('حداقل یک فایل برای نسخه RFP انتخاب کنید.')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      for (const file of selectedFiles) {
        formData.append('files', file)
      }
      formData.append('reason', reason.trim())
      formData.append('expectedVersionId', version?.id ?? subtopic.currentRfpVersionId ?? '')

      const res = await adminRequest(
        `/api/dashboard/admin/events/${encodeURIComponent(eventId)}/subtopics/${encodeURIComponent(subtopic.id)}/rfp`,
        {
          method: 'POST',
          body: formData,
        },
      )

      if (res.version) {
        setVersion(res.version)
        setSavedSuccess(true)
        setStale(false)
        setReason('')
        setSelectedFiles([])
        onUpdated(res.version.id)
      }
    } catch (err) {
      if (err instanceof AdminError) {
        if (err.status === 409) {
          setStale(true)
          setFailure('نسخه RFP توسط شخص دیگری تغییر یافته است؛ پیش از ذخیره، آخرین نسخه را بررسی کنید.')
        } else if (err.data?.error === 'file_too_large' || err.status === 413) {
          setFailure('حجم فایل بیش از سقف مجاز (۱۰ مگابایت) است.')
        } else if (err.data?.error === 'invalid_file') {
          setFailure('فرمت یا محتوای فایل نامعتبر است (تنها PDF و Word مجاز است).')
        } else if (err.data?.error === 'invalid_rfp') {
          setFailure('دلیل یا شناسه نسخه نامعتبر است.')
        } else if (err.status === 403) {
          setFailure('اجازه مدیریت این بخش را ندارید.')
        } else {
          setFailure('بارگذاری فایل RFP انجام نشد؛ دوباره تلاش کنید.')
        }
      } else {
        setFailure('خطا در برقراری ارتباط با سرور.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReloadServerVersion() {
    setLoading(true)
    setFailure(null)
    setStale(false)
    try {
      const res = await adminRequest(
        `/api/dashboard/events/${encodeURIComponent(eventId)}/subtopics/${encodeURIComponent(subtopic.id)}/rfp`,
      )
      if (res.version) {
        setVersion(res.version)
      }
    } catch (err) {
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <Typography variant="16/semibold">مدیریت RFP: {subtopic.title}</Typography>
        <Button type="button" variant="outline-gray" onClick={onClose}>
          <Typography variant="14/regular">بستن پنل RFP</Typography>
        </Button>
      </div>

      <div
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"
      >
        <Typography variant="14/regular" className="leading-6">
          توجه: تغییرات و نسخه‌های جدید RFP طبق قوانین نگارش سرور اعمال می‌شوند و پرونده‌های ارسال‌شده قبلی شرکت‌ها را بازنویسی نمی‌کنند (نسخه پرونده‌های ثبت‌شده ثابت می‌ماند).
        </Typography>
      </div>

      {loading ? (
        <Typography variant="14/regular">در حال بارگذاری اطلاعات RFP...</Typography>
      ) : loadError !== null ? (
        <RequestError error={loadError} returnTo="/dashboard/events" retry={fetchRfp} />
      ) : (
        <div className="flex flex-col gap-3">
          <Typography variant="14/semibold">وضعیت نسخه فعال:</Typography>
          {version ? (
            <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-neutral-800">
              <Typography variant="14/regular">
                شناسه نسخه: {version.id}
              </Typography>
              <Typography variant="14/regular">
                توضیحات نسخه: {version.reason}
              </Typography>
              <Typography variant="14/regular" color="muted">
                تاریخ ایجاد: {new Date(version.createdAt).toLocaleString('fa-IR')}
              </Typography>
              <div className="mt-2 flex flex-col gap-2">
                <Typography variant="14/semibold">فایل‌های مستندات RFP:</Typography>
                {version.files.map((file) => (
                  <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-200 bg-white p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-[13px] font-medium text-neutral-800">{file.filename}</span>
                      <span className="font-sans text-[12px] text-neutral-500">({formatFileSize(file.sizeBytes)})</span>
                    </div>
                    <a
                      href={getRfpDownloadUrl(eventId, subtopic.id, version.id, file.id)}
                      download
                      className="font-sans text-[13px] text-brand-600 hover:underline"
                    >
                      دانلود {file.filename}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Typography variant="14/regular" color="muted">
              هنوز نسخه‌ای از فایل RFP برای این زیرعنوان ثبت نشده است.
            </Typography>
          )}
        </div>
      )}

      <form
        onSubmit={handleUpload}
        noValidate
        className="mt-3 flex flex-col gap-3 border-t border-neutral-100 pt-3"
      >
        <Typography variant="16/semibold">بارگذاری نسخه جدید RFP</Typography>

        {savedSuccess && (
          <Typography role="status" variant="14/regular" color="success">
            نسخه جدید RFP با موفقیت بارگذاری شد.
          </Typography>
        )}

        <div className="flex min-w-0 flex-col gap-2">
          <Typography asChild variant="16/semibold">
            <label htmlFor="rfp-reason">توضیحات و دلیل نسخه جدید</label>
          </Typography>
          <input
            id="rfp-reason"
            aria-label="توضیحات و دلیل نسخه جدید"
            type="text"
            className={controlClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Typography asChild variant="16/semibold">
            <label htmlFor="rfp-files">انتخاب فایل‌های RFP</label>
          </Typography>
          <input
            id="rfp-files"
            aria-label="انتخاب فایل‌های RFP"
            type="file"
            multiple
            accept=".pdf,.doc,.docx"
            className={controlClass}
            onChange={(e) => {
              const fileList = e.target.files ? Array.from(e.target.files) : []
              setSelectedFiles(fileList)
            }}
          />
          <Typography variant="12/regular" color="muted">
            فرمت‌های مجاز: PDF, DOC, DOCX — حداکثر ۱۰ مگابایت برای هر فایل
          </Typography>
        </div>

        {formError && (
          <Typography role="alert" variant="14/regular" color="error">
            {formError}
          </Typography>
        )}

        {failure && (
          <Typography role="alert" variant="14/regular" color="error">
            {failure}
          </Typography>
        )}

        {stale && (
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={handleReloadServerVersion} disabled={loading}>
              <Typography variant="14/regular">بررسی نسخه جدید سرور</Typography>
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSubmitting || loading}>
            <Typography variant="14/regular">
              {isSubmitting ? 'در حال بارگذاری...' : 'بارگذاری نسخه جدید RFP'}
            </Typography>
          </Button>
        </div>
      </form>
    </section>
  )
}

function EventSubtopicsManager({
  event,
  people,
  onBack,
}: {
  event: Event
  people: Person[]
  onBack: () => void
}) {
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [subtopics, setSubtopics] = useState<EventSubtopic[]>([])
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<unknown>(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [addingSubtopic, setAddingSubtopic] = useState(false)
  const [activeRfpSubtopic, setActiveRfpSubtopic] = useState<EventSubtopic | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setFailure(null)
    try {
      const [catsRes, subsRes] = await Promise.all([
        adminRequest(`/api/dashboard/admin/events/${encodeURIComponent(event.id)}/categories`),
        adminRequest(`/api/dashboard/admin/events/${encodeURIComponent(event.id)}/subtopics`),
      ])
      setCategories(catsRes.items ?? [])
      setSubtopics(subsRes.items ?? [])
    } catch (err) {
      setFailure(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [event.id])

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography variant="h3">
          عناوین، زیرعنوان‌ها و RFP رویداد: {event.title}
        </Typography>
        <Button type="button" variant="outline-gray" onClick={onBack}>
          <Typography variant="14/regular">بازگشت به فهرست رویدادها</Typography>
        </Button>
      </div>

      {successMessage && (
        <Typography role="status" variant="14/regular" color="success">
          {successMessage}
        </Typography>
      )}

      {failure !== null && (
        <RequestError error={failure} returnTo="/dashboard/events" retry={loadData} />
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => {
            setSuccessMessage(null)
            setAddingCategory(true)
            setAddingSubtopic(false)
          }}
        >
          <Typography variant="14/regular">دسته جدید</Typography>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSuccessMessage(null)
            setAddingSubtopic(true)
            setAddingCategory(false)
          }}
        >
          <Typography variant="14/regular">زیرعنوان جدید</Typography>
        </Button>
      </div>

      {addingCategory && (
        <CategoryForm
          eventId={event.id}
          onSaved={() => {
            setAddingCategory(false)
            setSuccessMessage('دسته با موفقیت ایجاد شد.')
            void loadData()
          }}
          onCancel={() => setAddingCategory(false)}
        />
      )}

      {addingSubtopic && (
        <SubtopicForm
          eventId={event.id}
          categories={categories}
          people={people}
          onSaved={() => {
            setAddingSubtopic(false)
            setSuccessMessage('زیرعنوان با موفقیت ایجاد شد.')
            void loadData()
          }}
          onCancel={() => setAddingSubtopic(false)}
        />
      )}

      {activeRfpSubtopic && (
        <RfpManager
          eventId={event.id}
          subtopic={activeRfpSubtopic}
          onUpdated={(newVersionId) => {
            setSubtopics((prev) =>
              prev.map((s) =>
                s.id === activeRfpSubtopic.id ? { ...s, currentRfpVersionId: newVersionId } : s,
              ),
            )
          }}
          onClose={() => setActiveRfpSubtopic(null)}
        />
      )}

      {loading ? (
        <Typography variant="16/regular">در حال بارگذاری عناوین و زیرعنوان‌ها...</Typography>
      ) : categories.length === 0 ? (
        <div className={`${cardClass} py-8 text-center`}>
          <Typography variant="14/regular" color="muted">
            هنوز دسته‌ای برای این رویداد تعریف نشده است.
          </Typography>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {categories.map((cat) => {
            const catSubtopics = subtopics.filter((s) => s.categoryId === cat.id)
            return (
              <article key={cat.id} className={`${cardClass} flex flex-col gap-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                  <Typography variant="16/semibold">{cat.title}</Typography>
                  <Typography variant="12/regular" color="muted">
                    {catSubtopics.length} زیرعنوان
                  </Typography>
                </div>

                {catSubtopics.length === 0 ? (
                  <Typography variant="14/regular" color="muted">
                    زیرعنوانی در این دسته موجود نیست.
                  </Typography>
                ) : (
                  <div className="flex flex-col divide-y divide-neutral-100">
                    {catSubtopics.map((sub) => {
                      const employer = people.find((p) => String(p.id) === sub.employerId)
                      return (
                        <div key={sub.id} className="flex flex-col gap-2 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Typography variant="14/semibold">{sub.title}</Typography>
                            <Button
                              type="button"
                              variant="outline"
                              size="default"
                              aria-label={`مدیریت فایل RFP ${sub.title}`}
                              onClick={() => {
                                setSuccessMessage(null)
                                setActiveRfpSubtopic(sub)
                              }}
                            >
                              <Typography variant="12/regular">مدیریت فایل RFP</Typography>
                            </Button>
                          </div>
                          <Typography variant="14/regular" color="muted">
                            کارفرمای مسئول:{' '}
                            {employer ? `${employer.name || 'بدون نام'} (${employer.phone || employer.id})` : sub.employerId}
                          </Typography>
                          <Typography variant="12/regular" color="muted">
                            {sub.currentRfpVersionId
                              ? `نسخه فعلی RFP: ${sub.currentRfpVersionId}`
                              : 'فایل RFP هنوز بارگذاری نشده است.'}
                          </Typography>
                        </div>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function OwnerEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState<Event | 'new' | null>(null)
  const [managingSubtopics, setManagingSubtopics] = useState<Event | null>(null)
  const [saved, setSaved] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    let current = true
    const timer = setInterval(() => setNow(Date.now()), 30000)
    Promise.all([adminRequest('/api/dashboard/admin/events'), loadPeople()])
      .then(([result, people]) => {
        if (!Array.isArray(result.items)) throw new Error('invalid_event_list')
        if (current) {
          setEvents(result.items)
          setPeople(people)
          setNow(Date.now())
        }
      })
      .catch((error) => {
        if (current) setFailure(error)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
      clearInterval(timer)
    }
  }, [attempt])
  function refresh() {
    setLoading(true)
    setFailure(null)
    setAttempt((value) => value + 1)
  }
  return (
    <main dir="rtl" className="flex min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10">
      <Typography variant="h3">مدیریت رویدادها</Typography>
      {saved && (
        <Typography role="status" variant="14/regular" color="success">
          رویداد ذخیره شد.
        </Typography>
      )}
      {managingSubtopics ? (
        <EventSubtopicsManager
          event={managingSubtopics}
          people={people}
          onBack={() => {
            setManagingSubtopics(null)
            refresh()
          }}
        />
      ) : editing ? (
        <EventForm
          key={editing === 'new' ? 'new' : editing.id}
          event={editing === 'new' ? undefined : editing}
          people={people}
          onCancel={() => {
            setEditing(null)
            refresh()
          }}
          onSaved={() => {
            setEditing(null)
            setSaved(true)
            refresh()
          }}
        />
      ) : loading ? (
        <Typography role="status" variant="16/regular">
          در حال دریافت اطلاعات...
        </Typography>
      ) : failure !== null ? (
        <RequestError error={failure} returnTo="/dashboard/events" retry={refresh} />
      ) : (
        <>
          <Button
            size="48"
            className="self-start"
            onClick={() => {
              setSaved(false)
              setEditing('new')
            }}
          >
            <Typography variant="16/semibold" color="white">
              رویداد جدید
            </Typography>
          </Button>
          <section className={`${cardClass} flex min-w-0 flex-col gap-3`}>
            <Typography variant="14/regular">
              عنوان، شرح، تاریخ شروع و پایان برگزاری و وضعیت محتوای عمومی در CMS مدیریت می‌شود.
              شناسه‌های این دو بخش یکسان نیستند و اتصال خودکار ندارند. وضعیت آینده/جاری/گذشته در CMS،
              وضعیت انتشار نیست؛ وضعیت منتشرنشده در قرارداد فعلی وجود ندارد.
            </Typography>
            <Button asChild variant="outline" className="self-start">
              <Link href="/admin/collections/events">
                <Typography variant="14/regular">مدیریت محتوای عمومی در CMS</Typography>
              </Link>
            </Button>
          </section>
          {events.length === 0 && (
            <Typography variant="16/regular" className={cardClass}>
              هنوز رویدادی ثبت نشده است.
            </Typography>
          )}
          {events.map((event) => (
            <article key={event.id} className={`${cardClass} flex min-w-0 flex-col gap-3`}>
              <Typography variant="20/bold" className="break-words">
                {event.title}
              </Typography>
              <Typography variant="14/regular" className="break-all">
                شناسه: {event.id} — نسخه: {event.revision}
              </Typography>
              <Typography variant="14/regular">
                {now === null
                  ? 'در حال دریافت وضعیت ثبت‌نام'
                  : now >= Date.parse(event.registrationCloseAt)
                    ? 'ثبت‌نام بسته'
                    : now < Date.parse(event.registrationOpenAt)
                      ? 'ثبت‌نام آغاز نشده'
                      : 'ثبت‌نام باز'}{' '}
                — وضعیت انتشار عمومی در این API ارائه نشده است.
              </Typography>
              <Typography variant="14/regular">
                سردبیر:{' '}
                {people.find((person) => String(person.id) === event.responsibleChiefId)?.name ||
                  event.responsibleChiefId}
                ؛ سرمایه‌گذاری:{' '}
                {people.find((person) => String(person.id) === event.responsibleInvestmentId)
                  ?.name || event.responsibleInvestmentId}
              </Typography>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="self-start"
                  aria-label={`ویرایش ${event.title}`}
                  onClick={() => {
                    setSaved(false)
                    setEditing(event)
                  }}
                >
                  <Typography variant="14/regular">ویرایش</Typography>
                </Button>
                <Button
                  variant="outline"
                  className="self-start"
                  aria-label={`مدیریت دسته‌ها، زیرعنوان‌ها و RFP ${event.title}`}
                  onClick={() => {
                    setSaved(false)
                    setManagingSubtopics(event)
                  }}
                >
                  <Typography variant="14/regular">دسته‌ها، زیرعنوان‌ها و RFP</Typography>
                </Button>
              </div>
            </article>
          ))}
        </>
      )}
    </main>
  )
}
