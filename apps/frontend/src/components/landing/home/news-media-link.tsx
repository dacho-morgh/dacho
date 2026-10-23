'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import Link from 'next/link'
import { useRef, type ComponentProps } from 'react'
import { HOME_EASE_OUT } from './home-motion'

/** The same card is used on news and magazine pages, so keep its feedback self-contained. */
export default function NewsMediaLink(props: Omit<ComponentProps<typeof Link>, 'ref'>) {
  const linkRef = useRef<HTMLAnchorElement>(null)

  useGSAP(
    (_context, contextSafe) => {
      const link = linkRef.current
      const image = link?.querySelector('img')
      if (!link || !image || !contextSafe) return

      const media = gsap.matchMedia()
      media.add(
        '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
        () => {
          const enter = contextSafe(() => {
            gsap.to(image, { scale: 1.03, duration: 0.16, ease: HOME_EASE_OUT, overwrite: 'auto' })
          })
          const leave = contextSafe(() => {
            gsap.to(image, {
              scale: 1,
              duration: 0.16,
              ease: HOME_EASE_OUT,
              overwrite: 'auto',
              clearProps: 'transform',
            })
          })
          link.addEventListener('pointerenter', enter)
          link.addEventListener('pointerleave', leave)
          return () => {
            link.removeEventListener('pointerenter', enter)
            link.removeEventListener('pointerleave', leave)
            gsap.killTweensOf(image)
            gsap.set(image, { clearProps: 'transform' })
          }
        },
      )
      return () => media.revert()
    },
    { scope: linkRef },
  )

  return <Link ref={linkRef} {...props} />
}
