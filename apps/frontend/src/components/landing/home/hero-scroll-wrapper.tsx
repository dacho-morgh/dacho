'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef, type ReactNode } from 'react'

gsap.registerPlugin(useGSAP, ScrollTrigger)

export default function HeroScrollWrapper({ children }: { children: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      if (typeof window === 'undefined' || window.matchMedia('(max-width: 1023px)').matches) return
      const section = sectionRef.current
      if (!section) return

      const media = gsap.matchMedia()

      media.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.to(section, {
          paddingLeft: 'clamp(1rem, 6vw, 6rem)',
          paddingRight: 'clamp(1rem, 6vw, 6rem)',
          ease: 'none',
          scrollTrigger: {
            trigger: document.body,
            start: 'top top',
            end: '+=480',
            scrub: 2,
          },
        })
      })

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      className="relative mx-auto w-full max-w-[1600px] overflow-hidden pt-25 lg:will-change-[padding-left,padding-right] lg:h-200 lg:pt-0"
    >
      {children}
    </section>
  )
}
