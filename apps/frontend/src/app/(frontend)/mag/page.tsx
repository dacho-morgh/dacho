import type { Metadata } from 'next'
import { getMagData, normalizeHashtag } from '@/components/landing/mag/data'
import MagPage from '@/components/landing/mag/mag-page-live'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const metadata: Metadata = createPageMetadata({
  title: 'مجله صندوق',
  description: 'اخبار، مقالات و گزارش‌های حوزه فناوری و نوآوری در مجله صندوق.',
  path: '/mag',
})

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ hashrag?: string | string[] }>
}) {
  const { hashrag } = await searchParams
  const data = await getMagData(normalizeHashtag(hashrag))
  return <MagPage data={data} />
}
