'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
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

export function OwnerEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState<Event | 'new' | null>(null)
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
      {editing ? (
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
            </article>
          ))}
        </>
      )}
    </main>
  )
}
