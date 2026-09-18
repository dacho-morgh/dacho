import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { DASHBOARD_RETURN_URL_HEADER, getLoginUrl } from '@/utilities/auth-return-url'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export function proxy(request: NextRequest) {
  const returnUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
  const sessionCookie = request.cookies.get('payload-token')?.value

  const requestHeaders = getPayloadAuthHeaders(request)

  if (request.nextUrl.pathname.startsWith('/api/dashboard')) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (!sessionCookie) {
    return NextResponse.redirect(new URL(getLoginUrl(returnUrl), request.url))
  }

  requestHeaders.set(DASHBOARD_RETURN_URL_HEADER, returnUrl)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/dashboard/:path*'],
}
