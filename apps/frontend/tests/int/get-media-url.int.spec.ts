import { describe, expect, it } from 'vitest'
import { getMediaUrl } from '@/utilities/getMediaUrl'

describe('getMediaUrl', () => {
  it('turns an absolute Payload media URL into a same-origin path', () => {
    expect(
      getMediaUrl('http://localhost:3000/api/media/file/hero.webp', '2026-09-13T13:39:17.879Z'),
    ).toBe('/api/media/file/hero.webp?2026-09-13T13%3A39%3A17.879Z')
  })

  it('keeps an external CDN URL absolute', () => {
    expect(getMediaUrl('https://cdn.example.com/assets/hero.webp')).toBe(
      'https://cdn.example.com/assets/hero.webp',
    )
  })
})
