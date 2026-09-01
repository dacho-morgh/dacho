'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/utilities/ui'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const HEADING_TOP = 96
const HEADING_TO_STACK_GAP = 24
const STACK_OFFSET = 16

type ServicesScrollStackProps = {
  children: ReactNode
  equalCardHeights?: boolean
  heading: ReactNode
  headingClassName?: string
}

export default function ServicesScrollStack({
  children,
  equalCardHeights = false,
  heading,
  headingClassName,
}: ServicesScrollStackProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const container = containerRef.current
      const headingElement = headingRef.current
      const stack = stackRef.current
      if (!container || !headingElement || !stack) return

      const cards = gsap.utils.toArray<HTMLElement>('[data-service-card]', stack)
      if (cards.length < 2) return

      const syncCardHeights = () => {
        if (!equalCardHeights) return

        gsap.set(cards, { height: 'auto' })
        const tallestCardHeight = Math.max(...cards.map((card) => card.offsetHeight))
        gsap.set(cards, { height: tallestCardHeight })
      }

      syncCardHeights()
      ScrollTrigger.addEventListener('refreshInit', syncCardHeights)

      let isActive = true
      void document.fonts.ready.then(() => {
        if (isActive) ScrollTrigger.refresh()
      })

      const media = gsap.matchMedia()

      media.add('(prefers-reduced-motion: no-preference)', () => {
        const getStackTop = () => HEADING_TOP + headingElement.offsetHeight + HEADING_TO_STACK_GAP

        const headingTrigger = ScrollTrigger.create({
          anticipatePin: 1,
          end: 'bottom bottom',
          endTrigger: stack,
          invalidateOnRefresh: true,
          pin: headingElement,
          pinSpacing: false,
          start: `top ${HEADING_TOP}px`,
          trigger: headingElement,
        })

        const pinTriggers = cards.map((card, index) =>
          ScrollTrigger.create({
            anticipatePin: 1,
            end: 'bottom bottom',
            endTrigger: stack,
            invalidateOnRefresh: true,
            pin: card,
            pinSpacing: false,
            start: () => `top ${getStackTop() + index * STACK_OFFSET}px`,
            trigger: card,
          }),
        )

        const tweens = cards.slice(0, -1).map((card, index) =>
          gsap.to(card, {
            ease: 'none',
            scale: 0.98,
            scrollTrigger: {
              end: () => `top ${getStackTop() + (index + 1) * STACK_OFFSET}px`,
              scrub: 0.6,
              start: 'top 70%',
              trigger: cards[index + 1],
            },
          }),
        )

        return () => {
          headingTrigger.kill()
          tweens.forEach((tween) => tween.kill())
          pinTriggers.forEach((trigger) => trigger.kill())
        }
      })

      return () => {
        isActive = false
        ScrollTrigger.removeEventListener('refreshInit', syncCardHeights)
        media.revert()
        if (equalCardHeights) gsap.set(cards, { clearProps: 'height' })
      }
    },
    { dependencies: [equalCardHeights], scope: containerRef },
  )

  return (
    <div ref={containerRef} className="flex flex-col gap-10">
      <div
        ref={headingRef}
        className={cn('relative z-50 flex justify-start bg-neutral-50', headingClassName)}
      >
        {heading}
      </div>
      <div ref={stackRef} className="relative flex flex-col items-center gap-12 pb-[40vh]">
        {children}
      </div>
    </div>
  )
}
