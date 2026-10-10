import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/cache', () => mocks)
vi.mock('../../../../packages/cms-core/node_modules/next/cache.js', () => mocks)

import { revalidatePath } from 'next/cache'
import {
  revalidateNews,
  revalidateDelete as deleteNews,
} from '../../../../packages/cms-core/src/collections/News/hooks/revalidateNews'
import {
  revalidatePost,
  revalidateDelete as deletePost,
} from '../../../../packages/cms-core/src/collections/Posts/hooks/revalidatePost'

describe.each([
  { collection: 'news', change: revalidateNews, remove: deleteNews, paths: ['/', '/news', '/mag'] },
  { collection: 'posts', change: revalidatePost, remove: deletePost, paths: ['/posts', '/mag'] },
])('$collection public content freshness', ({ collection, change, remove, paths }) => {
  beforeEach(() => vi.clearAllMocks())

  const runChange = (status: string, previousStatus?: string, disableRevalidate = false) =>
    change({
      doc: { _status: status, slug: 'story', pinned: true },
      previousDoc: previousStatus ? { _status: previousStatus, slug: 'story' } : undefined,
      req: { payload: { logger: { info: vi.fn() } }, context: { disableRevalidate } },
    } as unknown as Parameters<typeof change>[0])

  it.each([
    ['published', undefined],
    ['published', 'published'],
    ['draft', 'published'],
  ])('refreshes public lists for %s after %s', (status, previousStatus) => {
    runChange(status, previousStatus)
    paths.forEach((path) => expect(revalidatePath).toHaveBeenCalledWith(path))
    expect(revalidatePath).toHaveBeenCalledWith(`/${collection}/story`)
    if (collection === 'posts')
      expect(revalidatePath).toHaveBeenCalledWith('/posts/page/[pageNumber]', 'page')
  })

  it('does not invalidate draft-only or explicitly suppressed changes', () => {
    runChange('draft', 'draft')
    runChange('published', 'draft', true)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refreshes public lists after deletion and honors suppression', () => {
    const args = { doc: { slug: 'story' }, req: { context: {} } } as unknown as Parameters<
      typeof remove
    >[0]
    remove(args)
    paths.forEach((path) => expect(revalidatePath).toHaveBeenCalledWith(path))
    vi.clearAllMocks()
    remove({ ...args, req: { context: { disableRevalidate: true } } } as unknown as Parameters<
      typeof remove
    >[0])
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
