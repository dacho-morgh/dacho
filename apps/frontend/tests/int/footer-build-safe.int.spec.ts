import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCachedGlobal: vi.fn(),
}))

vi.mock('@/utilities/getGlobals', () => ({
  getCachedGlobal: mocks.getCachedGlobal,
}))

vi.mock('@/components/ui/typography', () => ({ Typography: vi.fn() }))

import { Footer } from '@/Footer/Component'

describe('footer build fallback', () => {
  beforeEach(() => {
    mocks.getCachedGlobal.mockReset()
  })

  it('renders its static fallback when Payload cannot connect during the build', async () => {
    const connectionError = Object.assign(new Error('cannot connect to Postgres'), {
      payloadInitError: true,
    })
    mocks.getCachedGlobal.mockReturnValue(vi.fn().mockRejectedValue(connectionError))

    await expect(Footer()).resolves.toBeDefined()
  })
})
