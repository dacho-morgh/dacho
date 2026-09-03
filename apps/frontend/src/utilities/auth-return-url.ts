export const DEFAULT_RETURN_URL = '/dashboard'
export const DASHBOARD_RETURN_URL_HEADER = 'x-dacho-return-url'

const INTERNAL_ORIGIN = 'http://dacho.local'

export function getSafeReturnUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return DEFAULT_RETURN_URL

  try {
    const url = new URL(value, INTERNAL_ORIGIN)
    const isInternal = url.origin === INTERNAL_ORIGIN
    const isDashboard =
      url.pathname === DEFAULT_RETURN_URL || url.pathname.startsWith(`${DEFAULT_RETURN_URL}/`)

    if (!isInternal || !isDashboard) return DEFAULT_RETURN_URL

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_RETURN_URL
  }
}

export function getLoginUrl(returnUrl: unknown, options: { registered?: boolean } = {}): string {
  const search = new URLSearchParams()

  if (options.registered) search.set('registered', '1')
  search.set('returnUrl', getSafeReturnUrl(returnUrl))

  return `/login?${search.toString()}`
}
