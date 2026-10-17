import type { NextRequest } from 'next/server'

/** Minimal user shape the proxy needs from the resolved Payload session. */
export interface ProxyUser {
  id: string | number
  /** The single authorization axis: a user may hold several roles. */
  roles?: string[] | null
}

/** Normalizes the user's roles to a plain string list for the proxy header. */
export function normalizeRoles(roles: ProxyUser['roles']): string[] {
  if (!Array.isArray(roles)) return []
  return roles.map((role) => String(role).trim()).filter((role) => role.length > 0)
}

export interface DashboardProxyConfig {
  backendUrl: string
  proxySecret: string
}

/**
 * Builds the outbound request the same-origin proxy forwards to the backend:
 * the forwarded identity headers (`x-user-id`, `x-user-roles`)
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
    // The acting user's roles travel as one comma-separated header; this is the
    // only identity axis the backend needs.
    'x-user-roles': normalizeRoles(user.roles).join(','),
  }

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
