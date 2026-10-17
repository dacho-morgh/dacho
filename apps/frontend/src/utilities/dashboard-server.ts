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

export type SeniorManagerCandidate =
  | User
  | {
      id?: number | string | null
      position?: string | null
      roles?: string[] | null
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
  return Array.isArray(user.roles) && user.roles.includes('admin')
}
