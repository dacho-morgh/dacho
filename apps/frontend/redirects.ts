import type { NextConfig } from 'next'

export const redirects: NextConfig['redirects'] = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header' as const,
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  const dashboardAdminRedirect = {
    source: '/dashboard/admin',
    destination: '/dashboard',
    permanent: false,
  }

  const dashboardAdminSubpathRedirect = {
    source: '/dashboard/admin/:path*',
    destination: '/dashboard/:path*',
    permanent: false,
  }

  return [internetExplorerRedirect, dashboardAdminRedirect, dashboardAdminSubpathRedirect]
}
