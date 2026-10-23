'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, useState } from 'react'
import EventCard, { type EventCardData } from './event-card'
import { HOME_EASE_OUT } from './home-motion'

const EventsCarousel = ({ items }: { items: EventCardData[] }) => {
  const scope = useRef<HTMLDivElement>(null)
  const instant = useRef(true)
  const transitionId = useRef(0)
  const keyboardControl = useRef<string | null>(null)
  const seen = useRef(new WeakSet<Element>())
  const [activeIndex, setActiveIndex] = useState(0)
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null)
  const hasNavigation = items.length > 1

  useGSAP(
    () => {
      const root = scope.current
      if (!root) return
      const active = root.querySelector('[data-active="true"]')
      const outgoing = root.querySelector('[data-active="false"]')
      const currentTransition = transitionId.current
      if (!active) return
      if (instant.current && keyboardControl.current) {
        const control = Array.from(active.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => button.getAttribute('aria-label') === keyboardControl.current,
        )
        control?.focus({ preventScroll: true })
      }
      if (!seen.current.has(active)) {
        gsap.set(active, { opacity: instant.current ? 1 : 0 })
        seen.current.add(active)
      }
      const duration = instant.current
        ? 0
        : window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0.15
          : 0.2

      // Retarget existing opacity values when navigation reverses before the fade finishes.
      gsap.to(active, { opacity: 1, duration, ease: HOME_EASE_OUT, overwrite: 'auto' })
      if (outgoing) {
        gsap.to(outgoing, {
          opacity: 0,
          duration,
          ease: HOME_EASE_OUT,
          overwrite: 'auto',
          onComplete: () => {
            if (transitionId.current === currentTransition) setOutgoingIndex(null)
          },
        })
      }
    },
    { scope, dependencies: [activeIndex] },
  )

  const navigate = (direction: -1 | 1) => {
    transitionId.current += 1
    setOutgoingIndex(activeIndex)
    setActiveIndex((activeIndex + direction + items.length) % items.length)
  }

  const visibleIndexes =
    outgoingIndex === null || outgoingIndex === activeIndex
      ? [activeIndex]
      : [activeIndex, outgoingIndex]

  return (
    <div
      ref={scope}
      className="grid w-full max-w-7xl"
      aria-live="polite"
      onClickCapture={(event) => {
        instant.current = event.detail === 0
        keyboardControl.current =
          event.target instanceof Element
            ? (event.target.closest('button')?.getAttribute('aria-label') ?? null)
            : null
      }}
    >
      {visibleIndexes.map((index) => {
        const item = items[index]
        const isActive = index === activeIndex

        return (
          <div
            key={item.id}
            data-active={isActive}
            aria-hidden={!isActive}
            inert={!isActive}
            className={`relative col-start-1 row-start-1 ${isActive ? 'z-10' : 'pointer-events-none z-20'}`}
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
