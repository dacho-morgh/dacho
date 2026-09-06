'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Typography } from '@/components/ui/typography'

const navItems = [
  { label: 'خانه', href: '/' },
  { label: 'رویداد ها', href: '/events' },
  { label: 'اخبار', href: '/news' },
  { label: 'درباره ما', href: '/about' },
  { label: 'تماس با ما', href: '/connect' },
]

interface NavListProps {
  onNavigate?: () => void
}

const NavList = ({ onNavigate }: NavListProps) => {
  const pathname = usePathname()

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="nav-pill flex flex-1 flex-col gap-1 text-black md:flex-row md:items-center"
    >
      {navItems.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
              ? 'page'
              : undefined
          }
          data-active={
            pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
              ? 'true'
              : 'false'
          }
          className="cursor-pointer self-start px-0.5 md:self-auto"
          onClick={onNavigate}
        >
          <Typography
            as="span"
            variant="14/regular"
            color="neutral-700"
            className="pointer-events-none relative z-20 block rounded-[10px] px-2 py-1.5"
          >
            {label}
          </Typography>
        </Link>
      ))}
    </nav>
  )
}

export default NavList
