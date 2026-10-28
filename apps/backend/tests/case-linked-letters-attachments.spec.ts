import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'

import {
  canReadDocument,
  canUploadOwnedDocument,
  documentAudience,
  type DocumentForPolicy,
} from '../src/access/policy.js'
import { canSendLetter } from '../src/dashboard/letter-policy.js'
import { LetterRepository, type CreateLetterInput, type LetterAttachmentDto } from '../src/dashboard/letter-repo.js'

describe('T35 - Case-linked letters and private attachments policy', () => {
  const caseId = '00000000-0000-4000-8000-000000000001'
  const companyId = 'company-1'
  const otherCompanyId = 'company-2'

  describe('categories and audience', () => {
    it('supports correspondenceAttachment under case audience', () => {
      expect(documentAudience('correspondenceAttachment')).toBe('case')
    })

    it('classifies financialStatements under financial audience', () => {
      expect(documentAudience('financialStatements')).toBe('financial')
    })
  })

  describe('upload authority for correspondence attachments', () => {
    it('allows representative to upload correspondenceAttachment even when request is in_review', () => {
      expect(canUploadOwnedDocument(
        'representative',
        'correspondenceAttachment',
        { requestCompanyId: companyId, requestOwnerId: 'rep-1', requestStatus: 'in_review' },
        'rep-1',
        companyId,
      )).toBe(true)
    })

    it('denies another company from uploading to the request', () => {
      expect(canUploadOwnedDocument(
        'representative',
        'correspondenceAttachment',
        { requestCompanyId: companyId, requestOwnerId: 'rep-1', requestStatus: 'in_review' },
        'rep-2',
        otherCompanyId,
      )).toBe(false)
    })
  })

  describe('financial confidentiality and letter attachment privacy', () => {
    const financialDoc: DocumentForPolicy = {
      category: 'financialStatements',
      companyId,
      requestId: caseId,
      requestOwnerId: 'rep-1',
      requestCompanyId: companyId,
      assigned: true,
    }

    const correspondenceDoc: DocumentForPolicy = {
      category: 'correspondenceAttachment',
      companyId,
      requestId: caseId,
      requestOwnerId: 'rep-1',
      requestCompanyId: companyId,
      assigned: true,
    }

    it('allows system-owner, central-secretariat, and owning representative to read financial files', () => {
      expect(canReadDocument('system-owner', financialDoc, 'owner-1', null)).toBe(true)
      expect(canReadDocument('central-secretariat', financialDoc, 'sec-1', null)).toBe(true)
      expect(canReadDocument('representative', financialDoc, 'rep-1', companyId)).toBe(true)
    })

    it('denies assigned investment reviewer supplementary finance before a persisted handoff', () => {
      expect(canReadDocument('investment-reviewer', correspondenceDoc, 'inv-1', null)).toBe(false)
    })

    it('denies unassigned investment reviewer from reading correspondence attachments', () => {
      expect(canReadDocument('investment-reviewer', { ...correspondenceDoc, assigned: false }, 'inv-1', null)).toBe(false)
    })

    it('strictly denies chief, reviewer, and employer reviewer from reading financial files or correspondence attachments by assignment alone', () => {
      for (const role of ['chief-reviewer', 'reviewer', 'employer-reviewer'] as const) {
        expect(canReadDocument(role, financialDoc, 'rev-1', null)).toBe(false)
        expect(canReadDocument(role, correspondenceDoc, 'rev-1', null)).toBe(false)
      }
    })

    it('denies another company from reading financial files or correspondence attachments', () => {
      expect(canReadDocument('representative', financialDoc, 'rep-2', otherCompanyId)).toBe(false)
      expect(canReadDocument('representative', correspondenceDoc, 'rep-2', otherCompanyId)).toBe(false)
    })
  })

  describe('letter exchange between Secretariat and Company', () => {
    it('allows Secretariat to send case-linked letters to company representative', () => {
      expect(canSendLetter('central-secretariat', 'representative', true)).toBe(true)
    })

    it('allows Company representative to reply with case-linked letter to Secretariat', () => {
      expect(canSendLetter('representative', 'central-secretariat', true)).toBe(true)
    })
  })

  describe('LetterRepository attachment persistence', () => {
    const letterId = '00000000-0000-4000-8000-000000000002'
    const docId = '00000000-0000-4000-8000-000000000003'
    const sampleAttachment: LetterAttachmentDto = {
      id: docId,
      name: 'financial-evidence.pdf',
      filename: 'financial-evidence.pdf',
      category: 'correspondenceAttachment',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      size: '1 KB',
      downloadUrl: `/api/dashboard/documents/${docId}/download`,
    }

    it('persists attachments in LetterRepository.create', async () => {
      const query = vi.fn().mockResolvedValue({
        rows: [{
          id: letterId,
          type: 'official',
          title: 'پاسخ مدارک تکمیلی',
          body: 'پیوست تقدیم شد',
          sender_id: 'rep-1',
          sender_name: 'نماینده شرکت',
          sender_role: 'representative',
          recipient_id: 'sec-1',
          request_id: caseId,
          read: false,
          sent_at: new Date(),
          attachments: [sampleAttachment],
          created_at: new Date(),
          updated_at: new Date(),
        }],
      })
      const repo = new LetterRepository({ query } as unknown as Pool)
      const input: CreateLetterInput = {
        type: 'official',
        title: 'پاسخ مدارک تکمیلی',
        body: 'پیوست تقدیم شد',
        senderId: 'rep-1',
        senderName: 'نماینده شرکت',
        senderRole: 'representative',
        recipientId: 'sec-1',
        requestId: caseId,
        attachments: [sampleAttachment],
      }
      const created = await repo.create(input)
      expect(created.attachments).toEqual([sampleAttachment])
      expect(query).toHaveBeenCalledTimes(1)
      const [sql, params] = query.mock.calls[0]!
      expect(sql).toContain('attachments')
      expect(params).toContain(JSON.stringify([sampleAttachment]))
    })

    it('persists attachments in LetterRepository.createScoped', async () => {
      const query = vi.fn().mockResolvedValue({
        rows: [{
          id: letterId,
          type: 'official',
          title: 'پاسخ مدارک تکمیلی',
          body: 'پیوست تقدیم شد',
          sender_id: 'rep-1',
          sender_name: 'نماینده شرکت',
          sender_role: 'representative',
          recipient_id: 'sec-1',
          request_id: caseId,
          read: false,
          sent_at: new Date(),
          attachments: [sampleAttachment],
          created_at: new Date(),
          updated_at: new Date(),
        }],
      })
      const repo = new LetterRepository({ query } as unknown as Pool)
      const input: CreateLetterInput = {
        type: 'official',
        title: 'پاسخ مدارک تکمیلی',
        body: 'پیوست تقدیم شد',
        senderId: 'rep-1',
        senderName: 'نماینده شرکت',
        senderRole: 'representative',
        recipientId: 'sec-1',
        requestId: caseId,
        attachments: [sampleAttachment],
      }
      const created = await repo.createScoped(
        input,
        { kind: 'company', userId: 'rep-1', companyId },
        { kind: 'all' },
        false,
      )
      expect(created?.attachments).toEqual([sampleAttachment])
      expect(query).toHaveBeenCalledTimes(1)
      const [sql, params] = query.mock.calls[0]!
      expect(sql).toContain('attachments')
      expect(params).toContain(JSON.stringify([sampleAttachment]))
    })
  })
})
