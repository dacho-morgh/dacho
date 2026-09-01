import { cookies } from 'next/headers'

import { getServerSideURL } from '@dacho/cms-core/utilities'

/**
 * Server-side read through the same-origin `/api/dashboard/*` proxy. Forwards the
 * session cookie so the proxy can resolve the user, and returns `undefined` when
 * the request is unauthenticated or fails (callers fall back to an empty/404 UI).
 */
export async function serverDashboardFetch<T>(path: string): Promise<T | undefined> {
  try {
    const cookie = (await cookies()).toString()
    const res = await fetch(`${getServerSideURL()}/api/dashboard${path}`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return undefined
    return (await res.json()) as T
  } catch {
    return undefined
  }
}