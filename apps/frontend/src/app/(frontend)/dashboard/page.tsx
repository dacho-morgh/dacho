import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import React from 'react'
import { RoleOverview } from '@/components/dashboard/role-overview'
import { Typography } from '@/components/ui/typography'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'داشبورد',
  description: 'سامانه مدیریت درخواست‌ها، طرح‌ها و پیگیری فرآیندهای خدمات کارخانه نوآوری بوشهر',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string }>
}) {
  const params = await searchParams
  const showDeniedNotice = params.access === 'denied'
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(requestHeaders) })
  const role = dashboardOperationalRole(user)

  return (
    <>
      {showDeniedNotice && (
        <div className="px-4 pt-6 sm:px-8">
          <DeniedNotice />
        </div>
      )}
      {role ? <RoleOverview role={role} userName={user?.name} /> : null}
    </>
  )
}

function DeniedNotice() {
  return (
    <Typography
      role="status"
      variant="14/regular"
      color="warning"
      className="rounded-lg border border-warning-500 bg-warning-50 p-3 pl-14 md:pl-3"
    >
      به نشانی درخواستی دسترسی ندارید؛ پیشخوان نقش فعلی شما نمایش داده شده است.
    </Typography>
  )
}
