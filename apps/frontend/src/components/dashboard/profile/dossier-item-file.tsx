'use client'

import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileInput, SelectedFile } from '@/components/ui/file-input'
import { Typography } from '@/components/ui/typography'
import {
  deleteDocument,
  documentAccept,
  documentErrorMessage,
  documentFormatsMessage,
  DOCUMENT_SIZE_MESSAGE,
  downloadDocument,
  saveDownloadedFile,
  uploadDocument,
  validateSelectedFile,
  DocumentApiError,
  type DocumentCategory,
} from '@/utilities/document-api'

/** A file attached to one product or certificate: its private document id and name. */
export interface DossierItemFileValue {
  documentId: string
  filename: string
  sizeBytes: number
}

interface DossierItemFilePickerProps {
  category: DocumentCategory
  companyId?: string | null
  label: string
  value: DossierItemFileValue | null
  disabled?: boolean
  onChange: (value: DossierItemFileValue | null) => void
  onPendingChange?: (pending: boolean) => void
}

/**
 * One optional file (PDF, Word or image) for a dossier item, uploaded as soon as
 * it is chosen so the item can be saved with the file's document id.
 */
export function DossierItemFilePicker({
  category,
  companyId,
  label,
  value,
  disabled = false,
  onChange,
  onPendingChange,
}: DossierItemFilePickerProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const uploading = progress !== null

  const choose = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    const localError = validateSelectedFile(file, category)
    if (localError) {
      setError(localError === 'invalid_file_type'
        ? `فرمت فایل مجاز نیست. ${documentFormatsMessage(category)} بارگذاری کنید.`
        : documentErrorMessage(localError))
      return
    }
    if (!companyId) {
      setError('بارگذاری فایل پیش از ثبت شرکت ممکن نیست.')
      return
    }
    setProgress(0)
    onPendingChange?.(true)
    try {
      const document = await uploadDocument({ file, category, companyId }, setProgress)
      // A file chosen earlier in this dialog is replaced, so it is not left behind.
      if (value) void deleteDocument(value.documentId).catch(() => undefined)
      onChange({ documentId: document.id, filename: document.filename, sizeBytes: document.sizeBytes })
    } catch (cause) {
      setError(documentErrorMessage(cause instanceof DocumentApiError ? cause.code : 'upload_failed'))
    } finally {
      setProgress(null)
      onPendingChange?.(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = () => {
    if (!value) return
    void deleteDocument(value.documentId).catch(() => undefined)
    onChange(null)
  }

  return (
    <div data-slot="dossier-item-file" className="flex flex-col gap-2 text-start">
      <Typography as="label" htmlFor={inputId} variant="16/regular" color="neutral-600">
        {label}
      </Typography>
      <Typography variant="12/regular" color="neutral-500">
        {documentFormatsMessage(category)} · {DOCUMENT_SIZE_MESSAGE}
      </Typography>
      {value ? (
        <SelectedFile
          file={{ name: value.filename, size: value.sizeBytes }}
          disabled={disabled || uploading}
          onRemove={remove}
        />
      ) : (
        <FileInput
          ref={inputRef}
          id={inputId}
          accept={documentAccept(category)}
          disabled={disabled || uploading || !companyId}
          aria-invalid={error ? true : undefined}
          onChange={(event) => void choose(event.target.files?.[0])}
        />
      )}
      {uploading ? (
        <Typography role="status" variant="12/regular" color="neutral-500">
          در حال بارگذاری… {(progress ?? 0).toLocaleString('fa-IR')}٪
        </Typography>
      ) : null}
      {error ? (
        <Typography role="alert" variant="12/regular" color="error">
          {error}
        </Typography>
      ) : null}
    </div>
  )
}

/** Downloads an item's attached file through the access-checked document route. */
export function DossierItemFileLink({ documentId, label }: { documentId: string; label: string }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const open = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const { blob, filename } = await downloadDocument(documentId)
      saveDownloadedFile(blob, filename)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" variant="link" size="clear" loading={busy} onClick={() => void open()}>
        {label}
      </Button>
      {failed ? (
        <Typography as="span" role="alert" variant="12/regular" color="error">
          دریافت فایل انجام نشد.
        </Typography>
      ) : null}
    </span>
  )
}
