'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef, type ReactNode } from 'react'

gsap.registerPlugin(useGSAP, ScrollTrigger)

type RevealProps = {
  children: ReactNode
  /** Extra classes for the wrapper element. */
  className?: string
  /** Delay in seconds before the reveal starts. */
  delay?: number
  /** Vertical travel distance in pixels. */
  distance?: number
}

/**
 * Fades content up once it scrolls into the viewport.
 *
 * Client-side animation shell: keep data-fetching sections as Server
 * Components and pass them in as `children` — they stay out of the
 * client bundle and render on the server.
 */
const Reveal = ({ children, className, delay = 0.3, distance = 48 }: RevealProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const wrapper = wrapperRef.current
      if (!wrapper) return

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(wrapper, { clearProps: 'opacity,transform,visibility' })
        return
      }

      gsap.fromTo(
        wrapper,
        { autoAlpha: 0, y: distance },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          delay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: wrapper,
            start: 'top bottom',
            once: true,
          },
        },
      )
    },
    { scope: wrapperRef },
  )

  return (
    <div ref={wrapperRef} className={className}>
      {children}
    </div>
  )
}

export default Reveal
