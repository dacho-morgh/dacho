'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, type ReactNode } from 'react'
import { HOME_EASE_OUT, HOME_REVEAL_DURATION, HOME_STAGGER } from './home-motion'

export default function HeroScrollWrapper({ children }: { children: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add(
        { reduce: '(prefers-reduced-motion: reduce)', always: '(min-width: 0px)' },
        (context) => {
          const reduce = context.conditions!.reduce
          // The headline and hero image stay visible for the initial paint.
          gsap.from('[data-hero-enter]', {
            opacity: 0.65,
            ...(reduce ? {} : { transform: 'translate3d(0, 8px, 0)' }),
            duration: reduce ? 0.2 : HOME_REVEAL_DURATION,
            stagger: reduce ? 0 : HOME_STAGGER,
            ease: HOME_EASE_OUT,
            clearProps: 'opacity,transform',
          })
        },
      )
      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      className="relative mx-auto w-full max-w-[1600px] overflow-hidden pt-25 lg:h-200 lg:pt-0"
    >
      {children}
    </section>
  )
}
