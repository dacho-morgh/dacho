import type { Metadata } from 'next'
import LoginPage from '@/components/auth/login-page'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const metadata: Metadata = createPageMetadata({
  title: 'ورود',
  description: 'ورود به سامانه کارخانه نوآوری صنایع انرژی بوشهر',
  path: '/login',
  noIndex: true,
})

type Args = {
  searchParams: Promise<{ registered?: string; expired?: string; loggedOut?: string; returnUrl?: string | string[] }>
}

export default async function Page({ searchParams }: Args) {
  const { registered, expired, loggedOut, returnUrl } = await searchParams
  return <LoginPage registered={registered === '1'} expired={expired === '1'} loggedOut={loggedOut === '1'} returnUrl={returnUrl} />
}
