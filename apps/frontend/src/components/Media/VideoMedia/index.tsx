'use client'

import React, { useEffect, useRef } from 'react'
import type { Props as MediaProps } from '@/components/Media/types'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { cn } from '@/utilities/ui'

export const VideoMedia: React.FC<MediaProps> = (props) => {
  const { onClick, resource, videoClassName } = props

  const videoRef = useRef<HTMLVideoElement>(null)
  // const [showFallback] = useState<boolean>()

  useEffect(() => {
    const { current: video } = videoRef
    if (video) {
      video.addEventListener('suspend', () => {
        // setShowFallback(true);
        // console.warn('Video was suspended, rendering fallback image.')
      })
    }
  }, [])

  if (resource && typeof resource === 'object') {
    const { filename, mimeType, updatedAt, url } = resource
    const src = getMediaUrl(url || (filename ? `/api/media/file/${filename}` : null), updatedAt)

    if (!src) return null

    return (
      <video
        autoPlay
        className={cn(videoClassName)}
        controls
        loop
        muted
        onClick={onClick}
        playsInline
        ref={videoRef}
      >
        <source src={src} type={mimeType || undefined} />
      </video>
    )
  }

  return null
}
