// @vitest-environment jsdom

import type { Media } from '@dacho/cms-core'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { VideoMedia } from '@/components/Media/VideoMedia'

describe('VideoMedia', () => {
  it('uses the URL returned by Payload for uploaded videos', () => {
    const resource = {
      id: 24,
      filename: 'test.mp4',
      mimeType: 'video/mp4',
      url: 'http://localhost:3000/api/media/file/test.mp4',
      updatedAt: '2026-09-13T21:51:40.503Z',
      createdAt: '2026-09-13T21:51:40.503Z',
    } as Media

    const { container } = render(createElement(VideoMedia, { resource }))
    const video = container.querySelector('video')

    expect(container.querySelector('source')?.getAttribute('src')).toBe(
      '/api/media/file/test.mp4?2026-09-13T21%3A51%3A40.503Z',
    )
    expect(video?.controls).toBe(true)
  })
})
