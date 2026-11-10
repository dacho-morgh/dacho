'use client'

import Link from 'next/link'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { PrivateDocumentDownload } from '@/components/documents/private-document-download'
import { DashboardCloseCircle } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { RequiredMark } from '@/components/ui/field'
import { Typography } from '@/components/ui/typography'
import {
  documentAccept,
  documentFormatsMessage,
  DOCUMENT_SIZE_MESSAGE,
  DocumentApiError,
  DocumentUploadCancelled,
  documentCategoryLabel,
  documentErrorMessage,
  deleteDocument,
  formatDocumentSize,
  listDocuments,
  uploadDocument,
  validateSelectedFile,
  type DocumentCategory,
  type DocumentErrorCode,
  type PrivateDocumentDto,
} from '@/utilities/document-api'

interface PendingUpload {
  key: string
  name: string
  progress: number
  error: DocumentErrorCode | null
  file: File
}

export interface PrivateDocumentFieldProps {
  category: DocumentCategory
  label?: string
  description?: string
  requestId?: string
  companyId?: string
  logicalVersion?: number
  /** A financial statement's year: uploads carry it and only that year's files are listed. */
  statementYear?: number
  required?: boolean
  disabled?: boolean
  canUpload?: boolean
  canDelete?: boolean
  /** For a role that only reads: no upload control or upload guidance at all. */
  readOnly?: boolean
  /**
   * Attachment mode (e.g. a letter being composed): existing parent files are
   * not listed; only files uploaded through this control in this session are
   * shown, and they can be detached locally without deleting server bytes.
   */
  sessionOnly?: boolean
  onPendingChange?: (pending: boolean) => void
  onReadyChange?: (ready: boolean) => void
  onDocumentsChange?: (documents: PrivateDocumentDto[]) => void
}

/**
 * Shared private-file control. Uploads are sequential so progress, retry and
 * the pending-upload guard stay understandable; multiple files may still
 * coexist on the same logical field. Every byte/metadata operation is
 * re-authorized by the backend.
 */
export function PrivateDocumentField({
  category,
  label,
  description,
  requestId,
  companyId,
  logicalVersion,
  statementYear,
  required = false,
  disabled = false,
  canUpload = true,
  canDelete = false,
  readOnly = false,
  sessionOnly = false,
  onPendingChange,
  onReadyChange,
  onDocumentsChange,
}: PrivateDocumentFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const keyCounter = useRef(0)
  // One AbortController per in-flight upload so the user can cancel it.
  const controllers = useRef(new Map<string, AbortController>())
  const callbacks = useRef({ onPendingChange, onReadyChange, onDocumentsChange })
  const scopeKey = `${requestId ?? ''}|${companyId ?? ''}|${category}|${logicalVersion ?? ''}|${statementYear ?? ''}`
  const scopeKeyRef = useRef(scopeKey)
  useEffect(() => {
    scopeKeyRef.current = scopeKey
  }, [scopeKey])
  useEffect(() => {
    callbacks.current = { onPendingChange, onReadyChange, onDocumentsChange }
  }, [onDocumentsChange, onPendingChange, onReadyChange])
  const nextKey = (file: File) =>
    `${file.name}-${file.size}-${file.lastModified}-${keyCounter.current++}`

  const [documents, setDocuments] = useState<PrivateDocumentDto[]>([])
  const [uploads, setUploads] = useState<PendingUpload[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [listDenied, setListDenied] = useState(false)

  const pending = uploads.some((upload) => upload.error === null)
  const hasParent = Boolean(requestId || companyId)
  const uploadAllowed = canUpload && !disabled && hasParent
  const scopedDocuments = useMemo(() => documents.filter((document) =>
    document.category === category &&
    (requestId ? document.requestId === requestId : document.requestId === null && document.companyId === companyId) &&
    (logicalVersion === undefined || document.logicalVersion === logicalVersion) &&
    (statementYear === undefined || document.statementYear === statementYear),
  ), [documents, category, companyId, logicalVersion, requestId, statementYear])

  useEffect(() => {
    const inFlight = controllers.current
    return () => {
      for (const controller of inFlight.values()) controller.abort()
      inFlight.clear()
    }
  }, [])

  useEffect(() => {
    let active = true
    // Pending uploads belong to the old parent/category/version scope.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUploads([])
    setError(null)
    setSessionExpired(false)
    setListDenied(false)
    if (sessionOnly) setDocuments([])
    if (!hasParent || sessionOnly) return () => { active = false }

    setLoading(true)
    listDocuments({ requestId, companyId })
      .then((items) => {
        if (active) setDocuments(items.filter((document) =>
          document.category === category &&
          (requestId ? document.requestId === requestId : document.requestId === null && document.companyId === companyId) &&
          (logicalVersion === undefined || document.logicalVersion === logicalVersion),
        ))
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DocumentApiError) {
          if (cause.status === 401) setSessionExpired(true)
          else if (cause.status === 403) setListDenied(true)
          else setError(documentErrorMessage(cause.code))
        } else {
          setError(documentErrorMessage('upload_failed'))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [category, companyId, hasParent, logicalVersion, requestId, sessionOnly])

  useEffect(() => {
    callbacks.current.onPendingChange?.(pending)
    callbacks.current.onReadyChange?.(!pending && (!required || scopedDocuments.length > 0))
    callbacks.current.onDocumentsChange?.(scopedDocuments)
  }, [scopedDocuments, pending, required])

  const report = (cause: unknown) => {
    if (cause instanceof DocumentApiError) {
      if (cause.status === 401) setSessionExpired(true)
      setError(documentErrorMessage(cause.code))
      return cause.code
    }
    setError(documentErrorMessage('upload_failed'))
    return 'upload_failed' as const
  }

  const uploadOne = async (file: File, uploadScope = scopeKey) => {
    const key = nextKey(file)
    const controller = new AbortController()
    controllers.current.set(key, controller)
    setUploads((current) => [...current, { key, name: file.name, progress: 0, error: null, file }])

    try {
      const document = await uploadDocument(
        { file, category, requestId, companyId, logicalVersion, statementYear },
        (progress) => {
          if (scopeKeyRef.current !== uploadScope) return
          setUploads((current) =>
            current.map((upload) => (upload.key === key ? { ...upload, progress } : upload)),
          )
        },
        controller.signal,
      )
      if (scopeKeyRef.current === uploadScope && document.category === category && (logicalVersion === undefined || document.logicalVersion === logicalVersion)) {
        setDocuments((current) => [...current, document])
        setUploads((current) => current.filter((upload) => upload.key !== key))
      } else if (scopeKeyRef.current === uploadScope) {
        setUploads((current) => current.filter((upload) => upload.key !== key))
      }
      if (scopeKeyRef.current === uploadScope) setError(null)
    } catch (cause) {
      // Cancelled by the user: the row was already removed, so nothing else to show.
      if (cause instanceof DocumentUploadCancelled) return
      if (scopeKeyRef.current !== uploadScope) return
      const code = report(cause)
      setUploads((current) =>
        current.map((upload) => (upload.key === key ? { ...upload, error: code } : upload)),
      )
    } finally {
      controllers.current.delete(key)
    }
  }

  /** Cancels an in-flight upload, or dismisses one that already failed. */
  const cancelUpload = (upload: PendingUpload) => {
    controllers.current.get(upload.key)?.abort()
    setUploads((current) => current.filter((item) => item.key !== upload.key))
  }

  const retry = async (upload: PendingUpload) => {
    setUploads((current) => current.filter((item) => item.key !== upload.key))
    await uploadOne(upload.file)
  }

  const chooseFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const batchScope = scopeKeyRef.current
    setError(null)
    const selected = Array.from(files)
    for (const file of selected) {
      if (scopeKeyRef.current !== batchScope) return
      const localError = validateSelectedFile(file, category)
      if (localError) {
        setUploads((current) => [
          ...current,
          {
            key: nextKey(file),
            name: file.name,
            progress: 0,
            error: localError,
            file,
          },
        ])
        continue
      }
      await uploadOne(file, batchScope)
    }
  }

  const detach = (document: PrivateDocumentDto) =>
    setDocuments((current) => current.filter((item) => item.id !== document.id))

  const remove = async (document: PrivateDocumentDto) => {
    if (!window.confirm('این مدرک حذف شود؟')) return
    setError(null)
    try {
      await deleteDocument(document.id)
      setDocuments((current) => current.filter((item) => item.id !== document.id))
    } catch (cause) {
      report(cause)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-background p-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography as="h3" variant="16/semibold" color="neutral-700">
          {label ?? documentCategoryLabel(category)}
          {required ? <RequiredMark className="ms-1" /> : null}
        </Typography>
        {readOnly ? null : (
          <Typography variant="12/regular" color="neutral-500">
            {documentFormatsMessage(category)} · {DOCUMENT_SIZE_MESSAGE}
          </Typography>
        )}
      </div>

      {description ? (
        <Typography variant="12/regular" color="neutral-500">
          {description}
        </Typography>
      ) : null}
      {readOnly ? null : (
        <Typography variant="12/light" color="neutral-400">
          امکان بارگذاری چند فایل در همین فیلد وجود دارد؛ هر فایل جداگانه اعتبارسنجی می‌شود.
        </Typography>
      )}

      {sessionExpired ? (
        <Typography role="alert" variant="14/regular" color="error" className="rounded-lg bg-error-50 p-3">
          نشست شما منقضی شده است.{' '}
          <Link href="/login?next=/dashboard" className="underline">
            ورود دوباره
          </Link>
        </Typography>
      ) : null}

      {listDenied ? (
        <Typography role="status" variant="14/regular" color="neutral-500" className="rounded-lg bg-neutral-50 p-3">
          دسترسی به مدارک این بخش برای شما مجاز نیست.
        </Typography>
      ) : null}

      {loading ? (
        <Typography role="status" variant="12/regular" color="neutral-500">
          در حال دریافت مدارک…
        </Typography>
      ) : null}

      {!loading && !hasParent && !listDenied ? (
        <Typography role="status" variant="12/regular" color="neutral-500">
          ابتدا پیش‌نویس درخواست را ایجاد کنید تا بارگذاری مدرک ممکن شود.
        </Typography>
      ) : null}

      {scopedDocuments.length === 0 && !loading && !listDenied && hasParent ? (
        <Typography variant="14/regular" color="neutral-400">
          {sessionOnly ? 'هنوز فایلی پیوست نشده است.' : 'هنوز مدرکی بارگذاری نشده است.'}
        </Typography>
      ) : null}

      {scopedDocuments.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="مدارک بارگذاری‌شده">
          {scopedDocuments.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <Typography variant="14/semibold" color="neutral-700" className="truncate">
                  <bdi dir="auto">{document.filename}</bdi>
                </Typography>
                <Typography variant="12/light" color="neutral-400">
                  {formatDocumentSize(document.sizeBytes)} · نسخهٔ {document.logicalVersion.toLocaleString('fa-IR')}
                </Typography>
              </div>
              <div className="flex flex-wrap items-start gap-1">
                {document.allowedActions.includes('download') ? (
                  <PrivateDocumentDownload documentId={document.id} filename={document.filename} />
                ) : null}
                {sessionOnly || (canDelete && document.allowedActions.includes('delete')) ? (
                  <Button
                    type="button"
                    variant="text-gray"
                    size="icon-32"
                    aria-label={
                      sessionOnly ? `حذف ${document.filename} از پیوست‌ها` : `حذف ${document.filename}`
                    }
                    onClick={() => (sessionOnly ? detach(document) : remove(document))}
                  >
                    <DashboardCloseCircle aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {uploads.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="بارگذاری‌های در جریان">
          {uploads.map((upload) => (
            <li key={upload.key} className="flex flex-col gap-1 rounded-lg bg-neutral-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography variant="12/semibold" color="neutral-600" className="truncate">
                  <bdi dir="auto">{upload.name}</bdi>
                </Typography>
                {upload.error ? (
                  <div className="flex items-center gap-2">
                    <Typography role="alert" variant="12/regular" color="error">
                      {documentErrorMessage(upload.error)}
                    </Typography>
                    <Button type="button" variant="outline-gray" size="32" onClick={() => retry(upload)}>
                      <Typography variant="12/semibold" className="text-inherit">
                        تلاش دوباره
                      </Typography>
                    </Button>
                    <Button
                      type="button"
                      variant="text-gray"
                      size="icon-32"
                      aria-label={`حذف ${upload.name} از فهرست`}
                      onClick={() => cancelUpload(upload)}
                    >
                      <DashboardCloseCircle aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Typography role="status" variant="12/regular" color="neutral-500">
                      {upload.progress.toLocaleString('fa-IR')}٪
                    </Typography>
                    <Button
                      type="button"
                      variant="text-gray"
                      size="icon-32"
                      aria-label={`لغو بارگذاری ${upload.name}`}
                      onClick={() => cancelUpload(upload)}
                    >
                      <DashboardCloseCircle aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
              {!upload.error ? (
                <div
                  role="progressbar"
                  aria-label={`پیشرفت بارگذاری ${upload.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={upload.progress}
                  className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
                >
                  <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${upload.progress}%` }} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {readOnly ? null : <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={documentAccept(category)}
          multiple
          disabled={!uploadAllowed || pending}
          onChange={(event) => {
            void chooseFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline-gray"
          size="40"
          disabled={!uploadAllowed || pending}
          onClick={() => inputRef.current?.click()}
        >
          <Typography variant="14/regular" className="text-inherit">
            انتخاب فایل‌ها
          </Typography>
        </Button>
        {!uploadAllowed && !disabled ? (
          <Typography variant="12/regular" color="neutral-500">
            {!hasParent
              ? 'پس از ایجاد پیش‌نویس امکان بارگذاری فراهم می‌شود.'
              : 'در وضعیت فعلی امکان افزودن مدرک نیست.'}
          </Typography>
        ) : null}
      </div>}

      {pending ? (
        <Typography role="status" variant="12/regular" color="neutral-500">
          {sessionOnly ? 'تا پایان بارگذاری، ارسال غیرفعال است.' : 'تا پایان بارگذاری، ثبت نهایی درخواست غیرفعال است.'}
        </Typography>
      ) : null}

      {error ? (
        <Typography role="alert" variant="14/regular" color="error" className="rounded-lg bg-error-50 p-3">
          {error}
        </Typography>
      ) : null}
    </section>
  )
}
