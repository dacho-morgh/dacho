import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { EmployeeForm } from '@/components/dashboard/employees/employee-form'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export default async function NewEmployeePage() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  if (dashboardOperationalRole(user) !== 'system-owner') redirect('/dashboard?access=denied')

  return <EmployeeForm mode="create" />
}
