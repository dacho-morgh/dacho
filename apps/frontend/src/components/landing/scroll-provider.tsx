'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollSmoother)

export default function ScrollProvider() {
  useGSAP(() => {
    const smoother = ScrollSmoother.create({
      smooth: 1.2,
      effects: true,
      smoothTouch: 0.1,
    })

    return () => {
      smoother.kill()
    }
  })

  return null
}
