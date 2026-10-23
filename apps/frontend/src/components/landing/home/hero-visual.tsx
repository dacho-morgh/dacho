'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, type ReactNode } from 'react'
import { HOME_EASE_OUT, HOME_REVEAL_DURATION } from './home-motion'

const HeroVisual = ({ children }: { children?: ReactNode }) => {
  const artworkRef = useRef<HTMLDivElement>(null)
  const hasEntered = useRef(false)

  useGSAP(
    () => {
      const artwork = artworkRef.current
      if (!artwork) return

      const media = gsap.matchMedia()
      media.add(
        { reduce: '(prefers-reduced-motion: reduce)', always: '(min-width: 0px)' },
        (context) => {
          if (hasEntered.current) return
          const reduce = context.conditions!.reduce

          // Keep the LCP image painted: only its decorative wrapper settles into place.
          gsap.fromTo(
            artwork,
            reduce ? { opacity: 0.85 } : { transform: 'translate3d(0, 8px, 0) scale(0.95)' },
            {
              ...(reduce ? { opacity: 1 } : { transform: 'translate3d(0, 0, 0) scale(1)' }),
              duration: reduce ? 0.2 : HOME_REVEAL_DURATION,
              ease: HOME_EASE_OUT,
              clearProps: 'opacity,transform',
              onComplete: () => {
                hasEntered.current = true
              },
            },
          )
        },
      )
      return () => media.revert()
    },
    { scope: artworkRef },
  )

  return (
    <div className="relative mx-auto flex h-[clamp(320px,47vw,600px)] w-full max-w-160 flex-1 items-center justify-center overflow-hidden rounded-[48px] lg:order-2 lg:h-[clamp(420px,47vw,600px)] lg:max-w-200 lg:rounded-[80px]">
      <div ref={artworkRef} className="flex size-full items-center justify-center">
        {children}
      </div>
    </div>
  )
}

export default HeroVisual
