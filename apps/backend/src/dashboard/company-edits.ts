import type { CompanyFields } from '../auth/user-store.js'
import { dossierPatch, mergeDossier } from './dossier.js'
import type { Address, CompanyInfo, Executive, UserProfile } from './profile-repo.js'

/**
 * T59: any real edit of the company dossier withdraws an approved or pending
 * verification. The representative's own contact details are personal data
 * (T58) and never count. The CMS `invalidateCompanyVerification` hook applies
 * the same rule to direct CMS edits and uses the same reason text.
 */
export const COMPANY_EDIT_REVERIFICATION_REASON = 'ویرایش اطلاعات شرکت؛ نیازمند احراز مجدد'

const EDITABLE_COMPANY_FIELDS = [
  'name', 'establishmentDate', 'status', 'type', 'registrationNumber', 'economicCode',
] as const satisfies readonly (keyof CompanyInfo)[]

export interface ProfileEdit {
  company?: Partial<CompanyInfo>
  executives?: Executive[]
  dossier?: Partial<CompanyFields>
}

/** True when saving `edit` would change anything stored on the company. */
export function changesCompany(profile: UserProfile, edit: ProfileEdit): boolean {
  if (edit.company && EDITABLE_COMPANY_FIELDS.some(
    (field) => edit.company![field] !== undefined && edit.company![field] !== profile.company[field],
  )) return true
  if (edit.executives && !sameExecutives(profile.executives, edit.executives)) return true
  if (edit.dossier && Object.keys(dossierPatch(profile.dossier, mergeDossier(profile.dossier, edit.dossier))).length > 0) return true
  return false
}

function sameExecutives(current: Executive[], next: Executive[]): boolean {
  const shape = (items: Executive[]) => JSON.stringify(items.map(({ role, name }) => [String(role ?? ''), String(name ?? '')]))
  return shape(current) === shape(next)
}

/** True when `update` changes at least one field of the stored address. */
export function changesAddress(current: Address, update: Partial<Omit<Address, 'id'>>): boolean {
  return (Object.keys(update) as (keyof typeof update)[]).some(
    (field) => update[field] !== undefined && update[field] !== current[field],
  )
}
