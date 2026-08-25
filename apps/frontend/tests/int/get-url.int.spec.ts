import { afterEach, describe, expect, it } from 'vitest'

import { getServerSideURL } from '@dacho/cms-core/utilities'

// `getServerSideURL()` feeds Payload's `serverURL`, which becomes the CSRF
// allowlist. Payload compares it to the browser `Origin` header (which never
// carries a trailing slash). A trailing slash here makes writes 403 behind a
// TLS-terminating proxy — see payload.config.ts.
describe('getServerSideURL', () => {
  const original = process.env.NEXT_PUBLIC_SERVER_URL

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SERVER_URL
    else process.env.NEXT_PUBLIC_SERVER_URL = original
  })

  it('strips trailing slashes so it matches the browser Origin header', () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://pogif.ir/'
    expect(getServerSideURL()).toBe('https://pogif.ir')
  })

  it('strips multiple trailing slashes', () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://pogif.ir///'
    expect(getServerSideURL()).toBe('https://pogif.ir')
  })

  it('leaves a clean URL untouched', () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://pogif.ir'
    expect(getServerSideURL()).toBe('https://pogif.ir')
  })
})
