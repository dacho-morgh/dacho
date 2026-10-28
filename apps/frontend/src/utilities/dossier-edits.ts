import type { AbsenceField, CompanyDossierDto } from './dashboard-api'

/** Submit only edited company fields and preserve absence answers changed on the resume page. */
export function buildCompanyDossierPatch(
  baseline: CompanyDossierDto,
  form: CompanyDossierDto,
  latest: CompanyDossierDto,
): Partial<CompanyDossierDto> {
  const patch: Partial<CompanyDossierDto> = {}
  const textFields = [
    'legalEntityType',
    'knowledgeBasedStatus',
    'classification',
    'foundingYear',
    'activityDomain',
    'website',
    'centerEstablishment',
  ] as const
  for (const field of textFields) {
    if (form.notAvailable.includes(field as AbsenceField)) continue
    const value = form[field].trim()
    if (value !== baseline[field]) patch[field] = value
  }
  if (
    !form.notAvailable.includes('insuredEmployeeCount') &&
    form.insuredEmployeeCount !== baseline.insuredEmployeeCount
  ) {
    patch.insuredEmployeeCount = form.insuredEmployeeCount
  }
  const editableAbsences = ['website', 'centerEstablishment', 'insuredEmployeeCount'] as const
  const changedAbsences = editableAbsences.filter(
    (field) => baseline.notAvailable.includes(field) !== form.notAvailable.includes(field),
  )
  if (changedAbsences.length) {
    patch.notAvailable = latest.notAvailable.filter(
      (field) => !changedAbsences.includes(field as (typeof editableAbsences)[number]),
    )
    for (const field of changedAbsences) {
      if (form.notAvailable.includes(field)) patch.notAvailable.push(field)
    }
  }
  return patch
}

/** Replacement arrays must still match what the representative was shown before saving. */
export function hasStaleDossierSlice(
  shown: CompanyDossierDto,
  latest: CompanyDossierDto,
  update: Partial<CompanyDossierDto>,
): boolean {
  return (Object.keys(update) as (keyof CompanyDossierDto)[]).some(
    (key) => JSON.stringify(latest[key]) !== JSON.stringify(shown[key]),
  )
}
