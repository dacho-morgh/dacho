import type { Metadata } from 'next'
import LoginPage from '@/components/auth/login-page'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const metadata: Metadata = createPageMetadata({
  title: 'ورود',
  description: 'ورود به سامانه کارخانه نوآوری صنایع انرژی بوشهر',
  path: '/login',
  noIndex: true,
})

export default function Page() {
  return <LoginPage />
}
