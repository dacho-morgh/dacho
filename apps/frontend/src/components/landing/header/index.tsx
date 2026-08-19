'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import NavList from './nav'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const Brand = () => (
  <span className="flex h-8 w-[151px] flex-1 items-center gap-4 pr-2" dir="ltr">
    {/* eslint-disable @next/next/no-img-element */}
    <img alt="کارخانه نوآوری صنایع انرژی بوشهر" className="h-8 w-[90px] shrink-0" height={32} src="/logo/sandoq-logotype.svg" width={90} />
    <img alt="" aria-hidden="true" className="h-8 w-[37px] shrink-0" height={32} src="/logo/sandoq-logomark.svg" width={37} />
  </span>
)

const Header = () => {
  const headerRef = useRef<HTMLElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const overlayRef = useRef<HTMLButtonElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  const { contextSafe } = useGSAP(() => {
    if (pathname?.startsWith('/dashboard')) return

    const media = gsap.matchMedia()
    media.add('(min-width: 768px)', () => {
      gsap.to(headerRef.current, {
        width: '50rem',
        paddingLeft: 0,
        paddingRight: 0,
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: '+=480', scrub: 2 },
      })
    })

    gsap.set(drawerRef.current, { x: () => -(drawerRef.current?.offsetWidth || 0) })
    gsap.set(overlayRef.current, { autoAlpha: 0, pointerEvents: 'none' })
    return () => media.revert()
  }, { scope: headerRef, dependencies: [pathname] })

  const openMenu = contextSafe(() => {
    if (menuOpen) return
    setMenuOpen(true)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gsap.killTweensOf([drawerRef.current, overlayRef.current])
    gsap.timeline({ onComplete: () => closeButtonRef.current?.focus() })
      .set(overlayRef.current, { pointerEvents: 'auto' })
      .to(overlayRef.current, { autoAlpha: 1, duration: reducedMotion ? 0 : 0.2 })
      .to(drawerRef.current, { x: 0, duration: reducedMotion ? 0 : 0.45, ease: 'power3.out' }, 0)
  })

  const closeMenu = contextSafe(() => {
    if (!menuOpen) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gsap.killTweensOf([drawerRef.current, overlayRef.current])
    gsap.timeline({
      onComplete: () => {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      },
    })
      .to(drawerRef.current, { x: () => -(drawerRef.current?.offsetWidth || 0), duration: reducedMotion ? 0 : 0.35, ease: 'power3.inOut' })
      .to(overlayRef.current, { autoAlpha: 0, pointerEvents: 'none', duration: reducedMotion ? 0 : 0.2 }, reducedMotion ? 0 : '-=0.18')
  })

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMenu() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeMenu, menuOpen])

  if (pathname?.startsWith('/dashboard')) return null

  return (
    <header ref={headerRef} className="sticky top-0 z-20 mx-auto w-full max-w-7xl px-4 py-4 text-nowrap md:w-7xl md:px-0 md:py-5">
      <div className="flex h-14 items-center justify-between rounded-[20px] border border-white bg-white/20 p-2 shadow-[0px_2px_16px_0px_#0A0A0A1A] backdrop-blur supports-backdrop-filter:bg-white/60 md:h-auto md:p-2.5" dir="rtl">
      <div className="flex-1">
        <Link aria-label="صفحه اصلی" href="/"><Brand /></Link>
        </div>
        <div className="hidden md:flex"><NavList /></div>
        <div className="hidden flex-1 justify-end md:flex">
          <Link href="/dashboard"><Button className="flex h-10 w-24 justify-center font-light bg-[#3B82F6] hover:bg-[#2563EB] p-0 text-white cursor-pointer">ورود</Button></Link>
        </div>
        <button ref={menuButtonRef} aria-controls="mobile-navigation" aria-expanded={menuOpen} aria-label="باز کردن منو" className="inline-flex size-10 items-center justify-center rounded-[10px] text-black md:hidden" onClick={openMenu} type="button">
          <Menu aria-hidden="true" className="size-6" strokeWidth={1.75} />
        </button>
      </div>

      <button ref={overlayRef} aria-label="بستن منو" className="fixed inset-0 z-40 bg-black/30 opacity-0 md:hidden" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1} type="button" />

      <aside ref={drawerRef} aria-hidden={!menuOpen} className="fixed inset-y-0 left-0 z-50 flex w-[min(86vw,22rem)] flex-col bg-white p-5 shadow-2xl md:hidden" id="mobile-navigation">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-5" dir="rtl">
          <Link aria-label="صفحه اصلی" href="/" onClick={closeMenu}><Brand /></Link>
          <button ref={closeButtonRef} aria-label="بستن منو" className="inline-flex size-10 items-center justify-center rounded-[10px] text-black" onClick={closeMenu} type="button">
            <X aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </button>
        </div>
        <div className="mt-6" dir="rtl"><NavList /></div>
        <Link className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#3B82F6] px-4 text-white" href="/dashboard" onClick={closeMenu}>ورود</Link>
      </aside>
    </header>
  )
}

export default Header
