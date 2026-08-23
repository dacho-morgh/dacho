import Link from 'next/link'
import React from 'react'
import { Typography } from '@/components/ui/typography'
import { buildSafe } from '@/utilities/buildSafe'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { cn } from '@/utilities/ui'

type FooterLink = {
  label: string
  href: string
}

const SERVICES_FALLBACK: FooterLink[] = [
  { label: 'خدمات تامین مالی', href: '#' },
  { label: 'خدمات دانش بنیان', href: '#' },
  { label: 'خدمات تجاری سازی و ورود به صنعت و بازار', href: '#' },
]

const PAGES_FALLBACK: FooterLink[] = [
  { label: 'خانه', href: '/' },
  { label: 'رویداد ها و همایش ها', href: '/events' },
  { label: 'اخبار', href: '/news' },
  { label: 'درباره ما', href: '/about' },
  { label: 'تماس با ما', href: '/connect' },
]

const DESCRIPTION_FALLBACK =
  'مکان محصول فلسفه توانبخشی ستون نامفهوم محیط هدف داده مجله توسعه برنامه‌نویسی یکپارچگی طبیعت روانشناسی'
const ADDRESS_FALLBACK = 'بوشهر، بهمنی، خیابان ماهینی، سه راه دانشجو...'
const PHONE_FALLBACK = '077 - 1234 56 78  , 077 - 1234 78 98'
const COPYRIGHT_FALLBACK = '© تمامی حقوق این سایت مربوط به شرکت صندوق کارآفرینی بوشهر می‌باشد.'

function NavColumn({
  heading,
  links,
  className,
}: {
  heading: string
  links: FooterLink[]
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-4', className)}>
      <Typography color="white" variant="20/bold">
        {heading}
      </Typography>
      <ul className="flex flex-col gap-2">
        {links.map((link, i) => (
          <li key={`${link.label}-${i}`}>
            <Link href={link.href} className="inline-block rounded-[10px]">
              <Typography color="white" variant="16/regular">
                {link.label}
              </Typography>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ContactRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" height={24} src={icon} width={24} />
      <Typography className="min-w-0 flex-1" color="neutral-400" variant="16/regular">
        {text}
      </Typography>
    </div>
  )
}

export async function Footer() {
  const footerData = await buildSafe('footer global', () => getCachedGlobal('footer', 1)())

  // Map CMS navItems to the «صفحات» column with static Figma fallbacks.
  const cmsItems: FooterLink[] = Array.isArray(footerData?.navItems)
    ? footerData.navItems.map((item: { link?: { url?: string | null; label?: string } }) => ({
        label: item?.link?.label || '',
        href: item?.link?.url || '#',
      }))
    : []

  const pages = cmsItems.length > 0 ? cmsItems : PAGES_FALLBACK

  return (
    <footer className="bg-neutral-800 py-12 lg:py-30">
      <div className="container flex flex-col gap-10 px-4 lg:px-8 xl:px-0">
        {/* Band A — columns row. DOM order (RTL): خدمات rightmost, then صفحات, then brand/contact leftmost.
            On <lg we stack brand first, then صفحات, then خدمات via order utilities. */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-20">
          <div className="order-first flex min-w-0 flex-1 flex-col gap-10 lg:order-0">
            {/* Brand block */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-auto"
                  height={32}
                  src="/logo/sandoq-logomark.svg"
                  width={37}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="صندوق"
                  className="h-8 w-auto"
                  height={32}
                  src="/logo/sandoq-logotype.svg"
                  width={90}
                />
              </div>
              <Typography color="neutral-400" variant="16/regular">
                {DESCRIPTION_FALLBACK}
              </Typography>
            </div>

            {/* Contact block */}
            <div className="flex flex-col gap-6">
              <ContactRow icon="/icons/footer/icon-location.svg" text={ADDRESS_FALLBACK} />
              <ContactRow icon="/icons/footer/icon-call.svg" text={PHONE_FALLBACK} />
            </div>
          </div>
          <NavColumn className="order-2 lg:order-0" heading="صفحات" links={pages} />
          <NavColumn className="order-3 lg:order-0" heading="خدمات" links={SERVICES_FALLBACK} />
        </div>

        {/* Band B — divider */}
        <div aria-hidden="true" className="border-t-[1.5px] border-neutral-700" />

        {/* Band C — bottom bar. RTL: social icons render right, copyright left. */}
        <div className="flex items-center justify-between gap-4 max-lg:flex-col-reverse max-lg:items-start">
          <Typography
            className="text-center lg:whitespace-nowrap"
            color="neutral-400"
            variant="14/light"
          >
            {COPYRIGHT_FALLBACK}
          </Typography>
          <div className="flex items-center gap-4">
            {[0, 1, 2].map((i) => (
              <a href="#" key={i} aria-label="شبکه اجتماعی (نماد موقت)">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  aria-hidden="true"
                  height={32}
                  src="/icons/footer/icon-house2.svg"
                  width={32}
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
