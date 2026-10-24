// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DocumentApiError, type PrivateDocumentDto } from '@/utilities/document-api'

const { listDocuments, uploadDocument } = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  uploadDocument: vi.fn(),
}))

vi.mock('@/utilities/document-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utilities/document-api')>()
  return { ...actual, listDocuments, uploadDocument }
})

import { PrivateDocumentField } from '@/components/documents/private-document-field'

const document: PrivateDocumentDto = {
  id: 'doc-1',
  category: 'proposal',
  filename: 'proposal.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1200,
  logicalVersion: 1,
  requestId: 'request-1',
  companyId: null,
  uploaderId: 'rep-1',
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
  allowedActions: ['download'],
}

function pdf(name = 'proposal.pdf'): File {
  return new File([new Uint8Array(64)], name, { type: 'application/pdf' })
}

describe('PrivateDocumentField states', () => {
  afterEach(cleanup)

  beforeEach(() => {
    listDocuments.mockReset()
    uploadDocument.mockReset()
    listDocuments.mockResolvedValue([])
  })

  it('shows approved formats/size and keeps a required field unready until a document exists', async () => {
    const onReadyChange = vi.fn()
    const { container, getByText } = render(
      createElement(PrivateDocumentField, {
        category: 'proposal',
        label: 'پروپوزال',
        requestId: 'request-1',
        required: true,
        onReadyChange,
      }),
    )

    expect(getByText(/PDF یا Word/)).toBeTruthy()
    expect(getByText(/۱۰ مگابایت برای هر فایل/)).toBeTruthy()
    await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith(false))
    expect(container.querySelector('input[type="file"]')?.hasAttribute('multiple')).toBe(true)
  })

  it('rejects an image locally and never sends it to the API', async () => {
    const { container, findByText } = render(
      createElement(PrivateDocumentField, { category: 'proposal', requestId: 'request-1' }),
    )
    await waitFor(() => expect(listDocuments).toHaveBeenCalled())
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(32)], 'photo.png', { type: 'image/png' })] },
    })
    expect(await findByText(/فرمت فایل مجاز نیست/)).toBeTruthy()
    expect(uploadDocument).not.toHaveBeenCalled()
  })

  it('reports upload progress, blocks final readiness while pending, then lists the authorized document', async () => {
    let resolveUpload: ((value: PrivateDocumentDto) => void) | undefined
    uploadDocument.mockImplementation(
      (_input, onProgress: (percent: number) => void) =>
        new Promise<PrivateDocumentDto>((resolve) => {
          onProgress(40)
          resolveUpload = resolve
        }),
    )
    const onPendingChange = vi.fn()
    const onReadyChange = vi.fn()
    const { container, findByText } = render(
      createElement(PrivateDocumentField, {
        category: 'proposal',
        requestId: 'request-1',
        required: true,
        onPendingChange,
        onReadyChange,
      }),
    )
    await waitFor(() => expect(listDocuments).toHaveBeenCalled())

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [pdf()] } })

    await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(true))
    expect(onReadyChange).toHaveBeenLastCalledWith(false)
    expect(await findByText('تا پایان بارگذاری، ثبت نهایی درخواست غیرفعال است.')).toBeTruthy()

    resolveUpload?.(document)
    await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(false))
    expect(onReadyChange).toHaveBeenLastCalledWith(true)
    expect(await findByText('proposal.pdf')).toBeTruthy()
  })

  it('filters mixed categories and versions, then ignores an upload batch after its parent changes', async () => {
    listDocuments.mockResolvedValueOnce([
      document,
      { ...document, id: 'proposal-v2', filename: 'proposal-v2.pdf', logicalVersion: 2 },
      { ...document, id: 'finance', filename: 'finance.pdf', category: 'financialStatements' },
    ])
    const onDocumentsChange = vi.fn()
    const view = render(createElement(PrivateDocumentField, {
      category: 'proposal', requestId: 'request-1', logicalVersion: 2, onDocumentsChange,
    }))
    expect(await view.findByText('proposal-v2.pdf')).toBeTruthy()
    expect(view.queryByText('proposal.pdf')).toBeNull()
    expect(view.queryByText('finance.pdf')).toBeNull()
    await waitFor(() => expect(onDocumentsChange).toHaveBeenLastCalledWith([
      { ...document, id: 'proposal-v2', filename: 'proposal-v2.pdf', logicalVersion: 2 },
    ]))

    let resolveUpload: ((value: PrivateDocumentDto) => void) | undefined
    uploadDocument.mockImplementationOnce(() => new Promise((resolve) => { resolveUpload = resolve }))
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [pdf('first.pdf'), pdf('second.pdf')] } })
    await waitFor(() => expect(uploadDocument).toHaveBeenCalledTimes(1))
    view.rerender(createElement(PrivateDocumentField, { category: 'proposal', requestId: 'request-2' }))
    resolveUpload?.({ ...document, requestId: 'request-1', filename: 'first.pdf' })
    await waitFor(() => expect(view.queryByText('first.pdf')).toBeNull())
    expect(uploadDocument).toHaveBeenCalledTimes(1)
    expect(view.queryByText('second.pdf')).toBeNull()
  })

  it('does not mark a required proposal ready when only a financial document exists', async () => {
    listDocuments.mockResolvedValueOnce([
      { ...document, id: 'finance-only', filename: 'finance.pdf', category: 'financialStatements' },
    ])
    const onReadyChange = vi.fn()
    const view = render(createElement(PrivateDocumentField, {
      category: 'proposal', requestId: 'request-1', required: true, onReadyChange,
    }))

    await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith(false))
    expect(view.queryByText('finance.pdf')).toBeNull()
    expect(view.getByText('هنوز مدرکی بارگذاری نشده است.')).toBeTruthy()
  })

  it('maps a denied list to an explicit no-access message and an expired session to re-login', async () => {
    listDocuments.mockRejectedValueOnce(new DocumentApiError(404, 'not_found'))
    const denied = render(createElement(PrivateDocumentField, { category: 'proposal', requestId: 'request-1' }))
    expect(await denied.findByText(/دسترسی شما لغو شده/)).toBeTruthy()
    denied.unmount()

    listDocuments.mockRejectedValueOnce(new DocumentApiError(401, 'unauthorized'))
    const expired = render(createElement(PrivateDocumentField, { category: 'proposal', requestId: 'request-1' }))
    expect(await expired.findByText(/نشست شما منقضی شده است/)).toBeTruthy()
    expect(expired.container.querySelector('a[href^="/login"]')).toBeTruthy()
  })
})
