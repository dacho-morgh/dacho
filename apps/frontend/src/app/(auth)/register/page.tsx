import type { Metadata } from 'next'
import RegisterPage from '@/components/auth/register-page'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const metadata: Metadata = createPageMetadata({
  title: 'ثبت‌نام',
  description: 'ثبت‌نام در سامانه کارخانه نوآوری صنایع انرژی بوشهر',
  path: '/register',
  noIndex: true,
})

export default function Page() {
  return <RegisterPage />
}
