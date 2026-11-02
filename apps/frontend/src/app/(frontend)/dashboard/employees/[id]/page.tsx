import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { EmployeeForm } from '@/components/dashboard/employees/employee-form'
import { canReadCompanyDossiers, dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  if (!canReadCompanyDossiers(user)) redirect('/dashboard?access=denied')

  const { id } = await params
  return (
    <EmployeeForm
      mode="view"
      id={id}
      canManage={dashboardOperationalRole(user) === 'system-owner'}
    />
  )
}
