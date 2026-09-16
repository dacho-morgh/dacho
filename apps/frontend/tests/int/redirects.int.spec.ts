import { describe, expect, it } from 'vitest'
import { redirects } from '../../redirects'

describe('Dashboard Redirects', () => {
  it('redirects support routes to the unified letters inbox', async () => {
    if (!redirects) throw new Error('redirects not configured')
    const list = await redirects()
    const supportRedirect = list.find((r) => r.source === '/dashboard/support')
    const supportSubpathRedirect = list.find((r) => r.source === '/dashboard/support/:path*')

    expect(supportRedirect).toBeDefined()
    expect(supportRedirect?.destination).toBe('/dashboard/letters')

    expect(supportSubpathRedirect).toBeDefined()
    expect(supportSubpathRedirect?.destination).toBe('/dashboard/letters')
  })

  it('redirects legacy admin routes to unified dashboard routes', async () => {
    if (!redirects) throw new Error('redirects not configured')
    const list = await redirects()
    const adminRedirect = list.find((r) => r.source === '/dashboard/admin')
    const adminSubpathRedirect = list.find((r) => r.source === '/dashboard/admin/:path*')

    expect(adminRedirect).toBeDefined()
    expect(adminRedirect?.destination).toBe('/dashboard')

    expect(adminSubpathRedirect).toBeDefined()
    expect(adminSubpathRedirect?.destination).toBe('/dashboard/:path*')
  })
})
