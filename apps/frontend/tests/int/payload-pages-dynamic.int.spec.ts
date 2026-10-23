import { getPayload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Route configuration checks do not need to bootstrap the real CMS config.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

vi.mock('@/utilities/getFormId', () => ({ getFormIdByTitle: vi.fn() }))
vi.mock('@/components/landing/contact/message-form', () => ({ MessageForm: vi.fn() }))
vi.mock('@/components/ui/typography', () => ({ Typography: vi.fn() }))
vi.mock('@/utilities/siteMetadata', () => ({ createPageMetadata: vi.fn(() => ({})) }))
vi.mock('@/components/icons', () => ({
  ContactAddressIcon: vi.fn(),
  ContactMailIcon: vi.fn(),
  ContactPhoneIcon: vi.fn(),
}))
vi.mock('lucide-react', () => ({ MapPin: vi.fn() }))
vi.mock('@/components/landing/event-detail/event-detail-route', () => ({
  EventDetailRoute: vi.fn(),
  generateEventDetailMetadata: vi.fn(),
}))

describe('Payload-backed pages', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['connect', () => import('@/app/(frontend)/connect/page')],
    ['cooperation', () => import('@/app/(frontend)/cooperation/page')],
    ['events', () => import('@/app/(frontend)/events/page')],
    ['exhibitions', () => import('@/app/(frontend)/exhibitions/page')],
  ])('renders %s per request instead of querying Payload during the build', async (_, loadPage) => {
    const page = await loadPage()

    expect(page.dynamic).toBe('force-dynamic')
    expect(getPayload).not.toHaveBeenCalled()
  })
})
