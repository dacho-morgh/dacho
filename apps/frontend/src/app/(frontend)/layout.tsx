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

const yekanBakh = localFont({
  src: '../../../public/fonts/YekanBakhFaNum-VF.woff2',
  variable: '--font-yekan-bakh',
  display: 'swap',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      className={yekanBakh.variable}
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
