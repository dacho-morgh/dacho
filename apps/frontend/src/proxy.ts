import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isActiveAccount } from '@cms-core/access/roles'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { DASHBOARD_RETURN_URL_HEADER, getLoginUrl } from '@/utilities/auth-return-url'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

/**
 * Served before any layout exists, so it carries its own direction and viewport. No private
 * data and nothing from the request goes in it; the empty href reloads the address asked for.
 */
const ACCESS_UNAVAILABLE_PAGE = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>سرویس در دسترس نیست</title>
</head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:4rem 1rem;line-height:2">
<h1 style="font-size:1.25rem">سرویس بررسی دسترسی در دسترس نیست</h1>
<p>این خطا به معنای نبود داده یا لغو دسترسی شما نیست. کمی بعد دوباره تلاش کنید.</p>
<p><a href="">تلاش دوباره</a></p>
</body>
</html>`

export async function proxy(request: NextRequest) {
  const returnUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
  const hasSessionCookie = Boolean(request.cookies.get('payload-token')?.value)

  const requestHeaders = getPayloadAuthHeaders(request)

  if (request.nextUrl.pathname.startsWith('/api/dashboard')) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL(getLoginUrl(returnUrl), request.url))
  }

  const unavailable = () => new NextResponse(ACCESS_UNAVAILABLE_PAGE, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store, max-age=0' },
  })

  let user = null
  try {
    const payload = await getPayload({ config: configPromise })
    user = (await payload.auth({ headers: requestHeaders })).user
  } catch {
    // Fail closed without discarding a possibly valid session when auth is unavailable.
    return unavailable()
  }

  if (!user || !isActiveAccount(user) || user.backendService) {
    return NextResponse.redirect(new URL(getLoginUrl(returnUrl, { expired: hasSessionCookie }), request.url))
  }

  if (!user.operationalRole && user.contentEditor === true) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  const backendBase = (process.env.BACKEND_URL ?? 'http://localhost:4000').replace(/\/+$/, '')
  const accessUrl = new URL(`${backendBase}/access`)
  accessUrl.searchParams.set('path', request.nextUrl.pathname)
  let accessResponse: Response
  try {
    accessResponse = await fetch(accessUrl, {
      headers: {
        'x-internal-proxy-secret': process.env.INTERNAL_PROXY_SECRET ?? '',
        'x-user-id': String(user.id),
        'x-user-roles': Array.isArray(user.roles) ? user.roles.join(',') : '',
      },
      cache: 'no-store',
    })
  } catch {
    return unavailable()
  }

  if (accessResponse.status === 401) {
    return NextResponse.redirect(new URL(getLoginUrl(returnUrl, { expired: true }), request.url))
  }
  if (accessResponse.status === 403) {
    if (request.nextUrl.pathname !== '/dashboard') {
      return NextResponse.redirect(new URL('/dashboard?access=denied', request.url))
    }
    requestHeaders.set(DASHBOARD_RETURN_URL_HEADER, returnUrl)
    requestHeaders.set('x-dacho-dashboard-path', request.nextUrl.pathname)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
  if (!accessResponse.ok) {
    return unavailable()
  }

  const access = (await accessResponse.json().catch(() => null)) as { allowed?: boolean } | null
  if (typeof access?.allowed !== 'boolean') return unavailable()
  if (!access?.allowed && request.nextUrl.pathname !== '/dashboard') {
    return NextResponse.redirect(new URL('/dashboard?access=denied', request.url))
  }

  requestHeaders.set(DASHBOARD_RETURN_URL_HEADER, returnUrl)
  requestHeaders.set('x-dacho-dashboard-path', request.nextUrl.pathname)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/dashboard/:path*'],
}
