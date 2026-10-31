'use client'

/**
 * Client seam for the private-document API. The server remains authoritative for
 * category, type, size, ownership and assignment; these checks only give fast
 * Persian feedback and never replace the response.
 */

import { DOCUMENT_CATEGORIES, documentCategoryLabel, type DocumentCategory } from './document-categories'

export const MAX_DOCUMENT_BYTES = 10_000_000
export const DOCUMENT_SIZE_MESSAGE = 'حداکثر ۱۰ مگابایت برای هر فایل'
export const DOCUMENT_FORMATS_MESSAGE = 'فقط PDF یا Word (doc / docx)'

export { DOCUMENT_CATEGORIES, documentCategoryLabel, type DocumentCategory }

export const DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export function formatDocumentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1000) return `${bytes.toLocaleString('fa-IR')} بایت`
  return `${(bytes / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} مگابایت`
}

export type LocalDocumentError = 'invalid_file_type' | 'file_too_large' | 'empty_file'

/** Fast local validation; the 10,000,000-byte boundary is inclusive. */
export function validateSelectedFile(file: File): LocalDocumentError | null {
  if (file.size === 0) return 'empty_file'
  if (file.size > MAX_DOCUMENT_BYTES) return 'file_too_large'
  const extension = file.name.toLowerCase().split('.').pop() ?? ''
  const expected = EXTENSION_MIME[extension]
  if (!expected) return 'invalid_file_type'
  if (file.type && file.type !== expected) return 'invalid_file_type'
  return null
}

export interface PrivateDocumentDto {
  id: string
  category: DocumentCategory
  filename: string
  mimeType: string
  sizeBytes: number
  logicalVersion: number
  requestId: string | null
  companyId: string | null
  uploaderId: string
  createdAt: string
  updatedAt: string
  allowedActions: ('download' | 'delete')[]
}

export type DocumentErrorCode =
  | LocalDocumentError
  | 'unsupported_category'
  | 'invalid_file_content'
  | 'invalid_filename'
  | 'invalid_category'
  | 'invalid_document_parent'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'document_unavailable'
  | 'request_not_draft'
  | 'upload_failed'

export class DocumentApiError extends Error {
  readonly status: number
  readonly code: DocumentErrorCode

  constructor(status: number, code: DocumentErrorCode) {
    super(code)
    this.name = 'DocumentApiError'
    this.status = status
    this.code = code
  }
}

export function documentErrorMessage(error: DocumentErrorCode | string | null | undefined): string {
  switch (error) {
    case 'invalid_file_type':
      return 'فرمت فایل مجاز نیست. فقط PDF یا Word (doc / docx) بارگذاری کنید.'
    case 'file_too_large':
      return `حجم فایل بیشتر از حد مجاز است. ${DOCUMENT_SIZE_MESSAGE}.`
    case 'empty_file':
      return 'فایل خالی قابل بارگذاری نیست.'
    case 'unsupported_category':
      return 'این دستهٔ مدرک در این مرحله فعال نشده است.'
    case 'invalid_file_content':
      return 'محتوای فایل با پسوند اعلام‌شده هم‌خوانی ندارد.'
    case 'invalid_filename':
      return 'نام فایل معتبر نیست. فایل را با نام دیگری دوباره انتخاب کنید.'
    case 'unauthorized':
      return 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.'
    case 'forbidden':
      return 'شما اجازهٔ انجام این عملیات را ندارید.'
    case 'not_found':
      return 'مدرک در دسترس نیست یا دسترسی شما لغو شده است.'
    case 'document_unavailable':
      return 'فایل مدرک در دسترس نیست. لطفاً با پشتیبانی تماس بگیرید.'
    case 'request_not_draft':
      return 'پس از ارسال درخواست، تغییر مدارک از این بخش ممکن نیست.'
    default:
      return 'بارگذاری مدرک انجام نشد. دوباره تلاش کنید.'
  }
}

function parseError(status: number, body: unknown): DocumentApiError {
  const code =
    body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : status === 401
        ? 'unauthorized'
        : status === 403
          ? 'forbidden'
          : status === 404
            ? 'not_found'
            : 'upload_failed'
  return new DocumentApiError(status, code as DocumentErrorCode)
}

async function documentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/dashboard${path}`, { cache: 'no-store', ...init })
  if (!response.ok) throw parseError(response.status, await response.json().catch(() => null))
  return (await response.json()) as T
}

export async function listDocuments(input: {
  requestId?: string
  companyId?: string
}): Promise<PrivateDocumentDto[]> {
  const params = new URLSearchParams()
  if (input.requestId) params.set('requestId', input.requestId)
  if (input.companyId) params.set('companyId', input.companyId)
  const result = await documentFetch<{ items: PrivateDocumentDto[] }>(`/documents?${params}`)
  return result.items
}

export interface UploadDocumentInput {
  file: File
  category: DocumentCategory
  requestId?: string
  companyId?: string
  logicalVersion?: number
}

/** XHR is used because `fetch` cannot report upload progress in browsers. */
export function uploadDocument(
  input: UploadDocumentInput,
  onProgress?: (percent: number) => void,
): Promise<PrivateDocumentDto> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.set('file', input.file)
    form.set('category', input.category)
    if (input.requestId) form.set('requestId', input.requestId)
    if (input.companyId) form.set('companyId', input.companyId)
    if (input.logicalVersion) form.set('logicalVersion', String(input.logicalVersion))

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/dashboard/documents')
    xhr.responseType = 'text'
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onerror = () => reject(new DocumentApiError(0, 'upload_failed'))
    xhr.onload = () => {
      let body: unknown = null
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const document = (body as { document?: PrivateDocumentDto } | null)?.document
        if (document) resolve(document)
        else reject(new DocumentApiError(xhr.status, 'upload_failed'))
        return
      }
      reject(parseError(xhr.status, body))
    }
    xhr.send(form)
  })
}

export async function downloadDocument(id: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`/api/dashboard/documents/${encodeURIComponent(id)}/download`, {
    cache: 'no-store',
  })
  if (!response.ok) throw parseError(response.status, await response.json().catch(() => null))
  const disposition = response.headers.get('content-disposition') ?? ''
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
  const fallback = /filename="([^"]+)"/i.exec(disposition)?.[1]
  return {
    blob: await response.blob(),
    filename: encoded ? decodeURIComponent(encoded) : fallback ?? 'document',
  }
}

export async function deleteDocument(id: string): Promise<void> {
  await documentFetch<{ success: boolean }>(`/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
