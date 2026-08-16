'use client'
import { useState } from 'react'

const navItems = [
  { label: 'خانه', href: '/' },
  { label: 'رویداد ها', href: '/events' },
  { label: 'اخبار', href: '/news' },
  { label: 'درباره ما', href: '/about' },
  { label: 'تماس با ما', href: '/connect' },
]

const NavList = () => {
  const [active, setActive] = useState('/')
  return (
    <nav className="nav-pill flex flex-1 items-center gap-1 text-black">
      {navItems.map(({ label, href }) => (
        <button
          key={href}
          data-active={active === href ? 'true' : 'false'}
          onClick={() => setActive(href)}
          className="px-0.5"
        >
          <span className="pointer-events-none relative z-20 block rounded-[10px] px-2 py-1.5">
            {label}
          </span>
        </button>
      ))}
    </nav>
  )
}

export default NavList
