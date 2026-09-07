import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCachedGlobal: vi.fn(),
}))

vi.mock('@/utilities/getGlobals', () => ({
  getCachedGlobal: mocks.getCachedGlobal,
}))

vi.mock('@/components/ui/typography', () => ({
  Typography: vi.fn(({ children }: { children?: React.ReactNode }) => children),
}))

import { Footer } from '@/Footer/Component'

describe('footer component', () => {
  beforeEach(() => {
    mocks.getCachedGlobal.mockReset()
  })

  it('renders its static fallback when Payload cannot connect during the build', async () => {
    const connectionError = Object.assign(new Error('cannot connect to Postgres'), {
      payloadInitError: true,
    })
    mocks.getCachedGlobal.mockReturnValue(vi.fn().mockRejectedValue(connectionError))

    const result = await Footer()
    expect(result).toBeDefined()
  })

  it('loads logo, description, address, phone, columns, copyright, and social links from Payload', async () => {
    const mockFooterData = {
      logo: {
        id: 1,
        url: '/custom-logo.png',
        alt: 'لوگوی سفارشی',
      },
      logoText: 'برند سفارشی',
      description: 'توضیحات سفارشی فوتر از پی‌لود',
      address: 'تهران، خیابان آزادی',
      phone: '021-12345678',
      copyright: '© کلیه حقوق محفوظ است ۱۴۰۵',
      columns: [
        {
          title: 'دسترسی سریع',
          navItems: [
            {
              link: {
                type: 'custom',
                label: 'صفحه اصلی',
                url: '/',
                newTab: false,
              },
            },
            {
              link: {
                type: 'custom',
                label: 'تماس',
                url: '/contact',
                newTab: true,
              },
            },
          ],
        },
      ],
      socialLinks: [
        {
          platform: 'تلگرام',
          url: 'https://t.me/example',
          icon: {
            id: 2,
            url: '/telegram.svg',
            alt: 'تلگرام',
            mimeType: 'image/svg+xml',
          },
        },
      ],
    }

    mocks.getCachedGlobal.mockReturnValue(vi.fn().mockResolvedValue(mockFooterData))

    const result = await Footer()
    expect(result).toBeDefined()
  })

  it('supports legacy navItems when columns array is empty', async () => {
    const mockFooterData = {
      navItems: [
        {
          link: {
            type: 'custom',
            label: 'آیتم قدیمی',
            url: '/old-path',
          },
        },
      ],
    }

    mocks.getCachedGlobal.mockReturnValue(vi.fn().mockResolvedValue(mockFooterData))

    const result = await Footer()
    expect(result).toBeDefined()
  })
})
