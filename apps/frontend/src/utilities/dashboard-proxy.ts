import type { NextRequest } from 'next/server'

export type ProxyRoleRef = string | number | { id: string | number }

/** Minimal user shape the proxy needs from the resolved Payload session. */
export interface ProxyUser {
  id: string | number
  role?: 'applicant' | 'staff' | null
  cmsRole?: string | null
  roles?: ProxyRoleRef[] | null
}

function roleRefToId(role: ProxyRoleRef): string {
  if (typeof role === 'object' && role !== null) return String(role.id)
  return String(role)
}

/** Normalizes a Payload `roles` relationship (ids, strings, or `{id}` objects) to id strings. */
export function normalizeRoles(roles: ProxyUser['roles']): string[] {
  if (!Array.isArray(roles)) return []
  return roles.map(roleRefToId).filter((id) => id.length > 0)
}

export interface DashboardProxyConfig {
  backendUrl: string
  proxySecret: string
}

/**
 * Builds the outbound request the same-origin proxy forwards to the backend:
 * the forwarded identity headers (`x-user-id`, `x-user-roles`, `x-user-cms-role`)
 * plus the shared `x-internal-proxy-secret` that proves the request came from our
 * proxy. The path is the `/api/dashboard/*` remainder; query + method + body pass
 * through unchanged.
 */
export async function buildBackendRequest(
  user: ProxyUser,
  req: NextRequest,
  path: string[],
  config: DashboardProxyConfig,
): Promise<{ url: string; init: RequestInit }> {
  const url = new URL(req.url)
  const target = `${config.backendUrl.replace(/\/+$/, '')}/${path.map(encodeURIComponent).join('/')}${url.search}`

  const headers: Record<string, string> = {
    'x-internal-proxy-secret': config.proxySecret,
    'x-user-id': String(user.id),
    'x-user-roles': normalizeRoles(user.roles).join(','),
  }
  if (user.role) headers['x-user-role'] = user.role
  if (user.cmsRole) headers['x-user-cms-role'] = user.cmsRole

  const contentType = req.headers.get('content-type')
  if (contentType) headers['content-type'] = contentType

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const body = hasBody ? await req.text() : undefined

  return {
    url: target,
    init: {
      method: req.method,
      headers,
      ...(body !== undefined ? { body } : {}),
    },
  }
}
