import { GeistMono } from 'geist/font/mono'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import React from 'react'
import LandingHeader from '@/components/landing/header'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { getServerSideURL } from '@dacho/cms-core/utilities'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import './globals.css'
import { cn } from '@/utilities/ui'

const yekanBakh = localFont({
  src: '../../../public/fonts/YekanBakhFaNum-VF.ttf',
  variable: '--font-yekan-bakh',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      className={cn(yekanBakh.variable, GeistMono.variable)}
      dir="rtl"
      lang="fa"
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <Providers>
          <div id="smooth-wrapper">
            <LandingHeader />
            <div id="smooth-content">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@payloadcms',
  },
}
