'use client'

import { useEffect, useState } from 'react'
import EventCard, { type EventCardData } from './event-card'
import styles from './events-carousel.module.css'

const EventsCarousel = ({ items }: { items: EventCardData[] }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null)
  const hasNavigation = items.length > 1

  useEffect(() => {
    if (outgoingIndex === null) return

    const timeout = window.setTimeout(() => setOutgoingIndex(null), 200)
    return () => window.clearTimeout(timeout)
  }, [outgoingIndex, activeIndex])

  const navigate = (direction: -1 | 1) => {
    setOutgoingIndex(activeIndex)
    setActiveIndex((activeIndex + direction + items.length) % items.length)
  }

  const visibleIndexes =
    outgoingIndex === null || outgoingIndex === activeIndex
      ? [activeIndex]
      : [activeIndex, outgoingIndex]

  return (
    <div className="grid w-full max-w-7xl" aria-live="polite">
      {visibleIndexes.map((index) => {
        const item = items[index]
        const isActive = index === activeIndex

        return (
          <div
            key={item.id}
            aria-hidden={!isActive}
            className={`${styles.slide} ${isActive ? styles.active : styles.outgoing}`}
          >
            <EventCard
              event={item}
              hasNavigation={hasNavigation}
              onNext={() => navigate(1)}
              onPrevious={() => navigate(-1)}
            />
          </div>
        )
      })}
    </div>
  )
}

export default EventsCarousel
