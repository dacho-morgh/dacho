import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { DASHBOARD_RETURN_URL_HEADER, getLoginUrl } from '@/utilities/auth-return-url'

export function proxy(request: NextRequest) {
  const returnUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`

  if (!request.cookies.has('payload-token')) {
    return NextResponse.redirect(new URL(getLoginUrl(returnUrl), request.url))
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(DASHBOARD_RETURN_URL_HEADER, returnUrl)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
