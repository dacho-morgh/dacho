import { describe, expect, it } from 'vitest'

import {
  MAX_DOCUMENT_BYTES,
  allowedRequestActions,
  bindRequestScope,
  canDeleteDocument,
  canReadDocument,
  canUploadOwnedDocument,
  documentAudience,
  requestScopeFor,
  type DocumentCategory,
  FINANCIAL_CATEGORIES,
} from '../src/access/policy.js'
import { operationalRoleOf } from '../src/access/roles.js'
import { FINANCIAL_CHECKLIST } from '../src/dashboard/financial-invitation.js'
import { safeOriginalFilename, validateDocumentFile } from '../src/documents/policy.js'
import { PrivateDocumentStorage } from '../src/documents/storage.js'

const roles = [
  'system-owner',
  'central-secretariat',
  'chief-reviewer',
  'reviewer',
  'employer-reviewer',
  'investment-reviewer',
  'representative',
] as const

const pdf = (size = 32) => {
  const body = Buffer.alloc(size)
  body.write('%PDF-1.7', 0, 'ascii')
  return body
}

const docx = (size = 32) => {
  const body = Buffer.alloc(size)
  body.set([0x50, 0x4b, 0x03, 0x04])
  return body
}

const word = (size = 32) => {
  const body = Buffer.alloc(size)
  body.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  return body
}

describe('seven-role row scope', () => {
  it('maps every operational role to the same scope used by lists and details', () => {
    expect(requestScopeFor('system-owner')).toEqual({ kind: 'all' })
    expect(requestScopeFor('central-secretariat')).toEqual({ kind: 'all' })
    expect(bindRequestScope(requestScopeFor('representative'), 'p1', 'comp-1')).toEqual({ kind: 'company', companyId: 'comp-1', userId: 'p1' })
    expect(bindRequestScope(requestScopeFor('representative'), 'p1')).toEqual({ kind: 'company', companyId: '', userId: 'p1' })
    expect(bindRequestScope(requestScopeFor('chief-reviewer'), 'c1')).toEqual({ kind: 'assigned', userId: 'c1', role: 'chief-reviewer' })
    expect(bindRequestScope(requestScopeFor('reviewer'), 'r1')).toEqual({ kind: 'assigned', userId: 'r1', role: 'reviewer' })
    expect(bindRequestScope(requestScopeFor('employer-reviewer'), 'e1')).toEqual({ kind: 'assigned', userId: 'e1', role: 'employer-reviewer' })
    expect(bindRequestScope(requestScopeFor('investment-reviewer'), 'i1')).toEqual({ kind: 'assigned', userId: 'i1', role: 'investment-reviewer' })
  })

  it('resolves the current persisted role and rejects inactive/service accounts', () => {
    expect(operationalRoleOf({ id: '1', phone: '1', operationalRole: 'reviewer', isActive: true })).toBe('reviewer')
    expect(operationalRoleOf({ id: '1', phone: '1', operationalRole: 'reviewer', isActive: false })).toBeNull()
    expect(operationalRoleOf({ id: '1', phone: '1', operationalRole: 'reviewer', isActive: true, backendService: true })).toBeNull()
    expect(operationalRoleOf({ id: '1', phone: '1', operationalRole: 'not-a-role', isActive: true })).toBeNull()
    expect(operationalRoleOf({ id: '1', phone: '1', roles: ['admin'], isActive: true })).toBe('system-owner')
    expect(operationalRoleOf({ id: '1', phone: '1', roles: ['representative'], isActive: true })).toBe('representative')
    expect(operationalRoleOf({ id: '1', phone: '1', roles: ['referee'], isActive: true })).toBe('reviewer')
  })
})

describe('server-derived allowedActions', () => {
  const draft = { ownerId: 'p1', status: 'draft' }
  const submitted = { ownerId: 'p1', status: 'in_review' }

  it('advertises only actions each role can actually perform', () => {
    expect(allowedRequestActions('system-owner', submitted, 'o1')).toEqual([
      'read', 'assign', 'uploadDocument', 'deleteDocument',
    ])
    expect(allowedRequestActions('central-secretariat', submitted, 's1')).toEqual([
      'read', 'uploadDocument',
    ])
    for (const role of ['chief-reviewer', 'reviewer', 'employer-reviewer', 'investment-reviewer'] as const) {
      expect(allowedRequestActions(role, submitted, 'x1')).toEqual(['read'])
    }
    expect(allowedRequestActions('representative', draft, 'p1')).toEqual([
      'read', 'submit', 'uploadDocument', 'deleteDocument',
    ])
    expect(allowedRequestActions('representative', submitted, 'p1')).toEqual(['read'])
    expect(allowedRequestActions('representative', draft, 'other')).toEqual([])
  })

  it('advertises T21 triage, correction and reopen only where the endpoint will allow them', () => {
    const triage = { ownerId: 'p1', status: 'in_review', reviewStage: 'chief_triage' }
    const returned = { ownerId: 'p1', status: 'action_needed', reviewStage: 'chief_triage' }
    const rejected = { ownerId: 'p1', status: 'rejected', reviewStage: 'chief_triage' }

    expect(allowedRequestActions('chief-reviewer', { ...triage, actorIsResponsibleChief: true }, 'c1')).toEqual([
      'read', 'triage',
    ])
    expect(allowedRequestActions('chief-reviewer', triage, 'c1')).toEqual(['read'])
    expect(allowedRequestActions('chief-reviewer', { ...returned, actorIsResponsibleChief: true }, 'c1')).toEqual(['read'])
    // T22: a triaged case offers the review round until one exists for its revision.
    const triaged = { ...triage, reviewStage: 'triaged' }
    expect(allowedRequestActions('chief-reviewer', { ...triaged, actorIsResponsibleChief: true }, 'c1')).toEqual(['read', 'startReview'])
    expect(allowedRequestActions('chief-reviewer', { ...triaged, actorIsResponsibleChief: true, reviewRoundStarted: true }, 'c1')).toEqual(['read', 'replaceReviewer'])
    expect(allowedRequestActions('chief-reviewer', triaged, 'c1')).toEqual(['read'])
    expect(allowedRequestActions('chief-reviewer', { ...triaged, status: 'rejected', actorIsResponsibleChief: true }, 'c1')).toEqual(['read'])
    for (const role of ['system-owner', 'central-secretariat', 'reviewer', 'employer-reviewer', 'investment-reviewer'] as const) {
      expect(allowedRequestActions(role, { ...triaged, actorIsResponsibleChief: true }, 'x1')).not.toContain('startReview')
    }
    expect(allowedRequestActions('representative', triaged, 'p1')).not.toContain('startReview')
    expect(allowedRequestActions('reviewer', { ...triage, actorIsResponsibleChief: true }, 'r1')).toEqual(['read'])

    expect(allowedRequestActions('representative', returned, 'p1')).toEqual([
      'read', 'correct', 'uploadDocument', 'deleteDocument',
    ])
    expect(allowedRequestActions('representative', { ownerId: 'p1', status: 'action_needed' }, 'p1')).toEqual(['read'])
    expect(allowedRequestActions('representative', triage, 'p1')).toEqual(['read'])
    expect(allowedRequestActions('representative', rejected, 'p1')).toEqual(['read'])

    expect(allowedRequestActions('system-owner', rejected, 'o1')).toContain('reopen')
    expect(allowedRequestActions('system-owner', { ownerId: 'p1', status: 'rejected' }, 'o1')).not.toContain('reopen')
    expect(allowedRequestActions('system-owner', triage, 'o1')).not.toContain('reopen')
    expect(allowedRequestActions('central-secretariat', rejected, 's1')).toEqual(['read', 'uploadDocument'])
  })

  it('advertises T26 replacement only to the actor who may perform it, inside a started round', () => {
    const triaged = { ownerId: 'p1', status: 'in_review', reviewStage: 'triaged' }
    const started = { ...triaged, reviewRoundStarted: true }

    // The responsible chief replaces ordinary reviewers; the owner alone replaces the employer.
    expect(allowedRequestActions('chief-reviewer', { ...started, actorIsResponsibleChief: true }, 'c1')).toEqual(['read', 'replaceReviewer'])
    expect(allowedRequestActions('chief-reviewer', started, 'c1')).toEqual(['read'])
    expect(allowedRequestActions('system-owner', started, 'o1')).toEqual([
      'read', 'assign', 'replaceEmployer', 'uploadDocument', 'deleteDocument',
    ])
    expect(allowedRequestActions('system-owner', started, 'o1')).not.toContain('replaceReviewer')
    expect(allowedRequestActions('system-owner', triaged, 'o1')).not.toContain('replaceEmployer')
    expect(allowedRequestActions('system-owner', { ...started, status: 'rejected' }, 'o1')).not.toContain('replaceEmployer')
    expect(allowedRequestActions('system-owner', { ...started, reviewStage: 'chief_triage' }, 'o1')).not.toContain('replaceEmployer')

    for (const role of ['central-secretariat', 'reviewer', 'employer-reviewer', 'investment-reviewer'] as const) {
      const actions = allowedRequestActions(role, { ...started, actorIsResponsibleChief: true }, 'x1')
      expect(actions, role).not.toContain('replaceReviewer')
      expect(actions, role).not.toContain('replaceEmployer')
    }
    expect(allowedRequestActions('representative', started, 'p1')).toEqual(['read'])
  })

  it('advertises the T28 decision only to the responsible chief on a complete round', () => {
    const started = { ownerId: 'p1', status: 'in_review', reviewStage: 'triaged', reviewRoundStarted: true }
    const complete = { ...started, reviewRoundComplete: true }

    expect(allowedRequestActions('chief-reviewer', { ...complete, actorIsResponsibleChief: true }, 'c1')).toEqual(['read', 'decideReview'])
    expect(allowedRequestActions('chief-reviewer', { ...started, actorIsResponsibleChief: true }, 'c1')).not.toContain('decideReview')
    expect(allowedRequestActions('chief-reviewer', complete, 'c1')).toEqual(['read'])
    // A decided case has nothing left for the chief, whichever way it went.
    expect(allowedRequestActions('chief-reviewer', { ...complete, reviewStage: 'advanced', actorIsResponsibleChief: true }, 'c1')).toEqual(['read'])
    expect(allowedRequestActions('chief-reviewer', { ...complete, status: 'rejected', actorIsResponsibleChief: true }, 'c1')).toEqual(['read'])

    for (const role of ['system-owner', 'central-secretariat', 'reviewer', 'employer-reviewer', 'investment-reviewer'] as const) {
      expect(allowedRequestActions(role, { ...complete, actorIsResponsibleChief: true }, 'x1'), role).not.toContain('decideReview')
    }
    expect(allowedRequestActions('representative', complete, 'p1')).toEqual(['read'])
    // The owner keeps the employer replacement, which takes completion back (T27).
    expect(allowedRequestActions('system-owner', complete, 'o1')).toContain('replaceEmployer')
    expect(allowedRequestActions('system-owner', { ...complete, reviewStage: 'advanced' }, 'o1')).not.toContain('replaceEmployer')
  })
})

describe('document audience and policy', () => {
  it('keeps future workflow categories explicitly unsupported', () => {
    for (const category of ['rfp', 'supplementaryCaseFiles', 'boothPaymentReceipt'] as const) {
      expect(documentAudience(category)).toBe('unsupported')
    }
    expect(documentAudience('proposal')).toBe('case')
    expect(documentAudience('correspondenceAttachment')).toBe('case')
    expect(documentAudience('articlesOfAssociation')).toBe('company')
    expect(documentAudience('financialStatements')).toBe('financial')
  })

  it('accepts exactly the approved formats and the inclusive size boundary', () => {
    for (const [filename, mimeType, body] of [
      ['a.pdf', 'application/pdf', pdf()],
      ['a.doc', 'application/msword', word()],
      ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docx()],
    ] as const) {
      expect(validateDocumentFile({ category: 'proposal', filename, mimeType, body })).toMatchObject({ ok: true })
    }

    const exact = pdf(MAX_DOCUMENT_BYTES)
    expect(validateDocumentFile({ category: 'proposal', filename: 'exact.pdf', mimeType: 'application/pdf', body: exact })).toMatchObject({ ok: true })
    const over = pdf(MAX_DOCUMENT_BYTES + 1)
    expect(validateDocumentFile({ category: 'proposal', filename: 'over.pdf', mimeType: 'application/pdf', body: over })).toEqual({ ok: false, error: 'file_too_large' })
  })

  it('rejects images, spoofed extensions, mismatched MIME and empty content', () => {
    expect(validateDocumentFile({ category: 'proposal', filename: 'photo.jpg', mimeType: 'image/jpeg', body: Buffer.from('x') })).toEqual({ ok: false, error: 'invalid_file_type' })
    expect(validateDocumentFile({ category: 'proposal', filename: 'fake.pdf', mimeType: 'application/pdf', body: Buffer.from('not a pdf') })).toEqual({ ok: false, error: 'invalid_file_content' })
    expect(validateDocumentFile({ category: 'proposal', filename: 'a.pdf', mimeType: 'application/msword', body: pdf() })).toEqual({ ok: false, error: 'invalid_file_type' })
    expect(validateDocumentFile({ category: 'proposal', filename: 'a.pdf', mimeType: 'application/pdf', body: Buffer.alloc(0) })).toEqual({ ok: false, error: 'empty_file' })
    expect(validateDocumentFile({ category: 'not-a-category', filename: 'a.pdf', mimeType: 'application/pdf', body: pdf() })).toEqual({ ok: false, error: 'unsupported_category' })
  })

  it('does not invent a file-count cap and keeps multiple files independently valid', () => {
    const first = validateDocumentFile({ category: 'proposal', filename: 'one.pdf', mimeType: 'application/pdf', body: pdf() })
    const second = validateDocumentFile({ category: 'proposal', filename: 'two.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: docx() })
    expect(first.ok && second.ok).toBe(true)
  })

  it('strips path components from the display filename', () => {
    expect(safeOriginalFilename('../../etc/passwd.pdf')).toBe('passwd.pdf')
    expect(safeOriginalFilename('C:\\temp\\نام.pdf')).toBe('نام.pdf')
    expect(safeOriginalFilename('bad\u0000name.pdf')).toBeNull()
  })

  it('generates opaque storage keys and refuses path traversal', async () => {
    const storage = new PrivateDocumentStorage('.dsh-tmp/storage-unit-test')
    await storage.remove('../escape.pdf')
    const key = await storage.save(pdf(), '.pdf')
    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/)
    expect(await storage.read(key)).not.toBeNull()
    expect(await storage.read('../escape.pdf')).toBeNull()
    await storage.remove(key)
  })
})

describe('document read authority', () => {
  const financial = {
    category: 'financialStatements' as DocumentCategory,
    companyId: 'company-1',
    requestId: 'request-1',
    requestOwnerId: 'rep-1',
    requestCompanyId: 'company-1',
    assigned: true,
  }
  const proposal = { ...financial, category: 'proposal' as DocumentCategory }
  const companyDoc = {
    category: 'articlesOfAssociation' as DocumentCategory,
    companyId: 'company-1',
    requestId: null,
    requestOwnerId: null,
    requestCompanyId: null,
    assigned: false,
  }

  it('allows owner, Secretariat and the own representative to read financial files while investment handoff is absent', () => {
    expect(canReadDocument('system-owner', financial, 'o1', null)).toBe(true)
    expect(canReadDocument('central-secretariat', financial, 's1', null)).toBe(true)
    expect(canReadDocument('investment-reviewer', financial, 'i1', null)).toBe(false)
    expect(canReadDocument('representative', financial, 'rep-1', 'company-1')).toBe(true)
  })

  it('explicitly excludes chief, reviewer and employer reviewer from financial files', () => {
    for (const role of ['chief-reviewer', 'reviewer', 'employer-reviewer'] as const) {
      expect(canReadDocument(role, financial, 'x1', null)).toBe(false)
      expect(canReadDocument(role, proposal, 'x1', null)).toBe(true)
    }
  })

  it('denies other companies, unassigned staff and company-dossier files exposed through case assignment', () => {
    expect(canReadDocument('representative', financial, 'rep-2', 'company-2')).toBe(false)
    expect(canReadDocument('chief-reviewer', { ...proposal, assigned: false }, 'unassigned', null)).toBe(false)
    expect(canReadDocument('representative', companyDoc, 'rep-1', 'company-1')).toBe(true)
    for (const role of roles) {
      if (role === 'system-owner' || role === 'central-secretariat' || role === 'representative') continue
      expect(canReadDocument(role, companyDoc, 'x1', 'company-1')).toBe(false)
    }
  })

  it('allows draft-only owner upload/delete and denies reviewers upload entirely', () => {
    for (const role of ['chief-reviewer', 'reviewer', 'employer-reviewer', 'investment-reviewer'] as const) {
      expect(canUploadOwnedDocument(role, 'proposal', { requestOwnerId: 'rep-1', requestStatus: 'draft' }, 'rep-1', null)).toBe(false)
    }
    expect(canUploadOwnedDocument('representative', 'articlesOfAssociation', { companyId: 'company-1' }, 'rep-1', 'company-1')).toBe(true)
    expect(canUploadOwnedDocument('representative', 'articlesOfAssociation', { companyId: 'company-2' }, 'rep-1', 'company-1')).toBe(false)
    expect(canUploadOwnedDocument('representative', 'financialStatements', { requestOwnerId: 'rep-1', requestStatus: 'in_review' }, 'rep-1', 'company-1')).toBe(false)
    expect(canDeleteDocument('representative', { requestOwnerId: 'rep-1', requestStatus: 'draft' }, 'rep-1')).toBe(true)
    expect(canDeleteDocument('representative', { requestOwnerId: 'rep-1', requestStatus: 'in_review' }, 'rep-1')).toBe(false)
  })

  it('opens company financial files only after the chief advances the case (T29)', () => {
    const advanced = { requestOwnerId: 'rep-1', requestStatus: 'in_review', requestReviewStage: 'advanced' }
    expect(canUploadOwnedDocument('representative', 'financialStatements', advanced, 'rep-1', null)).toBe(true)
    expect(canUploadOwnedDocument('representative', 'proposal', advanced, 'rep-1', null)).toBe(false)
    expect(canDeleteDocument('representative', { ...advanced, category: 'financialStatements' }, 'rep-1')).toBe(true)
    expect(canDeleteDocument('representative', { ...advanced, category: 'proposal' }, 'rep-1')).toBe(false)
    for (const before of [
      { requestStatus: 'draft', requestReviewStage: null },
      { requestStatus: 'in_review', requestReviewStage: 'chief_triage' },
      { requestStatus: 'in_review', requestReviewStage: 'triaged' },
      { requestStatus: 'action_needed', requestReviewStage: 'chief_triage' },
      { requestStatus: 'rejected', requestReviewStage: 'chief_triage' },
    ]) {
      for (const category of FINANCIAL_CATEGORIES) {
        expect(canUploadOwnedDocument('representative', category, { requestOwnerId: 'rep-1', ...before }, 'rep-1', null)).toBe(false)
      }
    }
    expect(canUploadOwnedDocument('representative', 'financialStatements', { ...advanced, requestOwnerId: 'rep-2' }, 'rep-1', null)).toBe(false)
    expect(allowedRequestActions('representative', { ownerId: 'rep-1', status: 'in_review', reviewStage: 'advanced' }, 'rep-1')).toEqual(['read', 'uploadDocument', 'deleteDocument'])
    expect(allowedRequestActions('representative', { ownerId: 'rep-1', status: 'in_review', reviewStage: 'triaged' }, 'rep-1')).toEqual(['read'])
  })

  it('asks for every financial category exactly once (T29)', () => {
    expect(FINANCIAL_CHECKLIST.map((item) => item.category).sort()).toEqual([...FINANCIAL_CATEGORIES].sort())
  })

  it('reopens only proposal files when the chief returns an event case for correction (T21)', () => {
    const returned = { requestOwnerId: 'rep-1', requestStatus: 'action_needed', requestReviewStage: 'chief_triage' }
    expect(canUploadOwnedDocument('representative', 'proposal', returned, 'rep-1', null)).toBe(true)
    expect(canUploadOwnedDocument('representative', 'financialStatements', returned, 'rep-1', null)).toBe(false)
    expect(canDeleteDocument('representative', { ...returned, category: 'proposal' }, 'rep-1')).toBe(true)
    expect(canDeleteDocument('representative', { ...returned, category: 'financialStatements' }, 'rep-1')).toBe(false)
    expect(canDeleteDocument('representative', returned, 'rep-1')).toBe(false)
    // Drafts keep their existing all-category editing.
    expect(canDeleteDocument('representative', { requestOwnerId: 'rep-1', requestStatus: 'draft', category: 'financialStatements' }, 'rep-1')).toBe(true)
    // `action_needed` outside the chief correction is not a company edit state.
    for (const stage of [null, 'triaged']) {
      const other = { requestOwnerId: 'rep-1', requestStatus: 'action_needed', requestReviewStage: stage }
      expect(canUploadOwnedDocument('representative', 'proposal', other, 'rep-1', null)).toBe(false)
      expect(canDeleteDocument('representative', { ...other, category: 'proposal' }, 'rep-1')).toBe(false)
    }
  })
})
