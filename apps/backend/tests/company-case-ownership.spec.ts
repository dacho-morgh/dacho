import { describe, expect, it } from 'vitest'

import {
  allowedRequestActions,
  bindRequestScope,
  requestScopeFor,
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
    })
    expect(bindRequestScope(scope, 'user-1', null)).toEqual({ kind: 'none' })
    expect(bindRequestScope(scope, 'user-1', undefined)).toEqual({ kind: 'none' })
  })

  it('generates company_id SQL filter for company scope', () => {
    const params: unknown[] = []
    const clause = requestScopeClause({ kind: 'company', companyId: 'company-100' }, params, 'r')
    expect(clause).toBe('r.company_id = $1')
    expect(params).toEqual(['company-100'])
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
})
