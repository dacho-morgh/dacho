import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  DOCUMENT_ACCEPT,
  DOCUMENT_CATEGORIES,
  DOCUMENT_SIZE_MESSAGE,
  IMAGE_DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
  documentAccept,
  documentCategoryLabel,
  documentFormatsMessage,
  type DocumentCategory,
  documentErrorMessage,
  formatDocumentSize,
  validateSelectedFile,
} from '@/utilities/document-api'

const approved = JSON.parse(
  readFileSync(join(process.cwd(), '../../docs/system/document-policy.json'), 'utf8'),
) as {
  allowedFileTypes: { extension: string; mimeType: string }[]
  maxFileBytes: number
  multipleFilesPerField: boolean
  maxFilesPerField: number | null
  imagesAllowed: boolean
  imageFileTypes: { extension: string; mimeType: string }[]
  imageCategories: string[]
  categories: string[]
}

function file(name: string, type: string, size: number): File {
  const content = new Uint8Array(size)
  return new File([content], name, { type })
}

describe('FE07 private document policy matches the approved contract', () => {
  it('uses exactly the approved categories and formats', () => {
    expect([...DOCUMENT_CATEGORIES].sort()).toEqual([...approved.categories].sort())
    for (const type of approved.allowedFileTypes) {
      expect(DOCUMENT_ACCEPT).toContain(type.extension)
      expect(DOCUMENT_ACCEPT).toContain(type.mimeType)
    }
    expect(approved.multipleFilesPerField).toBe(true)
    expect(approved.maxFilesPerField).toBeNull()
    expect(approved.imagesAllowed).toBe(false)
  })

  it('enforces the inclusive 10,000,000-byte boundary and rejects images', () => {
    expect(MAX_DOCUMENT_BYTES).toBe(approved.maxFileBytes)
    expect(validateSelectedFile(file('ok.pdf', 'application/pdf', approved.maxFileBytes))).toBeNull()
    expect(validateSelectedFile(file('large.pdf', 'application/pdf', approved.maxFileBytes + 1))).toBe('file_too_large')
    expect(validateSelectedFile(file('empty.pdf', 'application/pdf', 0))).toBe('empty_file')
    expect(validateSelectedFile(file('photo.png', 'image/png', 100))).toBe('invalid_file_type')
    expect(validateSelectedFile(file('sheet.pdf', 'application/msword', 100))).toBe('invalid_file_type')
    expect(validateSelectedFile(file('ok.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 100))).toBeNull()
  })

  it('accepts photos only in the approved image categories', () => {
    expect([...IMAGE_DOCUMENT_CATEGORIES].sort()).toEqual([...approved.imageCategories].sort())
    for (const category of approved.imageCategories as DocumentCategory[]) {
      for (const type of approved.imageFileTypes) {
        expect(documentAccept(category)).toContain(type.extension)
        expect(validateSelectedFile(file(`photo${type.extension}`, type.mimeType, 100), category)).toBeNull()
      }
      expect(validateSelectedFile(file('ok.pdf', 'application/pdf', 100), category)).toBeNull()
      expect(validateSelectedFile(file('photo.gif', 'image/gif', 100), category)).toBe('invalid_file_type')
      expect(documentFormatsMessage(category)).toContain('عکس')
    }
    expect(validateSelectedFile(file('photo.png', 'image/png', 100), 'catalogues')).toBe('invalid_file_type')
    expect(documentAccept('catalogues')).toBe(DOCUMENT_ACCEPT)
  })

  it('provides stable Persian messages for denied/expired/validation states', () => {
    expect(DOCUMENT_SIZE_MESSAGE).toContain('۱۰ مگابایت')
    expect(documentErrorMessage('invalid_file_type')).toContain('PDF')
    expect(documentErrorMessage('unsupported_category')).toContain('فعال نشده')
    expect(documentErrorMessage('unauthorized')).toContain('منقضی')
    expect(documentErrorMessage('not_found')).toContain('دسترسی')
    expect(documentCategoryLabel('financialStatements')).toBe('صورت‌های مالی')
    expect(formatDocumentSize(10_000_000)).toContain('۱۰')
  })
})
