import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readGlobal: vi.fn() }))
vi.mock('@/utilities/getGlobals', () => ({ getCachedGlobal: () => mocks.readGlobal }))

import { StoryLead } from '@/components/landing/news/story-lead'
import { Footer } from '@/Footer/Component'

describe('content presentation', () => {
  it('renders a full excerpt and omits blank leads', () => {
    const excerpt = 'خلاصه خبر\nپاراگراف دوم'
    const markup = renderToStaticMarkup(createElement(StoryLead, { excerpt }))
    expect(markup).toContain(excerpt)
    expect(markup).toContain('bg-neutral-100')
    expect(markup).toContain('whitespace-pre-line')
    for (const value of [undefined, null, '', '  \n']) {
      expect(StoryLead({ excerpt: value })).toBeNull()
    }
  })

  it.each(['columns', 'legacy', 'fallback'])(
    'places one news link after magazine for %s footer links',
    async (source) => {
      const navItems = ['/news', '/mag', '/about', '/news'].map((url) => ({
        link: { type: 'custom', label: url, url },
      }))
      mocks.readGlobal.mockResolvedValue(
        source === 'columns'
          ? { columns: [{ title: 'صفحات', navItems }] }
          : source === 'legacy'
            ? { navItems }
            : {},
      )
      const markup = renderToStaticMarkup(await Footer())
      const links = [...markup.matchAll(/href="(\/mag|\/news|\/about)"/g)].map((match) => match[1])
      expect(links).toEqual(['/mag', '/news', '/about'])
      expect(markup).toContain('اخبار')
    },
  )
})
