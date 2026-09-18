import { getServerSideURL } from '@dacho/cms-core/utilities'
import type { NextRequest } from 'next/server'

type RequestLike = NextRequest | Headers | { headers: Headers }

function resolveHeaders(input: RequestLike): Headers {
  if (input instanceof Headers) return new Headers(input)
  if ('headers' in input && input.headers instanceof Headers) return new Headers(input.headers)
  return new Headers((input as NextRequest).headers)
}

function resolveOrigin(input: RequestLike, headers: Headers): string | undefined {
  if ('nextUrl' in input && input.nextUrl?.origin) {
    return input.nextUrl.origin
  }
  const host = headers.get('x-forwarded-host') || headers.get('host')
  if (!host) return undefined
  const proto = headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

/**
 * Normalizes request headers for Payload authentication.
 *
 * Payload's cookie extraction strategy relies on either `Origin` (matching the
 * CSRF allowlist) or `Sec-Fetch-Site` ('same-origin', 'same-site', or 'none').
 * On plain-HTTP LAN origins (e.g. mobile testing on 192.168.x.x:3000), Chrome
 * considers the origin untrusted and omits all `Sec-Fetch-*` headers.
 * Furthermore, direct GET page navigations never carry an `Origin` header.
 *
 * This function:
 * 1. Restores `Sec-Fetch-Site: same-origin` when browser metadata is absent
 *    and the request is same-origin (or navigation without cross-origin indicator).
 * 2. When `Origin` is present and matches the server's own request origin
 *    (same-origin POST/PATCH on LAN), maps it to the configured `serverURL` so
 *    Payload's CSRF check succeeds in development environments.
 */
export function getPayloadAuthHeaders(input: RequestLike): Headers {
  const headers = resolveHeaders(input)
  const requestOrigin = resolveOrigin(input, headers)
  const browserOrigin = headers.get('origin')
  const secFetchSite = headers.get('sec-fetch-site')

  // If Sec-Fetch-Site is missing (mobile HTTP) and no cross-site origin was provided:
  if (!secFetchSite) {
    if (!browserOrigin || (requestOrigin && browserOrigin === requestOrigin)) {
      headers.set('sec-fetch-site', 'same-origin')
    }
  }

  // If same-origin request on LAN in dev, ensure Origin satisfies Payload's CSRF allowlist
  if (browserOrigin && requestOrigin && browserOrigin === requestOrigin) {
    const serverUrl = getServerSideURL()
    if (serverUrl) {
      headers.set('origin', serverUrl)
    }
  }

  return headers
}
