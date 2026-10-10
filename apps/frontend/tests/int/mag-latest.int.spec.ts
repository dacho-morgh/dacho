import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn(), findGlobal: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('payload', () => ({ getPayload: async () => mocks }))
vi.mock('@/payload.config', () => ({ default: Promise.resolve({}) }))

import { getMagData } from '@/components/landing/mag/data'

const news = [
  { id: 1, title: 'Pinned news', slug: 'pinned', pinned: true, publishedAt: '2026-09-01' },
  { id: 2, title: 'Newest news', slug: 'newest', publishedAt: '2026-10-01' },
  { id: 3, title: 'Older news', slug: 'older', publishedAt: '2026-09-30' },
]
const posts = [
  { id: 4, title: 'Newest article', slug: 'newest-article', publishedAt: '2026-10-01' },
  { id: 5, title: 'Older article', slug: 'older-article', publishedAt: '2026-09-30' },
]

describe('automatic magazine latest lists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findGlobal.mockResolvedValue({
      latestNews: [3, 2],
      latestArticles: [5],
      hero: 3,
      eventNews: [3, 1],
      sections: [{ id: 'curated', title: 'Curated', featured: { relationTo: 'posts', value: 5 } }],
    })
    mocks.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'news' ? news : posts,
    }))
  })

  it('uses published sorted collection queries despite legacy manual selections', async () => {
    const data = await getMagData()
    expect(data.latestNews.map((item) => item.id)).toEqual(['news:1', 'news:2', 'news:3'])
    expect(data.articles.map((item) => item.id)).toEqual(['posts:4', 'posts:5'])
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'news',
        draft: false,
        overrideAccess: false,
        where: { _status: { equals: 'published' } },
        limit: 8,
        sort: ['-pinned', '-publishedAt', '-createdAt'],
      }),
    )
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        draft: false,
        overrideAccess: false,
        where: { _status: { equals: 'published' } },
        limit: 3,
        sort: ['-publishedAt', '-createdAt'],
      }),
    )
    expect(data.hero?.id).toBe('news:3')
    expect(data.eventNews.map((item) => item.id)).toEqual(['news:3', 'news:1'])
    expect(data.sections[0]?.featured?.id).toBe('posts:5')
  })

  it('returns empty lists when no published documents exist', async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    const data = await getMagData()
    expect(data.latestNews).toEqual([])
    expect(data.articles).toEqual([])
    expect(data.hero).toBeUndefined()
  })
})
