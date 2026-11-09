'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { RequiredMark, hasRequiredControl } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'
import { AdminError, RequestError, adminRequest, loadPeople, resolver, type Person } from './owner-admin'

/** The public page of an event or exhibition, as the backend returns it (S5). */
export type PublicPage = {
  id: string
  title: string
  description: string
  location: string
  startDate: string
  endDate: string
  status: PublicStatus
}
export type PublicStatus = 'upcoming' | 'ongoing' | 'past'
export const PUBLIC_STATUS_LABELS: Record<PublicStatus, string> = {
  upcoming: 'پیش‌رو',
  ongoing: 'در حال برگزاری',
  past: 'تمام شده',
}

export type OwnerEvent = {
  id: string
  title: string
  description: string
  registrationOpenAt: string
  registrationCloseAt: string
  responsibleChiefId: string
  responsibleInvestmentId: string
  publicEventId: string | null
  public?: PublicPage | null
  revision: number
}

/* Times are entered in UTC, to the millisecond, so an unchanged field round-trips exactly. */
export const toUtcInput = (iso?: string) => (iso ? iso.replace(/Z$/, '') : '')
export const fromUtcInput = (value: string) => new Date(`${value}Z`).toISOString()
const isUtcInput = (value: string) => Number.isFinite(Date.parse(`${value}Z`))

export const requiredText = z.string().trim().min(1, 'این فیلد الزامی است.')

/** The public page fields both forms share, with the end after the start. */
export const publicFieldsSchema = z.object({
  title: requiredText.max(200, 'عنوان حداکثر ۲۰۰ نویسه است.'),
  description: z.string().trim().max(5000, 'شرح حداکثر ۵۰۰۰ نویسه است.'),
  location: requiredText.max(300, 'محل برگزاری حداکثر ۳۰۰ نویسه است.'),
  startDate: requiredText.refine(isUtcInput, 'تاریخ معتبر وارد کنید.'),
  endDate: requiredText.refine(isUtcInput, 'تاریخ معتبر وارد کنید.'),
  status: z.enum(['upcoming', 'ongoing', 'past'], { message: 'وضعیت را انتخاب کنید.' }),
})

export function checkPublicDates(
  value: { startDate: string; endDate: string },
  context: z.RefinementCtx,
): void {
  if (isUtcInput(value.startDate) && isUtcInput(value.endDate) &&
      Date.parse(`${value.endDate}Z`) <= Date.parse(`${value.startDate}Z`)) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'پایان برگزاری باید پس از شروع باشد.' })
  }
}

export function publicDefaults(page?: Partial<PublicPage> | null) {
  return {
    title: page?.title ?? '',
    description: page?.description ?? '',
    location: page?.location ?? '',
    startDate: toUtcInput(page?.startDate),
    endDate: toUtcInput(page?.endDate),
    status: (page?.status ?? 'upcoming') as PublicStatus,
  }
}

const SERVER_MESSAGES: Record<string, string> = {
  invalid_public_dates: 'پایان برگزاری باید پس از شروع باشد.',
  invalid_registration_window: 'پایان ثبت‌نام باید پس از شروع باشد.',
  ineligible_responsible_person: 'این شخص فعال نیست یا نقش مناسب ندارد.',
  invalid_company_booth_limit: 'سقف غرفه باید عدد صحیح مثبت باشد.',
  invalid_guide_map_reference: 'نشانی نقشه راهنما معتبر نیست.',
}

/** Puts each field the server refused under its control; returns whether any was placed. */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  fieldNames: readonly string[],
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof AdminError) || error.status !== 400) return false
  const code = typeof error.data.error === 'string' ? error.data.error : ''
  const fields = Array.isArray(error.data.fields)
    ? (error.data.fields as unknown[])
    : typeof error.data.field === 'string'
      ? [error.data.field]
      : code === 'invalid_public_dates'
        ? ['endDate']
        : code === 'invalid_registration_window'
          ? ['registrationCloseAt']
          : code === 'invalid_company_booth_limit'
            ? ['companyBoothLimit']
            : code === 'invalid_guide_map_reference'
              ? ['guideMapReference']
              : []
  let placed = false
  for (const field of fields) {
    if (typeof field !== 'string' || !fieldNames.includes(field)) continue
    setError(field as Path<T>, { message: SERVER_MESSAGES[code] ?? 'سرور این مقدار را نپذیرفت؛ بررسی کنید.' }, { shouldFocus: !placed })
    placed = true
  }
  return placed
}

/** A failed save, with the cases the generic admin message does not explain. */
export function SaveFailure({ error, returnTo, children }: { error: unknown; returnTo: string; children?: ReactNode }) {
  const code = error instanceof AdminError ? error.data.error : undefined
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-error-50 bg-error-50 p-3">
      {code === 'public_record_failed' ? (
        <Typography role="alert" variant="14/regular" color="error">
          صفحه عمومی ذخیره نشد و هیچ تغییری ثبت نشد. چند لحظه بعد دوباره تلاش کنید.
        </Typography>
      ) : code === 'public_event_linked' ? (
        <Typography role="alert" variant="14/regular" color="error">
          این صفحه عمومی پیش‌تر به رویداد دیگری متصل شده است.
        </Typography>
      ) : (
        <RequestError error={error} returnTo={returnTo} />
      )}
      {children}
    </div>
  )
}

/* Figma form field (31070:16605): 16/SemiBold grey-700 label, 12/Light error under the control. */
export function FormRow({
  id,
  label,
  error,
  required,
  children,
  className,
}: {
  id: string
  label: string
  error?: string
  /** Defaults to whether the control inside is marked aria-required. */
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Typography as="label" htmlFor={id} variant="16/semibold" color="neutral-700">
        {label}
        {(required ?? hasRequiredControl(children)) ? <RequiredMark className="ms-0.5" /> : null}
      </Typography>
      <div className="flex flex-col gap-1">
        {children}
        {error && (
          <Typography id={`${id}-error`} role="alert" variant="12/light" color="error">
            {error}
          </Typography>
        )}
      </div>
    </div>
  )
}

/* Figma card (31070:16605): white, grey-200 border, 16px radius/padding, 20×32 grid gaps. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-x-5 gap-y-8 rounded-2xl border border-neutral-200 bg-background p-4 md:grid-cols-2">
      <Typography as="h2" variant="20/bold" color="neutral-600" className="md:col-span-2">
        {title}
      </Typography>
      {children}
    </section>
  )
}

/* Breadcrumb — Figma add-new page (31070:16796): grey-500 parent, "/", 24/Bold page; actions at the end. */
export function AdminBreadcrumb({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
      {/* pe-12: clear of the mobile menu button at the top-left corner. */}
      <nav aria-label="مسیر صفحه" className="flex min-w-0 basis-full items-center gap-2 pe-12 md:basis-auto md:flex-1 lg:pe-0">
        {/* Phones keep the room for the page title; cancel and back lead to the list. */}
        <Link href="/dashboard/events" className="hidden rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500 sm:inline">
          <Typography as="span" variant="16/regular" color="neutral-500" className="whitespace-nowrap">
            رویدادها و نمایشگاه‌ها
          </Typography>
        </Link>
        <Typography as="span" variant="16/regular" color="neutral-500" aria-hidden="true" className="hidden sm:inline">
          /
        </Typography>
        <Typography as="h1" variant="24/bold" color="neutral-700" className="truncate">
          {title}
        </Typography>
      </nav>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function FormSkeleton({ sections }: { sections: number[] }) {
  return (
    <div role="status" aria-label="در حال دریافت اطلاعات" className="flex flex-col gap-5">
      {sections.map((rows, index) => (
        <div key={index} className="grid gap-4 rounded-2xl border border-neutral-200 bg-background p-4 md:grid-cols-2">
          {Array.from({ length: rows }, (_, row) => (
            <Skeleton key={row} className="h-10 w-full rounded-lg bg-neutral-100 motion-reduce:animate-none" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** The public page fields of both forms (title, place, dates, status, description). */
export function PublicFields<T extends ReturnType<typeof publicDefaults>>({
  register,
  errors,
  titleLabel,
}: {
  register: ReturnType<typeof useForm<T>>['register']
  errors: Partial<Record<keyof ReturnType<typeof publicDefaults>, { message?: string }>>
  titleLabel: string
}) {
  const reg = (name: keyof ReturnType<typeof publicDefaults>) => register(name as Path<T>)
  const describedBy = (name: string) => (errors[name as keyof typeof errors] ? `${name}-error` : undefined)
  return (
    <>
      <FormRow id="title" label={titleLabel} error={errors.title?.message}>
        <Input id="title" aria-required placeholder="مثلا: همایش سالانه فناوری انرژی" variant={errors.title ? 'error' : 'default'} aria-describedby={describedBy('title')} {...reg('title')} />
      </FormRow>
      <FormRow id="location" label="محل برگزاری" error={errors.location?.message}>
        <Input id="location" aria-required placeholder="مثلا: بوشهر، سالن همایش‌ها" variant={errors.location ? 'error' : 'default'} aria-describedby={describedBy('location')} {...reg('location')} />
      </FormRow>
      <FormRow id="startDate" label="شروع برگزاری (UTC)" error={errors.startDate?.message}>
        <Input id="startDate" type="datetime-local" step="0.001" dir="ltr" aria-required variant={errors.startDate ? 'error' : 'default'} aria-describedby={describedBy('startDate')} {...reg('startDate')} />
      </FormRow>
      <FormRow id="endDate" label="پایان برگزاری (UTC)" error={errors.endDate?.message}>
        <Input id="endDate" type="datetime-local" step="0.001" dir="ltr" aria-required variant={errors.endDate ? 'error' : 'default'} aria-describedby={describedBy('endDate')} {...reg('endDate')} />
      </FormRow>
      <FormRow id="status" label="وضعیت در سایت" error={errors.status?.message}>
        <NativeSelect id="status" aria-describedby={describedBy('status')} {...reg('status')}>
          {(Object.keys(PUBLIC_STATUS_LABELS) as PublicStatus[]).map((status) => (
            <option key={status} value={status}>
              {PUBLIC_STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
      </FormRow>
      <div className="hidden md:block" />
      <FormRow id="description" label="شرح عمومی" error={errors.description?.message} className="md:col-span-2">
        <Textarea id="description" placeholder="شرح کوتاه رویداد برای صفحه عمومی…" className="h-28" aria-describedby={describedBy('description')} {...reg('description')} />
      </FormRow>
    </>
  )
}

const eventSchema = publicFieldsSchema
  .extend({
    registrationOpenAt: requiredText.refine(isUtcInput, 'تاریخ معتبر وارد کنید.'),
    registrationCloseAt: requiredText.refine(isUtcInput, 'تاریخ معتبر وارد کنید.'),
    responsibleChiefId: requiredText,
    responsibleInvestmentId: requiredText,
    reason: z.string().trim(),
  })
  .superRefine((value, context) => {
    checkPublicDates(value, context)
    if (isUtcInput(value.registrationOpenAt) && isUtcInput(value.registrationCloseAt) &&
        Date.parse(`${value.registrationCloseAt}Z`) <= Date.parse(`${value.registrationOpenAt}Z`)) {
      context.addIssue({ code: 'custom', path: ['registrationCloseAt'], message: 'پایان ثبت‌نام باید پس از شروع باشد.' })
    }
  })
type EventValues = z.infer<typeof eventSchema>
const EVENT_FIELDS = [
  'title', 'description', 'location', 'startDate', 'endDate', 'status',
  'registrationOpenAt', 'registrationCloseAt', 'responsibleChiefId', 'responsibleInvestmentId', 'reason',
] as const

function eventDefaults(event?: OwnerEvent, page?: PublicPage | null): EventValues {
  return {
    ...publicDefaults(page),
    // The event's own title and description are the page's; they only differ on a page being taken over.
    title: event?.title ?? page?.title ?? '',
    description: event?.description ?? page?.description ?? '',
    registrationOpenAt: toUtcInput(event?.registrationOpenAt),
    registrationCloseAt: toUtcInput(event?.registrationCloseAt),
    responsibleChiefId: event?.responsibleChiefId ?? '',
    responsibleInvestmentId: event?.responsibleInvestmentId ?? '',
    reason: '',
  }
}

type Loaded = { people: Person[]; event?: OwnerEvent; adopted?: PublicPage }

/**
 * FE41 / T60: the owner creates or edits an event and its public page in one
 * form. `adoptPublicEventId` takes over a public event made in the CMS.
 */
export function OwnerEventForm({
  mode,
  id,
  adoptPublicEventId,
}: {
  mode: 'create' | 'edit'
  id?: string
  adoptPublicEventId?: string
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    Promise.all([
      loadPeople(),
      mode === 'edit' && id ? adminRequest(`/api/dashboard/admin/events/${encodeURIComponent(id)}`) : null,
      adoptPublicEventId ? adminRequest('/api/dashboard/admin/events') : null,
    ])
      .then(([people, single, list]) => {
        if (single && !single.event?.id) throw new Error('invalid_event_response')
        const adopted = list
          ? (list.unlinkedPublicEvents as PublicPage[] | undefined)?.find((page) => page.id === adoptPublicEventId)
          : undefined
        if (adoptPublicEventId && !adopted) throw new AdminError(404, { error: 'public_event_not_found' })
        if (current) setLoaded({ people, event: single?.event, adopted })
      })
      .catch((error) => {
        if (current) setLoadError(error)
      })
    return () => {
      current = false
    }
  }, [mode, id, adoptPublicEventId, attempt])

  const title =
    mode === 'create'
      ? adoptPublicEventId ? 'تکمیل رویداد منتشرشده' : 'رویداد جدید'
      : loaded?.event ? `ویرایش ${loaded.event.title}` : 'ویرایش رویداد'
  const returnTo = mode === 'create' ? '/dashboard/events/new?type=event' : `/dashboard/events/${id ?? ''}/edit`

  return (
    <main dir="rtl" className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10">
      {loadError !== null ? (
        <>
          <AdminBreadcrumb title={title} />
          <RequestError
            error={loadError}
            returnTo={returnTo}
            retry={() => {
              setLoadError(null)
              setAttempt((value) => value + 1)
            }}
          />
        </>
      ) : loaded === null ? (
        <>
          <AdminBreadcrumb title={title} />
          <FormSkeleton sections={[6, 4]} />
        </>
      ) : (
        <EventEditor
          key={loaded.event ? `${loaded.event.id}:${loaded.event.revision}` : 'new'}
          title={title}
          people={loaded.people}
          event={loaded.event}
          adopted={loaded.adopted}
          returnTo={returnTo}
          onReloaded={(event) => setLoaded((value) => (value ? { ...value, event } : value))}
        />
      )}
    </main>
  )
}

function EventEditor({
  title,
  people,
  event,
  adopted,
  returnTo,
  onReloaded,
}: {
  title: string
  people: Person[]
  event?: OwnerEvent
  adopted?: PublicPage
  returnTo: string
  onReloaded: (event: OwnerEvent) => void
}) {
  const router = useRouter()
  const formId = useId()
  const busy = useRef(false)
  const [failure, setFailure] = useState<unknown>(null)
  const [stale, setStale] = useState(false)
  const [reloading, setReloading] = useState(false)
  const legacy = Boolean(event && !event.public)
  const schema = eventSchema.superRefine((value, context) => {
    if (event && !value.reason) context.addIssue({ code: 'custom', path: ['reason'], message: 'دلیل تغییر را وارد کنید.' })
    for (const field of ['responsibleChiefId', 'responsibleInvestmentId'] as const) {
      const role = field === 'responsibleChiefId' ? 'chief-reviewer' : 'investment-reviewer'
      if (value[field] && !people.some((person) => String(person.id) === value[field] && person.isActive && person.operationalRole === role)) {
        context.addIssue({ code: 'custom', path: [field], message: 'یک شخص فعال با نقش مناسب انتخاب کنید.' })
      }
    }
  })
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventValues>({ resolver: resolver(schema), defaultValues: eventDefaults(event, event?.public ?? adopted) })

  async function save(values: EventValues) {
    setFailure(null)
    const { reason, ...input } = values
    try {
      const result = await adminRequest(
        event ? `/api/dashboard/admin/events/${encodeURIComponent(event.id)}` : '/api/dashboard/admin/events',
        {
          method: event ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...input,
            startDate: fromUtcInput(input.startDate),
            endDate: fromUtcInput(input.endDate),
            registrationOpenAt: fromUtcInput(input.registrationOpenAt),
            registrationCloseAt: fromUtcInput(input.registrationCloseAt),
            ...(adopted ? { publicEventId: adopted.id } : {}),
            ...(event ? { revision: event.revision, reason } : {}),
          }),
        },
      )
      if (!result.event?.id) throw new Error('invalid_event_response')
      toast.success(event ? 'تغییرات رویداد ذخیره شد.' : 'رویداد ساخته شد.')
      router.push(`/dashboard/events?saved=${event ? 'event-updated' : 'event-created'}`)
    } catch (error) {
      toast.error('ذخیره رویداد انجام نشد.')
      setFailure(error)
      if (error instanceof AdminError && error.status === 409 && error.data.error === 'stale_event') setStale(true)
      applyServerErrors(error, EVENT_FIELDS, setError)
    }
  }

  async function reload() {
    if (!event || reloading) return
    setReloading(true)
    try {
      const result = await adminRequest(`/api/dashboard/admin/events/${encodeURIComponent(event.id)}`)
      if (!result.event?.id) throw new Error('invalid_event_response')
      onReloaded(result.event)
    } catch (error) {
      setFailure(error)
    } finally {
      setReloading(false)
    }
  }

  const select = (name: 'responsibleChiefId' | 'responsibleInvestmentId', label: string) => {
    const role = name === 'responsibleChiefId' ? 'chief-reviewer' : 'investment-reviewer'
    const eligible = people.filter((person) => person.isActive && person.operationalRole === role)
    return (
      <FormRow id={name} label={label} error={errors[name]?.message}>
        <NativeSelect id={name} aria-required aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} {...register(name)}>
          <option value="">انتخاب شخص</option>
          {eligible.map((person) => (
            <option key={person.id} value={String(person.id)}>
              {person.name || 'بدون نام'} — {person.phone || person.id}
            </option>
          ))}
        </NativeSelect>
        {eligible.length === 0 && (
          <Typography variant="12/regular" color="warning">
            شخص واجد شرایط وجود ندارد؛ ابتدا از بخش کارکنان حساب فعال بسازید.
          </Typography>
        )}
      </FormRow>
    )
  }

  const disabled = isSubmitting || stale || reloading
  return (
    <>
      <AdminBreadcrumb
        title={title}
        actions={
          <>
            <Button asChild variant="outline-gray" size="48">
              <Link href="/dashboard/events">
                <Typography as="span" variant="20/regular" className="text-inherit">
                  انصراف
                </Typography>
              </Link>
            </Button>
            <Button type="submit" form={formId} size="48" disabled={disabled}>
              <Typography as="span" variant="20/regular" className="text-inherit">
                {isSubmitting ? 'در حال ثبت...' : event ? 'ذخیره رویداد' : 'ثبت رویداد'}
              </Typography>
            </Button>
          </>
        }
      />
      <form
        id={formId}
        aria-label="اطلاعات رویداد"
        noValidate
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault()
          if (busy.current || stale || reloading) return
          busy.current = true
          void handleSubmit(save)(submitEvent).finally(() => {
            busy.current = false
          })
        }}
        className="flex flex-col gap-5"
      >
        {failure !== null && (
          <SaveFailure error={failure} returnTo={returnTo}>
            {stale && (
              <div className="flex flex-wrap items-center gap-3">
                <Typography variant="14/regular" color="neutral-700">
                  رویداد در این فاصله تغییر کرده است (نسخه فعلی سرور: {String((failure as AdminError).data.revision ?? '—')}). بررسی نسخه جدید، فرم را با اطلاعات سرور جایگزین می‌کند.
                </Typography>
                <Button size="40" type="button" variant="outline-gray" disabled={reloading} onClick={reload}>
                  <Typography as="span" variant="14/regular" className="text-inherit">
                    بررسی نسخه جدید
                  </Typography>
                </Button>
              </div>
            )}
          </SaveFailure>
        )}
        {legacy && (
          <Typography role="status" variant="14/regular" color="neutral-700" className="rounded-xl bg-brand-50 p-3">
            این رویداد هنوز صفحه عمومی ندارد. با ذخیره این فرم، صفحه عمومی آن هم ساخته می‌شود.
          </Typography>
        )}
        {adopted && (
          <Typography role="status" variant="14/regular" color="neutral-700" className="rounded-xl bg-brand-50 p-3">
            این رویداد پیش‌تر در سایت منتشر شده است. با ثبت این فرم، همان صفحه به‌روز و به رویداد متصل می‌شود.
          </Typography>
        )}
        <fieldset disabled={isSubmitting || reloading} className="flex min-w-0 flex-col gap-5">
          <FormSection title="اطلاعات عمومی">
            <PublicFields<EventValues> register={register} errors={errors} titleLabel="عنوان رویداد" />
          </FormSection>
          <FormSection title="ثبت‌نام و مسئولان">
            <FormRow id="registrationOpenAt" label="شروع ثبت‌نام (UTC)" error={errors.registrationOpenAt?.message}>
              <Input id="registrationOpenAt" type="datetime-local" step="0.001" dir="ltr" aria-required variant={errors.registrationOpenAt ? 'error' : 'default'} {...register('registrationOpenAt')} />
            </FormRow>
            <FormRow id="registrationCloseAt" label="پایان ثبت‌نام (UTC)" error={errors.registrationCloseAt?.message}>
              <Input id="registrationCloseAt" type="datetime-local" step="0.001" dir="ltr" aria-required variant={errors.registrationCloseAt ? 'error' : 'default'} {...register('registrationCloseAt')} />
            </FormRow>
            {select('responsibleChiefId', 'سردبیر مسئول')}
            {select('responsibleInvestmentId', 'مسئول سرمایه‌گذاری')}
          </FormSection>
          {event && (
            <FormSection title="ثبت تغییر">
              <FormRow id="reason" label="دلیل تغییر" error={errors.reason?.message} className="md:col-span-2">
                <Input id="reason" aria-required placeholder="دلیل این تغییر را بنویسید" variant={errors.reason ? 'error' : 'default'} {...register('reason')} />
              </FormRow>
            </FormSection>
          )}
        </fieldset>
      </form>
    </>
  )
}
