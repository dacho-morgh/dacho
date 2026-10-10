import type { ArrayField, UploadField } from 'payload'
import { validations } from 'payload'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readGlobal: vi.fn() }))
vi.mock('@/utilities/getGlobals', () => ({ getCachedGlobal: () => mocks.readGlobal }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import type { LogoAsset } from '@/components/landing/home/logo-strip-data'
import LogoStripSection from '@/components/landing/home/logo-strip-section'
import { LogoStrip } from '../../../../packages/cms-core/src/globals/LogoStrip'

const svg = {
  id: 1,
  mimeType: 'image/svg+xml',
  url: '/api/media/file/colored-logo.svg',
  updatedAt: '2026-10-11T00:00:00Z',
}

describe('CMS logo strip', () => {
  beforeEach(() => mocks.readGlobal.mockReset())

  it('renders CMS SVGs in order with page links and the fixed theme color', async () => {
    mocks.readGlobal.mockResolvedValue({
      enabled: true,
      logos: [
        {
          id: 'one',
          name: 'Partner one',
          logo: svg,
          link: {
            type: 'reference',
            reference: { relationTo: 'pages', value: { slug: 'about' } },
          },
        },
        {
          id: 'two',
          name: 'Partner two',
          logo: { ...svg, id: 2 },
          link: {
            type: 'custom',
            url: 'https://example.com',
            newTab: true,
          },
        },
      ],
    })

    const section = (await LogoStripSection()) as ReactElement<{ logos: LogoAsset[] }>
    expect(section.props.logos.map(({ href }) => href)).toEqual(['/about', 'https://example.com'])
    const markup = renderToStaticMarkup(section)
    expect(markup).toContain('text-neutral-500')
    expect(markup).toContain('bg-current')
    expect(markup).toContain('mask-alpha')
    expect(markup).toContain('colored-logo.svg')
    expect(markup).not.toContain('<img')
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('tabindex="-1"')
  })

  it('hides the section when disabled and retains defaults before configuration', async () => {
    mocks.readGlobal.mockResolvedValue({ enabled: false, logos: [] })
    expect(await LogoStripSection()).toBeNull()
    mocks.readGlobal.mockResolvedValue({ enabled: true, logos: [] })
    const section = (await LogoStripSection()) as ReactElement<{ logos: LogoAsset[] }>
    expect(section.props.logos).toHaveLength(8)
  })

  it('does not render non-SVG or unresolved uploads', async () => {
    mocks.readGlobal.mockResolvedValue({
      logos: [
        { name: 'PNG', logo: { ...svg, mimeType: 'image/png' } },
        { name: 'Unresolved', logo: 12 },
      ],
    })
    expect(await LogoStripSection()).toBeNull()
  })

  it('rejects non-SVG selections with Payload backend upload validation', async () => {
    const logosField = LogoStrip.fields.find(
      (field) => 'name' in field && field.name === 'logos',
    ) as ArrayField
    const logoField = logosField.fields.find(
      (field) => 'name' in field && field.name === 'logo',
    ) as UploadField
    const media = [svg, { ...svg, id: 2, mimeType: 'image/png' }]
    const find = vi.fn(async ({ where }) => ({
      docs: media.filter(
        (item) =>
          where.and[0].id.in.includes(item.id) && item.mimeType === where.and[1].mimeType.equals,
      ),
    }))
    const options = {
      ...logoField,
      event: 'submit',
      req: {
        t: (key: string) => key,
        payload: {
          collections: { media: {} },
          db: { defaultIDType: 'number' },
          logger: { error: vi.fn() },
        },
        payloadDataLoader: { find },
      },
    } as unknown as Parameters<typeof validations.upload>[1]

    expect(await validations.upload(1, options)).toBe(true)
    expect(await validations.upload(2, options)).not.toBe(true)
    expect(await validations.upload(undefined, options)).not.toBe(true)
  })
})
