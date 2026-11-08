'use client'

import { type OperationalRole } from '@cms-core/access/roles'
import { type ReactNode } from 'react'
import { type FieldErrors, type FieldValues, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { RequiredMark, hasRequiredControl } from '@/components/ui/field'
import { Typography } from '@/components/ui/typography'

export type Person = {
  id: string | number
  name?: string | null
  phone?: string
  email?: string | null
  operationalRole?: OperationalRole
  isActive: boolean
  updatedAt?: string
  degree?: string | null
  activityField?: string | null
}
export const controlClass =
  'h-10 w-full min-w-0 rounded-lg border border-neutral-200 bg-background px-3 text-neutral-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
export const cardClass = 'rounded-2xl border border-neutral-200 bg-background p-4'

export function Field({
  name,
  label,
  error,
  required,
  children,
}: {
  name: string
  label: string
  error?: string
  /** Defaults to whether the control inside is marked aria-required. */
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Typography asChild variant="16/semibold">
        <label htmlFor={name}>
          {label}
          {(required ?? hasRequiredControl(children)) ? <RequiredMark className="ms-0.5" /> : null}
        </label>
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
        <Button size="40" asChild variant="outline-gray">
          <a href={`/login?returnUrl=${encodeURIComponent(returnTo)}`}>
            <Typography variant="14/regular">ورود دوباره</Typography>
          </a>
        </Button>
      ) : (
        retry && (
          <Button size="40" type="button" variant="outline-gray" onClick={retry}>
            <Typography variant="14/regular">تلاش دوباره</Typography>
          </Button>
        )
      )}
    </div>
  )
}

export async function loadPeople(): Promise<Person[]> {
  const people: Person[] = []
  let page = 1
  let hasNext = true
  while (hasNext) {
    const result = await adminRequest(
      `/api/users?depth=0&limit=100&page=${page}&where[backendService][not_equals]=true&select[name]=true&select[phone]=true&select[email]=true&select[operationalRole]=true&select[isActive]=true&select[updatedAt]=true&select[degree]=true&select[activityField]=true`,
    )
    if (!Array.isArray(result.docs)) throw new Error('invalid_people_response')
    people.push(...result.docs)
    hasNext = result.hasNextPage === true
    page++
  }
  return people
}
