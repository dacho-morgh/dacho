import { beforeEach, describe, expect, it } from 'vitest'

import type { CodeStore } from '../src/otp/code-store.js'

export interface StoreOptions {
  now?: () => number
  maxAttempts?: number
}

/** Shared behavioural contract every CodeStore implementation must satisfy. */
export function describeCodeStore(
  name: string,
  makeStore: (opts: StoreOptions) => CodeStore | Promise<CodeStore>,
  cleanup: () => void | Promise<void>,
): void {
  describe(name, () => {
    beforeEach(async () => {
      await cleanup()
    })

    it('verifies a matching code once, then consumes it', async () => {
      const store = await makeStore({})
      await store.save('0912', '123456', 300)

      expect(await store.verify('0912', '123456')).toBe(true)
      expect(await store.verify('0912', '123456')).toBe(false)
    })

    it('rejects a wrong code', async () => {
      const store = await makeStore({})
      await store.save('0912', '123456', 300)

      expect(await store.verify('0912', '000000')).toBe(false)
    })

    it('rejects when no code was issued for the phone', async () => {
      const store = await makeStore({})

      expect(await store.verify('0912', '123456')).toBe(false)
    })

    it('rejects an expired code', async () => {
      let t = 0
      const store = await makeStore({ now: () => t })
      await store.save('0912', '123456', 300)
      t = 301_000

      expect(await store.verify('0912', '123456')).toBe(false)
    })

    it('rejects after too many attempts', async () => {
      const store = await makeStore({ maxAttempts: 3 })
      await store.save('0912', '123456', 300)

      await store.verify('0912', '000000')
      await store.verify('0912', '000000')
      await store.verify('0912', '000000')

      expect(await store.verify('0912', '123456')).toBe(false)
    })
  })
}
