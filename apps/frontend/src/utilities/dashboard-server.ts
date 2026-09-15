import type { Role, User } from '@dacho/cms-core'
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
      cmsRole?: string | null
      position?: string | null
      role?: string | null
      roles?: Array<number | string | Role | { id?: number | string; name?: string | null }> | null
    }

/**
 * Determines whether a user is an administrator or senior manager ("مدیر ارشد").
 * Evaluates:
 * 1. `cmsRole === 'admin'`
 * 2. `position === 'مدیر ارشد'`
 * 3. `roles` (many-to-many relationship) containing a role named 'مدیر ارشد' (both object and ID refs)
 * 4. `role === 'staff'` (operational staff / admin team)
 */
export async function isSeniorManagerUser(
  payload: Payload,
  user: SeniorManagerCandidate | null | undefined,
): Promise<boolean> {
  if (!user) return false
  if (user.cmsRole === 'admin') return true
  if (user.position === 'مدیر ارشد') return true

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    for (const role of user.roles) {
      if (typeof role === 'object' && role !== null && 'name' in role && role.name === 'مدیر ارشد') {
        return true
      }
      if (typeof role === 'number' || typeof role === 'string') {
        try {
          const roleDoc = await payload.findByID({
            collection: 'roles',
            id: role,
            depth: 0,
          })
          if (roleDoc?.name === 'مدیر ارشد') return true
        } catch {
          // Ignore lookup failure
        }
      }
    }
  }

  if (user.role === 'staff') return true

  return false
}

