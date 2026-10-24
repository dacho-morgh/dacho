export const DEFAULT_RETURN_URL = '/dashboard'
export const DASHBOARD_RETURN_URL_HEADER = 'x-dacho-return-url'

const INTERNAL_ORIGIN = 'http://dacho.local'

export function getExplicitSafeReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return null

  try {
    const rawPath = value.split(/[?#]/, 1)[0] ?? ''
    if (/%2f|%5c/i.test(rawPath)) return null
    const decodedPath = decodeURIComponent(rawPath)
    if (decodedPath.includes('%') || decodedPath.includes('\\') || /\/{2,}/.test(decodedPath)) return null
    if (decodedPath.split('/').some((segment) => segment === '.' || segment === '..')) return null

    const url = new URL(value, INTERNAL_ORIGIN)
    const isInternal = url.origin === INTERNAL_ORIGIN
    const isDashboard =
      url.pathname === DEFAULT_RETURN_URL || url.pathname.startsWith(`${DEFAULT_RETURN_URL}/`)

    if (!isInternal || !isDashboard) return null

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function getSafeReturnUrl(value: unknown): string {
  return getExplicitSafeReturnUrl(value) ?? DEFAULT_RETURN_URL
}

export function getLoginUrl(returnUrl: unknown, options: { registered?: boolean; expired?: boolean } = {}): string {
  const search = new URLSearchParams()

  if (options.registered) search.set('registered', '1')
  if (options.expired) search.set('expired', '1')
  search.set('returnUrl', getSafeReturnUrl(returnUrl))

  return `/login?${search.toString()}`
}
