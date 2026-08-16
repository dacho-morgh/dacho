'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import CommentCard, { type CommentCardData } from './comment-card'

const PIXELS_PER_SECOND = 60

type Review = CommentCardData & { id: string | number }

const CommentsSlideshow = ({ reviews }: { reviews: Review[] }) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState<number>(30)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const fullWidth = track.scrollWidth
      const contentWidth = fullWidth / 2
      const next = contentWidth / PIXELS_PER_SECOND
      setDuration(next)
    }

    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(track)
    window.addEventListener('resize', measure)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <div dir="ltr" className="comments-slideshow w-full overflow-hidden">
      <div
        ref={trackRef}
        className="comments-slideshow-track flex w-max"
        style={{ '--comments-duration': `${duration}s` } as CSSProperties}
      >
        {[0, 1].map((setIndex) => (
          <div
            key={setIndex}
            aria-hidden={setIndex === 1}
            className="flex shrink-0 gap-4 py-2 ps-4"
          >
            {reviews.map((review) => (
              <div
                key={`${setIndex}-${review.id}`}
                className="w-[calc((100vw-48px)/1.15)] shrink-0 sm:w-[calc((100vw-64px)/2)] lg:w-[calc((100vw-48px)/3.2)] xl:w-100"
              >
                <CommentCard comment={review} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default CommentsSlideshow
