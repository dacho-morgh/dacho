'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import NavList from './nav'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const Header = () => {
  const headerRef = useRef<HTMLElement>(null)

  useGSAP(() => {
    gsap.to(headerRef.current, {
      width: '50rem',
      paddingLeft: 0,
      paddingRight: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: '+=480', // ~30rem
        scrub: 2,
      },
    })
  })

  return (
    <header ref={headerRef} className="sticky top-0 z-20 mx-auto w-7xl max-w-7xl py-5 text-nowrap">
      <div className="flex items-center justify-between rounded-[20px] border border-white bg-white/20 p-2.5 shadow-[0px_2px_16px_0px_#0A0A0A1A] backdrop-blur supports-backdrop-filter:bg-white/60">
        <div className="flex flex-1 items-center gap-2.5">
          <div className="size-6 rounded-lg bg-[#2563EB]" />
          <h1 className="text-2xl font-bold text-[#2563EB]">نام صندوق</h1>
        </div>

        <NavList />

        <div className="flex flex-1 justify-end">
          <Button className="flex h-10 w-20 justify-center bg-[#3B82F6] p-0 text-white">
            ورود
          </Button>
        </div>
      </div>
    </header>
  )
}

export default Header
