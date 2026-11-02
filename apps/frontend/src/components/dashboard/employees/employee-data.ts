import {
  OPERATIONAL_ROLE_LABELS,
  type OperationalRole,
  type PersonnelGender,
} from '@cms-core/access/roles'
import type { BadgeProps } from '@/components/ui/badge'
import { AdminError, adminRequest } from '../owner-admin'

export type PersonnelFileRef = {
  id: number
  filename?: string | null
  url?: string | null
  filesize?: number | null
}

/** One staff member as the add/edit/view employee screens read and write it. */
export type Employee = {
  id: string | number
  name?: string | null
  phone?: string
  email?: string | null
  operationalRole?: OperationalRole
  isActive: boolean
  updatedAt?: string
  age?: number | null
  gender?: PersonnelGender | null
  degree?: string | null
  activityField?: string | null
  resume?: (PersonnelFileRef | number)[] | null
  personnelAddresses?: { id?: string | null; address: string }[] | null
}

/** Figma tag colours of the «نقش» column (node 30815:12121). */
export function roleTag(role?: OperationalRole | null): {
  label: string
  variant: NonNullable<BadgeProps['variant']>
} {
  if (!role) return { label: 'بدون نقش', variant: 'gray' }
  const label = OPERATIONAL_ROLE_LABELS[role]
  switch (role) {
    case 'chief-reviewer':
      return { label, variant: 'success' }
    case 'investment-reviewer':
      return { label, variant: 'amber' }
    case 'reviewer':
    case 'employer-reviewer':
      return { label, variant: 'primary' }
    default:
      return { label, variant: 'gray' }
  }
}

const EMPLOYEE_FIELDS = [
  'name',
  'phone',
  'email',
  'operationalRole',
  'isActive',
  'updatedAt',
  'age',
  'gender',
  'degree',
  'activityField',
  'resume',
  'personnelAddresses',
]

export async function loadEmployee(id: string): Promise<Employee> {
  const select = EMPLOYEE_FIELDS.map((field) => `select[${field}]=true`).join('&')
  return adminRequest(`/api/users/${encodeURIComponent(id)}?depth=1&${select}`)
}

/** Uploads one resume to the private personnel store and returns its id. */
export async function uploadPersonnelFile(file: File): Promise<number> {
  const body = new FormData()
  body.append('file', file)
  body.append('_payload', JSON.stringify({}))
  const result = await adminRequest('/api/personnel-files', { method: 'POST', body })
  if (typeof result.doc?.id !== 'number') throw new AdminError(500, {})
  return result.doc.id
}

/** Best effort: an upload whose employee save failed must not linger. */
export async function discardPersonnelFiles(ids: number[]): Promise<void> {
  await Promise.allSettled(
    ids.map((id) =>
      fetch(`/api/personnel-files/${id}`, { method: 'DELETE', credentials: 'same-origin' }),
    ),
  )
}

/** Deactivation is the «حذف کارمند» action: history and attribution are kept. */
export async function setEmployeeActive(employee: Employee, isActive: boolean): Promise<Employee> {
  const result = await adminRequest(`/api/users/personnel/${encodeURIComponent(employee.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedUpdatedAt: employee.updatedAt, isActive }),
  })
  if (result.doc?.isActive !== isActive) throw new AdminError(403, {})
  return { ...employee, ...result.doc }
}

export const fileRef = (file: PersonnelFileRef | number): PersonnelFileRef =>
  typeof file === 'number' ? { id: file } : file
