import { DashboardApiError } from './core'

/**
 * Own account (T58) and owner-created companies (T57). These are CMS commands
 * under `/api/users` and `/api/companies`, not the backend dashboard proxy: the
 * person's own session is the only target, so no id travels in the request.
 */

export interface OwnAccountDto {
  id: number | string
  name: string
  phone: string
  email: string
  /** Optimistic-concurrency token; a stale one gets 409. */
  updatedAt: string
}

export interface AccountFieldError {
  field: string
  code: string
}

/** A refused account command, with the per-field reasons the server gave. */
export class AccountApiError extends DashboardApiError {
  constructor(status: number, code: string, public fieldErrors: AccountFieldError[] = []) {
    super(status, code, fieldErrors.map((error) => error.field))
  }
}

async function accountFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(path, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string
      errors?: { field?: unknown; code?: unknown }[]
    } | null
    const fieldErrors = (Array.isArray(body?.errors) ? body.errors : []).flatMap((error) =>
      typeof error?.field === 'string' && typeof error.code === 'string' ? [{ field: error.field, code: error.code }] : [],
    )
    const code = typeof body?.error === 'string'
      ? body.error
      : typeof body?.errors?.[0]?.code === 'string' ? body.errors[0].code : 'request_failed'
    throw new AccountApiError(res.status, code, fieldErrors)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export async function updateOwnAccount(
  input: Partial<Pick<OwnAccountDto, 'name' | 'phone' | 'email'>> & { expectedUpdatedAt: string },
): Promise<OwnAccountDto> {
  const { doc } = await accountFetch<{ doc: OwnAccountDto }>('/api/users/me/account', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return doc
}

export function changeOwnPassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
  return accountFetch<void>('/api/users/me/password', { method: 'POST', body: JSON.stringify(input) })
}

export interface OwnerCompanyInput {
  name: string
  position: string
  phone: string
  email: string
  password: string
  companyName: string
  companyNationalId: string
  activityDomain: string
  companyType?: string
  companyProvince?: string
  companyCity?: string
}

export function createOwnerCompany(
  input: OwnerCompanyInput,
): Promise<{ user: { id: number | string }; company: { id: number | string; name?: string | null } }> {
  return accountFetch('/api/companies/owner-create', { method: 'POST', body: JSON.stringify(input) })
}

/** Mirrors the CMS minimum (`MIN_PASSWORD_LENGTH`). */
export const MIN_PASSWORD_LENGTH = 8
