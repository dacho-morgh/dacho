'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/utilities/ui'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const HEADING_TOP = 96
const MOBILE_HEADING_TOP = 96
const HEADING_TO_STACK_GAP = 24
const STACK_OFFSET = 16

type ServicesScrollStackProps = {
  children: ReactNode
  equalCardHeights?: boolean
  heading: ReactNode
  headingClassName?: string
  pinHeading?: boolean
}

export default function ServicesScrollStack({
  children,
  equalCardHeights = true,
  heading,
  headingClassName,
  pinHeading = true,
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

      const media = gsap.matchMedia()

      const setupStack = (isMobile: boolean) => {
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

        const getHeadingTop = () => (isMobile ? MOBILE_HEADING_TOP : HEADING_TOP)
        const getStackOffset = () => (isMobile ? 0 : STACK_OFFSET)
        const getStackTop = () =>
          getHeadingTop() + (pinHeading ? headingElement.offsetHeight : 0) + HEADING_TO_STACK_GAP

        const headingTrigger = pinHeading
          ? ScrollTrigger.create({
              anticipatePin: 1,
              end: 'bottom bottom',
              endTrigger: stack,
              invalidateOnRefresh: true,
              pin: headingElement,
              pinSpacing: false,
              start: () => `top ${getHeadingTop()}px`,
              trigger: headingElement,
            })
          : null

        const pinTriggers = cards.map((card, index) =>
          ScrollTrigger.create({
            anticipatePin: 1,
            end: 'bottom bottom',
            endTrigger: stack,
            invalidateOnRefresh: true,
            pin: card,
            pinSpacing: false,
            start: () => {
              const top = getStackTop() + index * getStackOffset()
              return isMobile && card.offsetHeight + top > window.innerHeight
                ? 'bottom bottom'
                : `top ${top}px`
            },
            trigger: card,
          }),
        )

        const tweens = isMobile
          ? []
          : cards.slice(0, -1).map((card, index) =>
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
          isActive = false
          ScrollTrigger.removeEventListener('refreshInit', syncCardHeights)
          headingTrigger?.kill()
          tweens.forEach((tween) => tween.kill())
          pinTriggers.forEach((trigger) => trigger.kill())
          gsap.set(cards, { clearProps: 'height,transform' })
        }
      }

      media.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () =>
        setupStack(false),
      )
      media.add('(max-width: 1023px) and (prefers-reduced-motion: no-preference)', () =>
        setupStack(true),
      )

      return () => media.revert()
    },
    { dependencies: [equalCardHeights, pinHeading], scope: containerRef },
  )

  return (
    <div ref={containerRef} className="flex flex-col gap-10">
      <div
        ref={headingRef}
        className={cn('relative z-50 flex justify-start bg-neutral-50', headingClassName)}
      >
        {heading}
      </div>
      <div
        ref={stackRef}
        className="relative flex flex-col items-center gap-6 lg:gap-12 lg:pb-[20vh]"
      >
        {children}
      </div>
    </div>
  )
}
