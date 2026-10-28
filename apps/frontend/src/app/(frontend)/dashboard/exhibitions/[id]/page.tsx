import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { ExhibitionBoothAdmin } from '@/components/dashboard/exhibition-admin/exhibition-booth-admin'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'مدیریت کاتالوگ غرفه‌ها',
  description: 'مدیریت مشخصات، سقف و قیمت‌گذاری غرفه‌های نمایشگاه',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ExhibitionAdminPage({ params }: PageProps) {
  const { id } = await params
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })

  const role = dashboardOperationalRole(user)
  if (role !== 'system-owner') {
    redirect('/dashboard?access=denied')
  }

  // Find the exhibition from CMS
  let exhibitionDoc: Record<string, unknown> | null = null

  try {
    exhibitionDoc = (await payload.findByID({
      collection: 'exhibitions',
      id,
      depth: 0,
    })) as unknown as Record<string, unknown>
  } catch {
    exhibitionDoc = null
  }

  if (!exhibitionDoc) {
    notFound()
  }

  const startDate = typeof exhibitionDoc.startDate === 'string' ? exhibitionDoc.startDate : ''
  const endDate = typeof exhibitionDoc.endDate === 'string' ? exhibitionDoc.endDate : ''

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#fafafa] px-4 pt-6 pb-12 sm:px-6 sm:pt-10 lg:px-8">
      <ExhibitionBoothAdmin
        exhibition={{
          id: String(exhibitionDoc.id),
          title: String(exhibitionDoc.title ?? 'نمایشگاه'),
          location: exhibitionDoc.location ? String(exhibitionDoc.location) : null,
          dates: startDate ? `${formatDate(startDate)} تا ${formatDate(endDate)}` : null,
        }}
      />
    </div>
  )
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
