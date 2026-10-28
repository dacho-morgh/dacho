'use client'

import {
  OPERATIONAL_ROLES,
  OPERATIONAL_ROLE_LABELS,
  type OperationalRole,
} from '@cms-core/access/roles'
import { useRef, useState, type ReactNode } from 'react'
import { useForm, type FieldErrors, type FieldValues, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export type Person = {
  id: string | number
  name?: string | null
  phone?: string
  email?: string | null
  operationalRole?: OperationalRole
  isActive: boolean
  updatedAt?: string
}
export const controlClass =
  'h-10 w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 text-neutral-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
export const cardClass = 'rounded-2xl border border-neutral-200 bg-white p-4'

export function Field({
  name,
  label,
  error,
  children,
}: {
  name: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Typography asChild variant="16/semibold">
        <label htmlFor={name}>{label}</label>
      </Typography>
      {children}
      {error && (
        <Typography id={`${name}-error`} role="alert" variant="14/regular" color="error">
          {error}
        </Typography>
      )}
    </div>
  )
}

export function resolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values)
    if (result.success) return { values: result.data, errors: {} }
    return {
      values: {},
      errors: Object.fromEntries(
        result.error.issues.map((issue) => [
          issue.path[0],
          { type: 'validate', message: issue.message },
        ]),
      ) as FieldErrors<T>,
    }
  }
}

export class AdminError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown>,
  ) {
    super('admin_request_failed')
  }
}
export async function adminRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init })
  const data = await response.json()
  if (!response.ok) throw new AdminError(response.status, data)
  return data
}
export function adminErrorMessage(error: unknown): string {
  if (error instanceof AdminError) {
    if (error.status === 401) return 'نشست شما پایان یافته است. دوباره وارد شوید.'
    if (error.status === 403) return 'اجازه مدیریت این بخش را ندارید.'
    if (error.status === 409) return 'اطلاعات تغییر کرده است. پیش از ذخیره، نسخه جدید را بررسی کنید.'
    if (error.status === 404) return 'این مورد دیگر در دسترس نیست.'
  }
  return 'ذخیره یا دریافت اطلاعات انجام نشد. دوباره تلاش کنید.'
}
export function RequestError({
  error,
  retry,
  returnTo,
}: {
  error: unknown
  retry?: () => void
  returnTo: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Typography role="alert" variant="14/regular" color="error">
        {adminErrorMessage(error)}
      </Typography>
      {error instanceof AdminError && error.status === 401 ? (
        <Button asChild variant="outline">
          <a href={`/login?returnUrl=${encodeURIComponent(returnTo)}`}>
            <Typography variant="14/regular">ورود دوباره</Typography>
          </a>
        </Button>
      ) : (
        retry && (
          <Button type="button" variant="outline" onClick={retry}>
            <Typography variant="14/regular">تلاش دوباره</Typography>
          </Button>
        )
      )}
    </div>
  )
}

const personSchema = z.object({
  name: z.string().trim().min(1, 'نام را وارد کنید.'),
  phone: z
    .string()
    .trim()
    .min(1, 'شماره همراه را وارد کنید.')
    .transform((value) =>
      value.replace(/[۰-۹٠-٩]/g, (digit) =>
        String(
          '۰۱۲۳۴۵۶۷۸۹'.includes(digit) ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit) : '٠١٢٣٤٥٦٧٨٩'.indexOf(digit),
        ),
      ),
    ),
  email: z.union([z.literal(''), z.string().trim().email('ایمیل معتبر وارد کنید.')]),
  password: z.string(),
  operationalRole: z.enum(OPERATIONAL_ROLES),
  isActive: z.boolean(),
})
type PersonValues = z.infer<typeof personSchema>

export function PersonnelForm({
  person: initialPerson,
  onSaved,
  onCancel,
}: {
  person?: Person
  onSaved: (person: Person) => void
  onCancel: () => void
}) {
  const [person, setPerson] = useState(initialPerson)
  const schema = personSchema.refine((value) => person || value.password.length >= 3, {
    path: ['password'],
    message: 'رمز عبور حداقل ۳ نویسه است.',
  })
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PersonValues>({
    resolver: resolver(schema),
    defaultValues: {
      name: person?.name ?? '',
      phone: person?.phone ?? '',
      email: person?.email ?? '',
      password: '',
      operationalRole: person?.operationalRole ?? 'reviewer',
      isActive: person?.isActive ?? true,
    },
  })
  const busy = useRef(false)
  const [failure, setFailure] = useState<unknown>(null)
  async function save(values: PersonValues) {
    setFailure(null)
    try {
      const body = {
        ...values,
        ...(person ? { expectedUpdatedAt: person.updatedAt } : { username: values.phone }),
        email: values.email || (person ? null : undefined),
        password: values.password || undefined,
      }
      if (person && !values.password) delete body.password
      const result = await adminRequest(
        person ? `/api/users/personnel/${encodeURIComponent(person.id)}` : '/api/users',
        {
          method: person ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (
        !result.doc?.id ||
        result.doc.operationalRole !== values.operationalRole ||
        result.doc.isActive !== values.isActive
      )
        throw new AdminError(403, {})
      onSaved(result.doc)
    } catch (error) {
      setFailure(error)
      if (error instanceof AdminError && Array.isArray(error.data.errors)) {
        for (const item of error.data.errors as { data?: { errors?: { path?: string }[] } }[]) {
          for (const field of item.data?.errors ?? []) {
            if (field.path && field.path in values)
              setError(
                field.path as keyof PersonValues,
                { message: 'این مقدار معتبر یا یکتا نیست.' },
                { shouldFocus: true },
              )
          }
        }
      }
    }
  }
  return (
    <form
      aria-label="اطلاعات کارمند"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (busy.current) return
        busy.current = true
        void handleSubmit(save)(event).finally(() => {
          busy.current = false
        })
      }}
      className="flex flex-col gap-5"
    >
      <fieldset
        disabled={isSubmitting}
        className={`${cardClass} grid gap-x-5 gap-y-8 sm:grid-cols-2`}
      >
        <Typography variant="20/bold" className="sm:col-span-2">
          اطلاعات فردی و حساب کاربری
        </Typography>
        {(['name', 'phone', 'email', 'password'] as const).map((name) => (
          <Field
            key={name}
            name={name}
            label={
              {
                name: 'نام و نام خانوادگی',
                phone: 'شماره همراه',
                email: 'ایمیل',
                password: 'رمز عبور',
              }[name]
            }
            error={errors[name]?.message}
          >
            <input
              id={name}
              type={name === 'password' ? 'password' : name === 'email' ? 'email' : 'text'}
              autoComplete={name === 'password' ? 'new-password' : undefined}
              aria-invalid={!!errors[name]}
              aria-describedby={errors[name] ? `${name}-error` : undefined}
              className={controlClass}
              {...register(name)}
            />
          </Field>
        ))}
        <Field name="operationalRole" label="نقش عملیاتی" error={errors.operationalRole?.message}>
          <select id="operationalRole" className={controlClass} {...register('operationalRole')}>
            {OPERATIONAL_ROLES.map((role) => (
              <option key={role} value={role}>
                {OPERATIONAL_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </Field>
        <Field name="isActive" label="حساب فعال">
          <input
            id="isActive"
            type="checkbox"
            className="size-5 accent-brand-600"
            {...register('isActive')}
          />
        </Field>
        <Typography variant="14/regular" color="muted" className="sm:col-span-2">
          هر شخص دقیقاً یک نقش عملیاتی دارد. کارفرما یک شخص با حساب داوری است، نه سازمان. غیرفعال‌سازی
          تاریخچه را حذف نمی‌کند.
        </Typography>
      </fieldset>
      {failure !== null && <RequestError error={failure} returnTo="/dashboard/employees" />}
      {person && failure instanceof AdminError && failure.status === 409 && (
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              const latest = await adminRequest(
                `/api/users/${encodeURIComponent(person.id)}?depth=0&select[name]=true&select[phone]=true&select[email]=true&select[operationalRole]=true&select[isActive]=true&select[updatedAt]=true`,
              )
              setPerson(latest)
              reset({
                name: latest.name ?? '',
                phone: latest.phone ?? '',
                email: latest.email ?? '',
                password: '',
                operationalRole: latest.operationalRole,
                isActive: latest.isActive,
              })
              setFailure(null)
            } catch (error) {
              setFailure(error)
            }
          }}
        >
          <Typography variant="14/regular">بررسی نسخه جدید</Typography>
        </Button>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={isSubmitting || (failure instanceof AdminError && failure.status === 409)}
        >
          <Typography variant="16/semibold">
            {isSubmitting ? 'در حال ذخیره...' : 'ذخیره'}
          </Typography>
        </Button>
        <Button type="button" variant="outline-gray" disabled={isSubmitting} onClick={onCancel}>
          <Typography variant="16/regular">بازگشت به فهرست</Typography>
        </Button>
      </div>
    </form>
  )
}

export async function loadPeople(): Promise<Person[]> {
  const people: Person[] = []
  let page = 1
  let hasNext = true
  while (hasNext) {
    const result = await adminRequest(
      `/api/users?depth=0&limit=100&page=${page}&where[backendService][not_equals]=true&select[name]=true&select[phone]=true&select[email]=true&select[operationalRole]=true&select[isActive]=true&select[updatedAt]=true`,
    )
    if (!Array.isArray(result.docs)) throw new Error('invalid_people_response')
    people.push(...result.docs)
    hasNext = result.hasNextPage === true
    page++
  }
  return people
}
