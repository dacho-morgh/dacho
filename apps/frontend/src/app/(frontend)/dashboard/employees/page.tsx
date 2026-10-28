import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { EmployeeList } from '@/components/dashboard/employee-list'
import { canReadCompanyDossiers, dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  if (!canReadCompanyDossiers(user)) redirect('/dashboard')

  return <EmployeeList canManage={dashboardOperationalRole(user) === 'system-owner'} />
}
