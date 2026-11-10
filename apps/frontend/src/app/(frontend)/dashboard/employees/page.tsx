import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { EmployeeList } from '@/components/dashboard/employee-list'
import { toStaff, type Employee } from '@/components/dashboard/employees/employee-data'
import {
  canReadCompanyDossiers,
  dashboardOperationalRole,
  serverDashboardFetchResult,
} from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  if (!canReadCompanyDossiers(user)) redirect('/dashboard?access=denied')

  const canManage = dashboardOperationalRole(user) === 'system-owner'

  // The list is read here so the table opens with its rows; if the read fails the client loads it
  // itself and shows the failure (sign-in, access or retry) in the table.
  let initial: Employee[] | undefined
  try {
    if (canManage) {
      const result = await payload.find({
        collection: 'users',
        depth: 0,
        pagination: false,
        overrideAccess: false,
        user,
        where: { backendService: { not_equals: true } },
        select: {
          name: true,
          phone: true,
          email: true,
          operationalRole: true,
          isActive: true,
          updatedAt: true,
          degree: true,
          activityField: true,
        },
      })
      initial = toStaff(result.docs as unknown as Employee[])
    } else {
      const result = await serverDashboardFetchResult<{ items?: Employee[] }>('/admin/employees?limit=100')
      if (result.kind === 'ok' && Array.isArray(result.data.items)) initial = toStaff(result.data.items)
    }
  } catch {
    initial = undefined
  }

  return <EmployeeList canManage={canManage} initial={initial} />
}
