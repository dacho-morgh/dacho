import { describe, expect, it } from 'vitest'

import { OPERATIONAL_ROLES, type OperationalRole } from '@cms-core/access/roles'
import { canDeleteDocuments, canUploadDocuments, type RequestDto } from '@/utilities/dashboard-api'
import {
  canReadCompanyDossiers,
  dashboardOperationalRole,
  dashboardWorkspace,
  isInternalDashboardUser,
  type DashboardWorkspace,
} from '@/utilities/dashboard-server'

// FE30 — permission regression coverage at the frontend boundary. This pins the
// UI decisions that supplement (never replace) server authorization: which
// workspace each of the seven roles lands on, who may read company dossiers,
// and that document affordances follow the API's `allowedActions` only.

type RoleExpectation = {
  workspace: DashboardWorkspace
  internal: boolean
  companyDossiers: boolean
}

const MATRIX: Record<OperationalRole, RoleExpectation> = {
  'system-owner': { workspace: 'company-dossiers', internal: true, companyDossiers: true },
  'central-secretariat': { workspace: 'company-dossiers', internal: true, companyDossiers: true },
  'chief-reviewer': { workspace: 'internal-queue', internal: true, companyDossiers: false },
  reviewer: { workspace: 'internal-queue', internal: true, companyDossiers: false },
  'employer-reviewer': { workspace: 'internal-queue', internal: true, companyDossiers: false },
  'investment-reviewer': { workspace: 'internal-queue', internal: true, companyDossiers: false },
  representative: { workspace: 'applicant-queue', internal: false, companyDossiers: false },
}

function user(operationalRole: string, overrides: Record<string, unknown> = {}) {
  return { operationalRole, isActive: true, ...overrides }
}

describe('seven-role dashboard matrix', () => {
  it('covers every operational role exactly once', () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...OPERATIONAL_ROLES].sort())
  })

  it.each([...OPERATIONAL_ROLES])('routes %s to its own workspace', (role) => {
    const candidate = user(role)
    const expected = MATRIX[role]

    expect(dashboardOperationalRole(candidate)).toBe(role)
    expect(dashboardWorkspace(role)).toBe(expected.workspace)
    expect(isInternalDashboardUser(candidate)).toBe(expected.internal)
    expect(canReadCompanyDossiers(candidate)).toBe(expected.companyDossiers)
  })

  it('never resolves a workspace for an absent session', () => {
    expect(dashboardOperationalRole(null)).toBeNull()
    expect(dashboardWorkspace(null)).toBe('unauthenticated')
    expect(isInternalDashboardUser(null)).toBe(false)
    expect(canReadCompanyDossiers(undefined)).toBe(false)
  })

  it('drops authority for inactive, service or unknown roles', () => {
    for (const role of OPERATIONAL_ROLES) {
      expect(dashboardOperationalRole(user(role, { isActive: false }))).toBeNull()
      expect(dashboardOperationalRole(user(role, { backendService: true }))).toBeNull()
      expect(canReadCompanyDossiers(user(role, { isActive: false }))).toBe(false)
    }
    expect(dashboardOperationalRole(user('super-user'))).toBeNull()
    expect(dashboardWorkspace(dashboardOperationalRole(user('super-user')))).toBe('unauthenticated')
  })

  it('keeps the applicant queue and internal queue disjoint', () => {
    const applicantRoles = OPERATIONAL_ROLES.filter(
      (role) => dashboardWorkspace(role) === 'applicant-queue',
    )
    const internalRoles = OPERATIONAL_ROLES.filter(
      (role) => dashboardWorkspace(role) === 'internal-queue',
    )

    expect(applicantRoles).toEqual(['representative'])
    expect(internalRoles).toHaveLength(4)
    expect(applicantRoles.filter((role) => internalRoles.includes(role))).toEqual([])
    expect(isInternalDashboardUser(user('representative'))).toBe(false)
  })
})

describe('document affordances follow server allowedActions', () => {
  const base = { allowedActions: undefined } as Pick<RequestDto, 'allowedActions'>

  it('renders no upload/delete affordance when the API grants only read', () => {
    expect(canUploadDocuments({ allowedActions: ['read'] })).toBe(false)
    expect(canDeleteDocuments({ allowedActions: ['read'] })).toBe(false)
  })

  it('renders no affordance when allowedActions is absent', () => {
    expect(canUploadDocuments(base)).toBe(false)
    expect(canDeleteDocuments(base)).toBe(false)
  })

  it('grants each affordance independently', () => {
    expect(canUploadDocuments({ allowedActions: ['uploadDocument'] })).toBe(true)
    expect(canDeleteDocuments({ allowedActions: ['uploadDocument'] })).toBe(false)
    expect(canDeleteDocuments({ allowedActions: ['deleteDocument'] })).toBe(true)
  })
})
