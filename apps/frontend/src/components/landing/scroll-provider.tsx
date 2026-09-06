'use client'

import { useEffect } from 'react'

export default function ScrollProvider() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(max-width: 768px)').matches) return

    let smoother: { kill: () => void } | null = null

    Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/ScrollSmoother')]).then(
      ([{ default: gsap }, { ScrollTrigger }, { ScrollSmoother }]) => {
        gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
        smoother = ScrollSmoother.create({
          smooth: 1.2,
          effects: true,
          smoothTouch: 0.1,
        })
      },
    )

    return () => {
      smoother?.kill()
    }
  }, [])

  return null
}
