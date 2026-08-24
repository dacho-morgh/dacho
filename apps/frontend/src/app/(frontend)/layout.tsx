import { GeistMono } from 'geist/font/mono'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import React from 'react'
import LandingHeader from '@/components/landing/header'
import { Footer } from '@/Footer/Component'
import { FooterVisibility } from '@/Footer/FooterVisibility'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { siteMetadata, siteViewport } from '@/utilities/siteMetadata'
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
      </head>
      <body>
        <Providers>
          <div id="smooth-wrapper">
            <LandingHeader />
            <div id="smooth-content">
              {children}
              <FooterVisibility>
                <Footer />
              </FooterVisibility>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = siteMetadata
export const viewport: Viewport = siteViewport
