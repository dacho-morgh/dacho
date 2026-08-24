import type { Metadata } from 'next'
import localFont from 'next/font/local'
import React from 'react'
import '../(frontend)/globals.css'

const yekanBakh = localFont({
  src: '../../../public/fonts/YekanBakhFaNum-VF.ttf',
  variable: '--font-yekan-bakh',
})

export const metadata: Metadata = {
  title: 'ورود | صندوق نوآوری بوشهر',
  description: 'ورود به سامانه صندوق پژوهش و فناوری استان بوشهر',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={yekanBakh.variable} data-theme="light" dir="rtl" lang="fa">
      <body>{children}</body>
    </html>
  )
}
