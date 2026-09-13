import Link from 'next/link'
import React from 'react'
import {
  BrandFooterSandoqLogotype,
  BrandFooterSandoqLogomark,
  FooterCallIcon,
  FooterHouseIcon,
  FooterLocationIcon,
} from '@/components/icons'
import { Media } from '@/components/Media'
import { Typography } from '@/components/ui/typography'
import { buildSafe } from '@/utilities/buildSafe'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { cn } from '@/utilities/ui'

type FooterLinkItem = {
  label: string
  href: string
  newTab?: boolean
}

type ColumnData = {
  title: string
  links: FooterLinkItem[]
}

const SERVICES_FALLBACK: FooterLinkItem[] = [
  { label: 'خدمات تامین مالی', href: '/' },
  { label: 'خدمات دانش بنیان', href: '/' },
  { label: 'خدمات تجاری سازی و ورود به صنعت و بازار', href: '/' },
]

const PAGES_FALLBACK: FooterLinkItem[] = [
  { label: 'خانه', href: '/' },
  { label: 'رویداد ها و همایش ها', href: '#events' },
  { label: 'اخبار', href: '/news' },
  { label: 'درباره ما', href: '/about' },
  { label: 'تماس با ما', href: '/connect' },
]

const DESCRIPTION_FALLBACK =
  'مکان محصول فلسفه توانبخشی ستون نامفهوم محیط هدف داده مجله توسعه برنامه‌نویسی یکپارچگی طبیعت روانشناسی'
const ADDRESS_FALLBACK = 'بوشهر، بهمنی، خیابان ماهینی، سه راه دانشجو...'
const PHONE_FALLBACK = '077 - 1234 56 78  , 077 - 1234 78 98'
const COPYRIGHT_FALLBACK = '© تمامی حقوق این سایت مربوط به کارخانه نوآوری صنایع انرژی بوشهر می‌باشد.'

function formatHref(link?: {
  type?: ('reference' | 'custom') | null
  reference?: {
    relationTo?: string | null
    value?: unknown
  } | null
  url?: string | null
}): string {
  if (!link) return '/'
  if (link.type === 'reference' && link.reference?.value) {
    const val = link.reference.value
    if (
      typeof val === 'object' &&
      val !== null &&
      'slug' in val &&
      typeof (val as { slug?: unknown }).slug === 'string'
    ) {
      const slug = (val as { slug: string }).slug
      const relationTo = link.reference.relationTo
      if (relationTo === 'pages') {
        return slug === 'home' ? '/' : `/${slug}`
      }
      return relationTo ? `/${relationTo}/${slug}` : `/${slug}`
    }
  }
  const rawUrl = link.url?.trim()
  if (!rawUrl || rawUrl === '#') {
    return '/'
  }
  return rawUrl
}

function mapNavItems(
  items?:
    | {
        link?: {
          type?: ('reference' | 'custom') | null
          newTab?: boolean | null
          reference?: {
            relationTo?: string | null
            value?: unknown
          } | null
          url?: string | null
          label?: string | null
        }
      }[]
    | null,
): FooterLinkItem[] {
  if (!items || !Array.isArray(items)) return []
  return items
    .filter((item): item is typeof item & { link: { label: string } } => Boolean(item?.link?.label))
    .map((item) => ({
      label: item.link.label,
      href: formatHref(item.link),
      newTab: Boolean(item.link.newTab),
    }))
}

function NavColumn({
  heading,
  links,
  className,
}: {
  heading: string
  links: FooterLinkItem[]
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-4', className)}>
      <Typography as="h3" color="white" variant="20/bold">
        {heading}
      </Typography>
      <ul className="flex flex-col gap-2">
        {links.map((link, i) => (
          <li key={`${link.label}-${i}`}>
            <Link
              href={link.href}
              className="inline-block rounded-[10px]"
              {...(link.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
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

function SocialLinkItem({
  href,
  ariaLabel,
  children,
}: {
  href: string
  ariaLabel: string
  children: React.ReactNode
}) {
  const isInternal = href.startsWith('/')
  const className =
    'flex size-8 items-center justify-center text-neutral-400 transition-colors hover:text-white'

  if (isInternal) {
    return (
      <Link aria-label={ariaLabel} className={className} href={href}>
        {children}
      </Link>
    )
  }

  return (
    <a
      aria-label={ariaLabel}
      className={className}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  )
}

function ContactRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <Typography className="min-w-0 flex-1" color="neutral-400" variant="16/regular">
        {text}
      </Typography>
    </div>
  )
}

export async function Footer() {
  const footerData = await buildSafe('footer global', () => getCachedGlobal('footer', 1)())

  const logo = footerData?.logo
  const logoText = footerData?.logoText || 'صندوق'
  const description = footerData?.description || DESCRIPTION_FALLBACK
  const address = footerData?.address || ADDRESS_FALLBACK
  const phone = footerData?.phone || PHONE_FALLBACK
  const copyright = footerData?.copyright || COPYRIGHT_FALLBACK
  const socialLinks =
    Array.isArray(footerData?.socialLinks) && footerData.socialLinks.length > 0
      ? footerData.socialLinks
      : null

  let columns: ColumnData[] = []
  if (Array.isArray(footerData?.columns) && footerData.columns.length > 0) {
    columns = footerData.columns
      .filter((col) => Boolean(col?.title))
      .map((col) => ({
        title: col.title,
        links: mapNavItems(col.navItems),
      }))
  }

  if (columns.length === 0) {
    const legacyNav = mapNavItems(footerData?.navItems)
    columns = [
      {
        title: 'صفحات',
        links: legacyNav.length > 0 ? legacyNav : PAGES_FALLBACK,
      },
      {
        title: 'خدمات',
        links: SERVICES_FALLBACK,
      },
    ]
  }

  return (
    <footer className="bg-neutral-800 py-12 lg:py-20">
      <div className="container flex flex-col gap-6 px-4 lg:px-8 xl:px-0">
        {/* Band A — columns row. DOM order (RTL): خدمات rightmost, then صفحات, then brand/contact leftmost.
            On <lg we stack brand first, then صفحات, then خدمات via order utilities. */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-20">
          <div className="order-first flex min-w-0 flex-1 flex-col gap-10 lg:order-0">
            {/* Brand block */}
            <div className="flex flex-col gap-6">
              <Link href="/" aria-label="صفحه اصلی" className="inline-flex items-center gap-2">
                {typeof logo === 'object' && logo !== null && 'url' in logo && logo.url ? (
                  <Media
                    resource={logo}
                    className="h-8 w-auto"
                    imgClassName="h-8 w-auto object-contain"
                  />
                ) : (
                  <>
                    <BrandFooterSandoqLogomark
                      aria-hidden="true"
                      className="h-8 w-auto text-white"
                    />
                    <BrandFooterSandoqLogotype
                      aria-label={logoText}
                      className="h-8 w-auto text-white"
                    />
                  </>
                )}
              </Link>
              <Typography color="neutral-400" variant="16/regular">
                {description}
              </Typography>
            </div>

            {/* Contact block */}
            <div className="flex flex-col gap-6">
              {address ? (
                <ContactRow
                  icon={
                    <FooterLocationIcon
                      aria-hidden="true"
                      className="size-6 shrink-0 text-neutral-400"
                    />
                  }
                  text={address}
                />
              ) : null}
              {phone ? (
                <ContactRow
                  icon={
                    <FooterCallIcon
                      aria-hidden="true"
                      className="size-6 shrink-0 text-neutral-400"
                    />
                  }
                  text={phone}
                />
              ) : null}
            </div>
          </div>

          {columns.map((col, idx) => {
            const className = cn(
              idx === 0 ? 'order-2' : idx === 1 ? 'order-3' : `order-${idx + 2}`,
              'lg:order-0',
            )

            if (col.title.trim() === 'راه های ارتباطی با ما') {
              return (
                <div
                  key={`${col.title}-${idx}`}
                  className={cn('flex min-w-0 flex-1 flex-col gap-4', className)}
                >
                  <Typography as="h3" color="white" variant="20/bold">
                    {col.title}
                  </Typography>
                  <div className="flex items-center gap-4">
                    {socialLinks
                      ? socialLinks.map((item, i) => {
                          const href = item.url?.trim() && item.url !== '#' ? item.url : '/'
                          const icon = item.icon
                          const hasMediaIcon =
                            typeof icon === 'object' &&
                            icon !== null &&
                            'url' in icon &&
                            Boolean(icon.url)

                          return (
                            <SocialLinkItem
                              key={`${item.platform}-${i}`}
                              ariaLabel={item.platform}
                              href={href}
                            >
                              {hasMediaIcon ? (
                                <Media
                                  resource={icon}
                                  className="flex size-8 shrink-0 items-center justify-center"
                                  imgClassName="size-8 object-contain"
                                />
                              ) : (
                                <FooterHouseIcon aria-hidden="true" className="size-8" />
                              )}
                            </SocialLinkItem>
                          )
                        })
                      : [0, 1, 2].map((i) => (
                          <SocialLinkItem key={i} ariaLabel="شبکه اجتماعی (نماد موقت)" href="/">
                            <FooterHouseIcon aria-hidden="true" className="size-8" />
                          </SocialLinkItem>
                        ))}
                  </div>
                </div>
              )
            }

            return (
              <NavColumn
                key={`${col.title}-${idx}`}
                className={className}
                heading={col.title}
                links={col.links}
              />
            )
          })}
        </div>

        {/* Band B — divider */}
        <div aria-hidden="true" className="border-t-[1.5px] border-neutral-700" />

        {/* Band C — copyright. */}
        <div className="flex items-center">
          <Typography
            className="text-right lg:whitespace-nowrap"
            color="neutral-400"
            variant="14/light"
          >
            {copyright}
          </Typography>
        </div>
      </div>
    </footer>
  )
}
