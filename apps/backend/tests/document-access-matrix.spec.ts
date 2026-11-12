import { describe, expect, it } from 'vitest'

import {
  DOCUMENT_CATEGORIES,
  canReadDocument,
  canUploadOwnedDocument,
  type DocumentCategory,
} from '../src/access/policy.js'

const roles = [
  'system-owner', 'central-secretariat', 'chief-reviewer', 'reviewer',
  'employer-reviewer', 'investment-reviewer', 'representative',
] as const

// Explicit expectations: do not derive the oracle from production audience rules.
const companyCategories: readonly DocumentCategory[] = [
  'articlesOfAssociation', 'establishmentNotices', 'amendmentNotices',
  'catalogues', 'certificatesLicenses', 'productsServices',
]
const unsupportedCategories: readonly DocumentCategory[] = [
  'rfp', 'supplementaryCaseFiles', 'boothPaymentReceipt',
]
// Closed to the company in both statuses below: only the chief's advancement opens them (T29).
const financialCategories: readonly DocumentCategory[] = [
  'financialStatements', 'debtFacilityEvidence', 'taxInsuranceRecords',
  'contractsOrdersMousCommitments', 'projectEstimateUseOfFunds', 'guaranteeCollateral',
]

const contexts = [
  { name: 'own company and request', companyId: 'company', requestOwnerId: 'actor' },
  { name: 'other company and request', companyId: 'other-company', requestOwnerId: 'other' },
  { name: 'own company, other request owner', companyId: 'company', requestOwnerId: 'other' },
  { name: 'legacy request owner without company', companyId: null, requestOwnerId: 'actor' },
] as const

// A support attachment is a company-parented file of a ticket, covered by its own block below.
const requestAndCompanyCategories = DOCUMENT_CATEGORIES.filter((category) => category !== 'supportAttachment')

describe('T42 current backend document authority matrix', () => {
  for (const category of requestAndCompanyCategories) {
    const supported = !unsupportedCategories.includes(category)
    const companyDocument = companyCategories.includes(category)
    for (const role of roles) {
      const privileged = role === 'system-owner' || role === 'central-secretariat'
      for (const context of contexts) {
        for (const assigned of [false, true]) {
          it(`read ${category}: ${role}, ${context.name}, assigned=${assigned}`, () => {
            const expected = supported && (
              privileged || (role === 'representative'
                ? context.companyId === 'company' || (!companyDocument && context.requestOwnerId === 'actor')
                : assigned && category === 'proposal')
            )
            expect(canReadDocument(role, {
              category,
              companyId: context.companyId,
              requestId: companyDocument ? null : 'request',
              requestOwnerId: companyDocument ? null : context.requestOwnerId,
              requestCompanyId: companyDocument ? null : context.companyId,
              assigned,
            }, 'actor', 'company')).toBe(expected)
          })
        }
        for (const requestStatus of ['draft', 'in_review']) {
          it(`upload ${category}: ${role}, ${context.name}, status=${requestStatus}`, () => {
            const validParent = !companyDocument || context.companyId !== null
            const expected = supported && validParent && (
              privileged || (role === 'representative' && (companyDocument
                ? context.companyId === 'company'
                : context.requestOwnerId === 'actor' && !financialCategories.includes(category) && (requestStatus === 'draft' || category === 'correspondenceAttachment')))
            )
            expect(canUploadOwnedDocument(role, category, {
              companyId: companyDocument ? context.companyId : null,
              requestOwnerId: companyDocument ? null : context.requestOwnerId,
              requestStatus,
              assigned: true,
            }, 'actor', 'company')).toBe(expected)
          })
        }
      }
      it(`rejects upload ${category} without required parent for ${role}`, () => {
        expect(canUploadOwnedDocument(role, category, {}, 'actor', null)).toBe(false)
      })
    }
  }
})

describe('support attachment authority', () => {
  const parent = (companyId: string | null) => ({ companyId, requestOwnerId: null, requestStatus: null, assigned: false })
  const document = (companyId: string | null) => ({
    category: 'supportAttachment' as const,
    companyId,
    requestId: null,
    requestOwnerId: null,
    requestCompanyId: null,
    assigned: false,
  })

  it('lets only the owning company representative upload, never staff or case roles', () => {
    for (const role of roles) {
      expect(canUploadOwnedDocument(role, 'supportAttachment', parent('company'), 'actor', 'company'))
        .toBe(role === 'representative')
    }
    expect(canUploadOwnedDocument('representative', 'supportAttachment', parent('other-company'), 'actor', 'company')).toBe(false)
    expect(canUploadOwnedDocument('representative', 'supportAttachment', parent(null), 'actor', 'company')).toBe(false)
    expect(canUploadOwnedDocument('representative', 'supportAttachment', {}, 'actor', 'company')).toBe(false)
  })

  it('opens a file to its company and to staff, and to no case role', () => {
    for (const role of roles) {
      const expected = role === 'system-owner' || role === 'central-secretariat' || role === 'representative'
      expect(canReadDocument(role, { ...document('company'), assigned: true }, 'actor', 'company')).toBe(expected)
    }
    expect(canReadDocument('representative', document('other-company'), 'actor', 'company')).toBe(false)
  })
})
