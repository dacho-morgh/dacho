import canUseDOM from './canUseDOM'

export const getServerSideURL = () => {
  const url =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000')

  // Payload compares the browser `Origin` header (never trailing-slashed)
  // against the CSRF allowlist derived from `serverURL`. A trailing slash here
  // (e.g. `https://x.com/` vs `https://x.com`) breaks cookie auth on writes
  // behind a TLS-terminating proxy, so normalize it away.
  return url.replace(/\/+$/, '')
}

export const getClientSideURL = () => {
  if (canUseDOM) {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ''}`
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  return process.env.NEXT_PUBLIC_SERVER_URL || ''
}
