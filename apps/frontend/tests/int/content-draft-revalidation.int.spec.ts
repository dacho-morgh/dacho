import { describe, expect, it, vi } from 'vitest'

import { revalidateNews } from '@cms-core/collections/News/hooks/revalidateNews'
import { revalidatePost } from '@cms-core/collections/Posts/hooks/revalidatePost'

describe('content draft revalidation', () => {
  it.each([
    ['news', revalidateNews],
    ['post', revalidatePost],
  ])('does not revalidate when the admin creates a %s draft', (_name, hook) => {
    const doc = { _status: 'draft', slug: 'new-draft' }
    const args = {
      doc,
      previousDoc: {},
      req: { context: {}, payload: { logger: { info: vi.fn() } } },
    } as unknown as Parameters<typeof hook>[0]

    expect(() => hook(args)).not.toThrow()
  })
})
