import { getServerSideURL } from '@dacho/cms-core/utilities'
import type { Metadata, Viewport } from 'next'

export const SITE_NAME = 'کارخانه نوآوری صنایع انرژی بوشهر'
export const SITE_DESCRIPTION =
  'خدمات تأمین مالی، صدور ضمانت‌نامه، سرمایه‌گذاری و تجاری‌سازی برای شرکت‌های دانش‌بنیان و فناور.'
export const SITE_OG_IMAGE = {
  url: '/og-image.png',
  width: 1688,
  height: 932,
  alt: 'مسیر رشد کسب‌وکارها، از فرصت تا موفقیت',
}

export const siteIcons: Metadata['icons'] = {
  icon: [
    { url: '/favicon/favicon.ico', sizes: 'any' },
    { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
  ],
  apple: [{ url: '/favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  shortcut: ['/favicon/favicon.ico'],
}

export const siteMetadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: '/favicon/site.webmanifest',
  icons: siteIcons,
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
    images: [SITE_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE.url],
  },
}

export const siteViewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#2563eb',
}

type PageMetadataOptions = {
  title?: string
  description?: string | null
  path?: string
  noIndex?: boolean
}

export const createPageMetadata = ({
  title,
  description = SITE_DESCRIPTION,
  path,
  noIndex = false,
}: PageMetadataOptions): Metadata => {
  const resolvedDescription = description || SITE_DESCRIPTION
  const resolvedTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME

  return {
    ...(title ? { title } : {}),
    description: resolvedDescription,
    ...(path ? { alternates: { canonical: path } } : {}),
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: SITE_NAME,
      title: resolvedTitle,
      description: resolvedDescription,
      ...(path ? { url: path } : {}),
      images: [SITE_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: resolvedDescription,
      images: [SITE_OG_IMAGE.url],
    },
  }
}
