'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Brand from './brand'
import NavList from './nav'
import styles from './mobile-navigation.module.css'

const mobileBreakpoint = '(max-width: 767px)'

const MobileNavigationContent = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileBreakpoint)
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) setMenuOpen(false)
    }

    mediaQuery.addEventListener('change', closeOnDesktop)
    return () => mediaQuery.removeEventListener('change', closeOnDesktop)
  }, [])

  const openMenu = () => {
    setMenuOpen(true)
    requestAnimationFrame(() => closeButtonRef.current?.focus())
  }

  const closeMenu = () => {
    setMenuOpen(false)
    requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  return (
    <div
      className={`${styles.root} absolute top-6 left-6 md:hidden`}
      data-open={menuOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !menuOpen) return
        event.stopPropagation()
        closeMenu()
      }}
    >
      <button
        ref={menuButtonRef}
        aria-controls="mobile-navigation"
        aria-expanded={menuOpen}
        aria-label="باز کردن منو"
        className="inline-flex size-10 items-center justify-center rounded-[10px] text-black"
        onClick={openMenu}
        type="button"
      >
        <Menu aria-hidden="true" className="size-6" strokeWidth={1.75} />
      </button>

      <button
        aria-label="بستن منو"
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 motion-reduce:transition-none ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeMenu}
        tabIndex={menuOpen ? 0 : -1}
        type="button"
      />

      <aside
        aria-hidden={!menuOpen}
        aria-modal={menuOpen ? 'true' : undefined}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,22rem)] flex-col bg-white p-5 shadow-2xl transition-transform duration-[450ms] ease-out motion-reduce:transition-none ${
          menuOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
        id="mobile-navigation"
        inert={!menuOpen}
        role="dialog"
      >
        <div
          className="flex items-center justify-between border-b border-neutral-200 pb-5"
          dir="rtl"
        >
          <Link aria-label="صفحه اصلی" href="/" onClick={closeMenu}>
            <Brand />
          </Link>
          <button
            ref={closeButtonRef}
            aria-label="بستن منو"
            className="inline-flex size-10 items-center justify-center rounded-[10px] text-black"
            onClick={closeMenu}
            type="button"
          >
            <X aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </button>
        </div>
        <div className="mt-6" dir="rtl">
          <NavList onNavigate={closeMenu} />
        </div>
        <Link
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-white"
          href="/login"
          onClick={closeMenu}
        >
          ورود
        </Link>
      </aside>
    </div>
  )
}

const MobileNavigation = () => {
  const pathname = usePathname()

  return <MobileNavigationContent key={pathname} />
}

export default MobileNavigation
