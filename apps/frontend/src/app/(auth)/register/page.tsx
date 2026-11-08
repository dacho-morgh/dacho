import type { Metadata } from 'next'
import RegisterPage from '@/components/auth/register-page'
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
  // The raw value: the form tells an explicit return URL (honoured after the
  // automatic sign-in) from the default one (the role's own landing page).
  return <RegisterPage returnUrl={returnUrl} />
}
