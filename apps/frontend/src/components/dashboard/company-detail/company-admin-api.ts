import { DashboardApiError } from '@/utilities/dashboard-api'
import { dashboardFetch } from '@/utilities/dashboard-api/core'

/** The company fields an administrator may change; the national id is fixed. */
export interface CompanyInfoInput {
  name: string
  establishmentDate: string
  status: string
  type: string
  registrationNumber: string
  economicCode: string
}

export interface AddressInput {
  title: string
  province: string
  city: string
  postalCode: string
  address: string
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
})

const company = (id: string) => `/admin/companies/${encodeURIComponent(id)}`

export function updateCompanyInfo(id: string, input: Partial<CompanyInfoInput>): Promise<void> {
  return dashboardFetch<unknown>(company(id), json('PATCH', { company: input })).then(() => undefined)
}

export function addCompanyAddress(id: string, input: AddressInput): Promise<void> {
  return dashboardFetch<unknown>(`${company(id)}/addresses`, json('POST', input)).then(() => undefined)
}

export function updateCompanyAddress(id: string, addressId: string, input: Partial<AddressInput>): Promise<void> {
  return dashboardFetch<unknown>(`${company(id)}/addresses/${encodeURIComponent(addressId)}`, json('PUT', input)).then(
    () => undefined,
  )
}

export function deleteCompanyAddress(id: string, addressId: string): Promise<void> {
  return dashboardFetch<unknown>(`${company(id)}/addresses/${encodeURIComponent(addressId)}`, json('DELETE')).then(
    () => undefined,
  )
}

/** What the System Owner may change on a representative's account. `isActive: false` is the removal. */
export interface RepresentativeAccountInput {
  name?: string
  phone?: string
  email?: string
  password?: string
  isActive?: boolean
}

/**
 * The CMS personnel command (`PATCH /api/users/personnel/:id`), guarded by the account's
 * version: a refusal with 409 means the account changed after the page was opened.
 */
export async function updateRepresentativeAccount(
  userId: string,
  expectedUpdatedAt: string,
  input: RepresentativeAccountInput,
): Promise<void> {
  const response = await fetch(`/api/users/personnel/${encodeURIComponent(userId)}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...json('PATCH', { ...input, expectedUpdatedAt }),
  })
  if (response.ok) return
  const body = (await response.json().catch(() => null)) as { error?: unknown; errors?: { message?: unknown }[] } | null
  const code =
    typeof body?.error === 'string'
      ? body.error
      : typeof body?.errors?.[0]?.message === 'string'
        ? 'rejected_value'
        : 'request_failed'
  throw new DashboardApiError(response.status, code)
}
