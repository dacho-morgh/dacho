import {
  isInternalAdmin,
  operationalRole,
  type OperationalRole,
  type RoleCarrier,
} from '@cms-core/access/roles'
import type { User } from '@dacho/cms-core'
import { getServerSideURL } from '@dacho/cms-core/utilities'
import { cookies } from 'next/headers'
import type { Payload } from 'payload'

/**
 * Server-side read through the same-origin `/api/dashboard/*` proxy. Forwards the
 * session cookie so the proxy can resolve the user, and returns `undefined` when
 * the request is unauthenticated or fails (callers fall back to an empty/404 UI).
 */
export async function serverDashboardFetch<T>(path: string): Promise<T | undefined> {
  try {
    const cookie = (await cookies()).toString()
    const res = await fetch(`${getServerSideURL()}/api/dashboard${path}`, {
      headers: {
        cookie,
        // This is a server-originated request to our own route handler. Payload's
        // cookie strategy rejects requests with neither Origin nor Sec-Fetch-Site
        // when CSRF origins are configured, so retain the same-origin context that
        // the original browser navigation had.
        'sec-fetch-site': 'same-origin',
      },
      cache: 'no-store',
    })
    if (!res.ok) return undefined
    return (await res.json()) as T
  } catch {
    return undefined
  }
}

export type DashboardFetchResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'unauthenticated' }
  | { kind: 'denied' }
  | { kind: 'unavailable' }

/** Preserves auth/permission failures so protected routes never look empty. */
export async function serverDashboardFetchResult<T>(path: string): Promise<DashboardFetchResult<T>> {
  try {
    const cookie = (await cookies()).toString()
    const res = await fetch(`${getServerSideURL()}/api/dashboard${path}`, {
      headers: { cookie, 'sec-fetch-site': 'same-origin' },
      cache: 'no-store',
    })
    if (res.status === 401) return { kind: 'unauthenticated' }
    if (res.status === 403) return { kind: 'denied' }
    if (!res.ok) return { kind: 'unavailable' }
    return { kind: 'ok', data: (await res.json()) as T }
  } catch {
    return { kind: 'unavailable' }
  }
}

export type SeniorManagerCandidate =
  | User
  | {
      id?: number | string | null
      position?: string | null
      roles?: string[] | null
      operationalRole?: string | null
      isActive?: boolean | null
    }

/**
 * Determines whether a user is an administrator or senior manager ("مدیر ارشد").
 *
 * The former three-axis test (cmsRole, a `roles` relationship, and the
 * applicant/staff pair) is gone: authorization now reads the single multi-valued
 * `role` field, so the admin role is the whole test.
 */
export async function isSeniorManagerUser(
  _payload: Payload,
  user: SeniorManagerCandidate | null | undefined,
): Promise<boolean> {
  if (!user) return false
  return isInternalAdmin(user)
}

/** Current seven-role authority for server-rendered workspace selection. */
export function dashboardOperationalRole(
  user: SeniorManagerCandidate | null | undefined,
): OperationalRole | null {
  return operationalRole(user as RoleCarrier)
}

/** Any non-representative operational role is internal staff. */
export function isInternalDashboardUser(
  user: SeniorManagerCandidate | null | undefined,
): boolean {
  const role = dashboardOperationalRole(user)
  return role !== null && role !== 'representative'
}

export type DashboardWorkspace =
  | 'company-dossiers'
  | 'internal-queue'
  | 'applicant-queue'
  | 'unauthenticated'

/**
 * Single seven-role decision for which dashboard surface `/dashboard` renders.
 * UI routing only: the API still authorizes every read.
 */
export function dashboardWorkspace(role: OperationalRole | null): DashboardWorkspace {
  if (!role) return 'unauthenticated'
  if (role === 'system-owner' || role === 'central-secretariat') return 'company-dossiers'
  return role === 'representative' ? 'applicant-queue' : 'internal-queue'
}

/** Company dossiers are readable by the owner and Secretariat only. */
export function canReadCompanyDossiers(
  user: SeniorManagerCandidate | null | undefined,
): boolean {
  const role = dashboardOperationalRole(user)
  return role === 'system-owner' || role === 'central-secretariat'
}
