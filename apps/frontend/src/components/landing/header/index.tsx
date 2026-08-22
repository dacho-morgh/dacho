'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import Brand from './brand'
import MobileNavigation from './mobile-navigation'
import NavList from './nav'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const Header = () => {
  const headerRef = useRef<HTMLElement>(null)
  const pathname = usePathname()

  useGSAP(
    () => {
      if (pathname?.startsWith('/dashboard')) return

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

      return () => media.revert()
    },
    { scope: headerRef, dependencies: [pathname], revertOnUpdate: true },
  )

  if (pathname?.startsWith('/dashboard')) return null

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 mx-auto w-full max-w-7xl px-4 py-4 text-nowrap md:px-0 md:py-5"
    >
      <div
        className="flex h-14 items-center justify-between rounded-[20px] border border-white bg-white/20 p-2 shadow-[0px_2px_16px_0px_#0A0A0A1A] backdrop-blur supports-backdrop-filter:bg-white/60 md:h-auto md:p-2.5"
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
          <Link href="/dashboard">
            <Button className="flex h-10 w-24 cursor-pointer justify-center bg-[#3B82F6] p-0 font-light text-white hover:bg-[#2563EB]">
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
