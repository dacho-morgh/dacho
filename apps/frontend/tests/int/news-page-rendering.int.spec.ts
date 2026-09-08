import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('@/components/landing/home/news-card', () => ({ default: vi.fn() }))
vi.mock('@/components/landing/home/recruitment-section', () => ({ default: vi.fn() }))
vi.mock('@/components/landing/news/news-empty-state', () => ({ NewsEmptyState: vi.fn() }))
vi.mock('@/components/landing/news/news-page-header', () => ({
  NewsBreadcrumb: vi.fn(),
  NewsPageHeading: vi.fn(),
}))

import NewsPage, { revalidate } from '@/app/(frontend)/news/page'

describe('news listing rendering', () => {
  beforeEach(() => {
    mocks.getPayload.mockReset()
  })

  it('revalidates the static page every minute', () => {
    expect(revalidate).toBe(60)
  })

  it('renders its empty state when Payload cannot connect during the build', async () => {
    const connectionError = Object.assign(new Error('cannot connect to Postgres'), {
      payloadInitError: true,
    })
    mocks.getPayload.mockRejectedValue(connectionError)

    await expect(NewsPage()).resolves.toBeDefined()
  })
})
