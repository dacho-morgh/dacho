/**
 * The only absence answers a company may persist. Kept in a standalone module
 * so both the collection boundary and direct-write tests can use it without
 * pulling in the Payload configuration.
 */
export const COMPANY_ABSENCE_FIELDS = [
  'centerEstablishment',
  'website',
  'insuredEmployeeCount',
  'catalogues',
  'pastProjectsCustomers',
  'requestedServices',
  'certificatesLicenses',
  'amendmentNotices',
] as const

export type CompanyAbsenceField = (typeof COMPANY_ABSENCE_FIELDS)[number]

export function validateCompanyAbsenceList(value: unknown): true | string {
  if (value === undefined || value === null) return true
  if (!Array.isArray(value)) return 'notAvailable must be an array of permitted absence keys'
  for (const entry of value) {
    if (typeof entry !== 'string' || !(COMPANY_ABSENCE_FIELDS as readonly string[]).includes(entry)) {
      return 'notAvailable contains an unsupported absence key'
    }
  }
  return true
}
