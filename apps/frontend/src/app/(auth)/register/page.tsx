import type { Metadata } from 'next'
import RegisterPage from '@/components/auth/register-page'
import { getSafeReturnUrl } from '@/utilities/auth-return-url'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const metadata: Metadata = createPageMetadata({
  title: 'ثبت‌نام',
  description: 'ثبت‌نام در سامانه کارخانه نوآوری صنایع انرژی بوشهر',
  path: '/register',
  noIndex: true,
})

type Args = {
  searchParams: Promise<{ returnUrl?: string | string[] }>
}

export default async function Page({ searchParams }: Args) {
  const { returnUrl } = await searchParams
  return <RegisterPage returnUrl={getSafeReturnUrl(returnUrl)} />
}
