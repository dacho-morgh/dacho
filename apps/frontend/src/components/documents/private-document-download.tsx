'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  DocumentApiError,
  documentDownloadErrorMessage,
  downloadDocument,
  downloadFromAuthorizedPath,
  saveDownloadedFile,
} from '@/utilities/document-api'

export type PrivateDocumentDownloadSource =
  | { documentId: string; path?: never }
  | { path: string; documentId?: never }

export type PrivateDocumentDownloadProps = PrivateDocumentDownloadSource & {
  /** Display name only; the saved name comes from the authorized response. */
  filename: string
  label?: string
  disabled?: boolean
  /** `primary` is the filled 40px button of a file row (Figma 32315:43019); the default is the compact outline one. */
  emphasis?: 'default' | 'primary'
}

/**
 * Shared authorized download control. Bytes are fetched through the
 * same-origin dashboard proxy, which re-checks access on every request; a
 * denied, expired or revoked request shows Persian feedback and never falls
 * back to a public media URL or exposes a storage path.
 */
export function PrivateDocumentDownload({ filename, label = 'دانلود', disabled = false, emphasis = 'default', ...source }: PrivateDocumentDownloadProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const download = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setSessionExpired(false)
    try {
      const result = source.documentId !== undefined
        ? await downloadDocument(source.documentId)
        : await downloadFromAuthorizedPath(source.path)
      if (mounted.current) saveDownloadedFile(result.blob, result.filename)
    } catch (cause) {
      if (!mounted.current) return
      const code = cause instanceof DocumentApiError ? cause.code : null
      if (cause instanceof DocumentApiError && cause.status === 401) setSessionExpired(true)
      setError(documentDownloadErrorMessage(code))
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant={emphasis === 'primary' ? 'primary' : 'outline-primary'}
        size={emphasis === 'primary' ? '40' : '32'}
        disabled={disabled || busy}
        aria-busy={busy}
        aria-label={`${label} ${filename}`}
        onClick={() => void download()}
      >
        <Typography as="span" variant={emphasis === 'primary' ? '16/semibold' : '12/semibold'} className="text-inherit">
          {busy ? 'در حال دریافت…' : label}
        </Typography>
      </Button>
      {error ? (
        <Typography role="alert" variant="12/regular" color="error" className="max-w-full text-right">
          {error}
          {sessionExpired ? (
            <>
              {' '}
              <Link href="/login?next=/dashboard" className="underline">
                ورود دوباره
              </Link>
            </>
          ) : null}
        </Typography>
      ) : null}
    </div>
  )
}
