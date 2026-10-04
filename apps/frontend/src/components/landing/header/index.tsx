'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import Brand from './brand'
import MobileNavigation from './mobile-navigation'
import NavList from './nav'

const Header = () => {
  const headerRef = useRef<HTMLElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    if (pathname?.startsWith('/dashboard') || window.matchMedia('(max-width: 767px)').matches)
      return

    let cancelled = false
    let cleanup = () => {}
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ default: gsap }, { ScrollTrigger }]) => {
        if (cancelled || !headerRef.current) return
        gsap.registerPlugin(ScrollTrigger)
        const media = gsap.matchMedia()
        media.add('(min-width: 768px)', () => {
          gsap.to(headerRef.current, {
            maxWidth: '50rem',
            paddingLeft: 0,
            paddingRight: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: document.body,
              scroller: window,
              start: 'top top',
              end: '+=480',
              scrub: 2,
            },
          })
          ScrollTrigger.refresh()
          return () => {
            gsap.set(headerRef.current, { clearProps: 'maxWidth,paddingLeft,paddingRight' })
          }
        })
        cleanup = () => media.revert()
      },
    )

    return () => {
      cancelled = true
      cleanup()
    }
  }, [pathname])

  if (pathname?.startsWith('/dashboard')) return null

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-20 mx-auto w-full max-w-7xl px-4 py-4 text-nowrap md:px-0 md:py-5"
    >
      <div
        className="flex h-14 items-center justify-between rounded-[20px] border border-white bg-white/20 p-2 shadow-[0_2px_16px_rgb(10_10_10/0.1)] backdrop-blur supports-backdrop-filter:bg-white/60 md:h-auto md:p-2.5"
        dir="rtl"
      >
        <div className="flex-1">
          <Link aria-label="صفحه اصلی" href="/">
            <Brand />
          </Link>
        </div>
        <div className="hidden md:flex">
          <NavList />
        </div>
        <div className="hidden flex-1 justify-end md:flex">
          <Link href="/login">
            <Button size="40" className="w-20 font-[325]!">
              ورود
            </Button>
          </Link>
        </div>
      </div>
      <MobileNavigation />
    </header>
  )
}

export default Header
