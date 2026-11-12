import { extname } from 'node:path'

import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_POLICY_VERSION,
  DOCUMENT_SIZE_DISPLAY,
  MAX_DOCUMENT_BYTES,
  allowedDocumentTypes,
  isDocumentCategory,
  type DocumentCategory,
  type DocumentTypeRule,
} from '../access/policy.js'

export {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_POLICY_VERSION,
  DOCUMENT_SIZE_DISPLAY,
  MAX_DOCUMENT_BYTES,
}
export type { DocumentCategory, DocumentTypeRule }

export type DocumentValidationError =
  | 'unsupported_category'
  | 'invalid_file_type'
  | 'file_too_large'
  | 'empty_file'
  | 'invalid_file_content'
  | 'invalid_filename'

export interface ValidatedDocumentFile {
  category: DocumentCategory
  filename: string
  extension: DocumentTypeRule['extension']
  mimeType: string
  sizeBytes: number
  body: Buffer
}

export function safeOriginalFilename(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // Strip any path component supplied by the browser/proxy and keep only a
  // bounded, control-character-free display name. The stored identifier is
  // generated separately and never derives from this name.
  const base = value.replace(/\\/g, '/').split('/').pop()?.trim() ?? ''
  if (!base || base.length > 255 || /[\u0000-\u001f\u007f]/.test(base)) return null
  return base
}

function typeForFile(category: DocumentCategory, filename: string, mimeType: string): DocumentTypeRule | null {
  const extension = extname(filename).toLowerCase()
  return (
    allowedDocumentTypes(category).find(
      (rule) => rule.extension === extension && rule.mimeType === mimeType,
    ) ?? null
  )
}

function looksLikeDeclaredType(body: Buffer, rule: DocumentTypeRule): boolean {
  if (body.length < 4) return false
  switch (rule.extension) {
    case '.pdf':
      return body.subarray(0, 5).toString('ascii') === '%PDF-'
    case '.docx':
      return body[0] === 0x50 && body[1] === 0x4b && body[2] === 0x03 && body[3] === 0x04
    case '.doc':
      return (
        body[0] === 0xd0 &&
        body[1] === 0xcf &&
        body[2] === 0x11 &&
        body[3] === 0xe0 &&
        body[4] === 0xa1 &&
        body[5] === 0xb1 &&
        body[6] === 0x1a &&
        body[7] === 0xe1
      )
    case '.jpg':
    case '.jpeg':
      return body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff
    case '.png':
      return body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    case '.webp':
      return body.length >= 12 &&
        body.subarray(0, 4).toString('ascii') === 'RIFF' &&
        body.subarray(8, 12).toString('ascii') === 'WEBP'
  }
}

/**
 * Server-side validation of category, declared type, magic bytes and the
 * inclusive 10,000,000-byte boundary. Browser validation is never trusted.
 */
export function validateDocumentFile(input: {
  category: unknown
  filename: unknown
  mimeType: unknown
  body: Buffer
}): { ok: true; file: ValidatedDocumentFile } | { ok: false; error: DocumentValidationError } {
  if (!isDocumentCategory(input.category)) return { ok: false, error: 'unsupported_category' }
  const filename = safeOriginalFilename(input.filename)
  if (!filename) return { ok: false, error: 'invalid_filename' }
  if (input.body.length === 0) return { ok: false, error: 'empty_file' }
  if (input.body.length > MAX_DOCUMENT_BYTES) return { ok: false, error: 'file_too_large' }
  const mimeType = typeof input.mimeType === 'string' ? (input.mimeType.toLowerCase().split(';')[0]?.trim() ?? '') : ''
  const rule = typeForFile(input.category, filename, mimeType)
  if (!rule) return { ok: false, error: 'invalid_file_type' }
  if (!looksLikeDeclaredType(input.body, rule)) return { ok: false, error: 'invalid_file_content' }
  return {
    ok: true,
    file: {
      category: input.category,
      filename,
      extension: rule.extension,
      mimeType: rule.mimeType,
      sizeBytes: input.body.length,
      body: input.body,
    },
  }
}
