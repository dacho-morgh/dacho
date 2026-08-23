import { describe, expect, it, vi } from 'vitest'

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('@/components/landing/home/news-card', () => ({ default: vi.fn() }))
vi.mock('@/components/landing/home/recruitment-section', () => ({ default: vi.fn() }))
vi.mock('@/components/landing/news/news-empty-state', () => ({ NewsEmptyState: vi.fn() }))
vi.mock('@/components/landing/news/news-page-header', () => ({
  NewsBreadcrumb: vi.fn(),
  NewsPageHeading: vi.fn(),
}))

import { dynamic } from '@/app/(frontend)/news/page'

describe('news listing rendering', () => {
  it('waits until request time before querying Payload', () => {
    expect(dynamic).toBe('force-dynamic')
  })
})
