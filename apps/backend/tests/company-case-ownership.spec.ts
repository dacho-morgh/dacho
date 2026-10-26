import { describe, expect, it } from 'vitest'

import {
  allowedRequestActions,
  bindRequestScope,
  canDeleteDocument,
  canReadDocument,
  canUploadOwnedDocument,
  requestScopeFor,
  type DocumentForPolicy,
  type RequestForPolicy,
} from '../src/access/policy.js'
import { requestScopeClause } from '../src/dashboard/request-repo.js'

describe('T12: Company-owned applications and acting person separation', () => {
  it('maps representative role to company scope', () => {
    expect(requestScopeFor('representative')).toEqual({ kind: 'company', companyId: '' })
  })

  it('binds representative scope to the actor company ID, or none if unassociated', () => {
    const scope = requestScopeFor('representative')
    expect(bindRequestScope(scope, 'user-1', 'company-100')).toEqual({
      kind: 'company',
      companyId: 'company-100',
      userId: 'user-1',
    })
    expect(bindRequestScope(scope, 'user-1', null)).toEqual({ kind: 'none' })
    expect(bindRequestScope(scope, 'user-1', undefined)).toEqual({ kind: 'none' })
  })

  it('generates company_id SQL filter and includes legacy unmigrated fallback when userId is bound', () => {
    const paramsWithUser: unknown[] = []
    const clauseWithUser = requestScopeClause(
      { kind: 'company', companyId: 'company-100', userId: 'user-1' },
      paramsWithUser,
      'r',
    )
    expect(clauseWithUser).toBe('(r.company_id = $1 OR (r.company_id IS NULL AND r.owner_id = $2))')
    expect(paramsWithUser).toEqual(['company-100', 'user-1'])

    const paramsWithoutUser: unknown[] = []
    const clauseWithoutUser = requestScopeClause(
      { kind: 'company', companyId: 'company-100' },
      paramsWithoutUser,
      'r',
    )
    expect(clauseWithoutUser).toBe('r.company_id = $1')
    expect(paramsWithoutUser).toEqual(['company-100'])
  })

  it('allows access to company applications regardless of acting user', () => {
    // Created by rep A (user-1) for company-100
    const draft: RequestForPolicy = {
      ownerId: 'user-1',
      companyId: 'company-100',
      status: 'draft',
    }

    // Rep A (user-1) has full draft actions
    expect(allowedRequestActions('representative', draft, 'user-1', 'company-100')).toEqual([
      'read',
      'submit',
      'uploadDocument',
      'deleteDocument',
    ])

    // Rep B (user-2) of SAME company-100 also has access (case ownership not limited to individual account)
    expect(allowedRequestActions('representative', draft, 'user-2', 'company-100')).toEqual([
      'read',
      'submit',
      'uploadDocument',
      'deleteDocument',
    ])

    // Rep C (user-3) of DIFFERENT company-200 gets NO actions
    expect(allowedRequestActions('representative', draft, 'user-3', 'company-200')).toEqual([])
  })

  it('maintains backwards compatibility for legacy unmigrated requests with null companyId', () => {
    const legacyDraft: RequestForPolicy = {
      ownerId: 'user-1',
      companyId: null,
      status: 'draft',
    }

    // Acting user who created legacy draft can still access it
    expect(allowedRequestActions('representative', legacyDraft, 'user-1', 'company-100')).toEqual([
      'read',
      'submit',
      'uploadDocument',
      'deleteDocument',
    ])

    // Another user cannot access legacy unmigrated draft
    expect(allowedRequestActions('representative', legacyDraft, 'user-2', 'company-100')).toEqual([])
  })

  it('authorizes document operations by company rather than former representative account', () => {
    const caseDoc: DocumentForPolicy = {
      category: 'proposal',
      companyId: null,
      requestId: 'req-1',
      requestOwnerId: 'user-former',
      requestCompanyId: 'company-100',
      assigned: false,
    }

    // Current representative of company-100 can read
    expect(canReadDocument('representative', caseDoc, 'user-new', 'company-100')).toBe(true)

    // Former representative who moved to company-200 CANNOT read company-100 case document
    expect(canReadDocument('representative', caseDoc, 'user-former', 'company-200')).toBe(false)

    // Same-company representative can upload proposal to draft request
    expect(
      canUploadOwnedDocument(
        'representative',
        'proposal',
        {
          requestOwnerId: 'user-former',
          requestCompanyId: 'company-100',
          requestStatus: 'draft',
        },
        'user-new',
        'company-100',
      ),
    ).toBe(true)

    // Different-company representative cannot upload
    expect(
      canUploadOwnedDocument(
        'representative',
        'proposal',
        {
          requestOwnerId: 'user-former',
          requestCompanyId: 'company-100',
          requestStatus: 'draft',
        },
        'user-former',
        'company-200',
      ),
    ).toBe(false)

    // Same-company representative can delete draft document
    expect(
      canDeleteDocument(
        'representative',
        {
          requestOwnerId: 'user-former',
          requestCompanyId: 'company-100',
          requestStatus: 'draft',
        },
        'user-new',
        'company-100',
      ),
    ).toBe(true)

    // Former representative now at different company cannot delete draft document
    expect(
      canDeleteDocument(
        'representative',
        {
          requestOwnerId: 'user-former',
          requestCompanyId: 'company-100',
          requestStatus: 'draft',
        },
        'user-former',
        'company-200',
      ),
    ).toBe(false)

    // Unassociated former representative (actorCompanyId = null) CANNOT delete company document
    expect(
      canDeleteDocument(
        'representative',
        {
          requestOwnerId: 'user-former',
          requestCompanyId: 'company-100',
          requestStatus: 'draft',
        },
        'user-former',
        null,
      ),
    ).toBe(false)

    // Document with conflicting companyId does not grant read when request belongs to another company
    const conflictingDoc: DocumentForPolicy = {
      category: 'proposal',
      companyId: 'company-200',
      requestId: 'req-1',
      requestOwnerId: 'user-former',
      requestCompanyId: 'company-100',
      assigned: false,
    }
    expect(canReadDocument('representative', conflictingDoc, 'user-other', 'company-200')).toBe(false)
  })
})
