'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import Brand from './brand'
import MobileNavigation from './mobile-navigation'
import NavList from './nav'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const Header = () => {
  const headerRef = useRef<HTMLElement>(null)
  const headerSurfaceRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useGSAP(
    () => {
      if (pathname?.startsWith('/dashboard')) return
      if (typeof window === 'undefined') return

      const media = gsap.matchMedia()
      media.add('(min-width: 768px)', () => {
        gsap.to(headerRef.current, {
          maxWidth: '50rem',
          paddingLeft: 0,
          paddingRight: 0,
          ease: 'none',
          scrollTrigger: { trigger: document.body, start: 'top top', end: '+=480', scrub: 2 },
        })
      })

      gsap.fromTo(
        headerSurfaceRef.current,
        {
          backdropFilter: 'blur(0px)',
          backgroundColor: 'rgba(255, 255, 255, 0)',
          borderColor: 'rgba(255, 255, 255, 0)',
          boxShadow: '0 2px 16px rgb(10 10 10 / 0)',
          webkitBackdropFilter: 'blur(0px)',
        },
        {
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          borderColor: 'rgba(255, 255, 255, 1)',
          boxShadow: '0 2px 16px rgb(10 10 10 / 0.1)',
          ease: 'none',
          scrollTrigger: { trigger: document.body, start: 'top top', end: '+=160', scrub: 1 },
          webkitBackdropFilter: 'blur(8px)',
        },
      )

      return () => media.revert()
    },
    { scope: headerRef, dependencies: [pathname], revertOnUpdate: true },
  )

  useEffect(() => {
    if (pathname?.startsWith('/dashboard') || !headerRef.current) return

    ScrollTrigger.refresh()
    gsap.set(headerRef.current, { clearProps: 'maxWidth,paddingLeft,paddingRight' })
  }, [pathname])

  if (pathname?.startsWith('/dashboard')) return null

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-[100] mx-auto w-full max-w-[1600px] px-4 py-4 text-nowrap md:py-5 lg:px-10"
    >
      <div
        ref={headerSurfaceRef}
        className="flex h-14 items-center justify-between rounded-[20px] border border-white/0 bg-white/0 p-2 md:h-auto md:p-2.5"
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
