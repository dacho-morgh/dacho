// @vitest-environment jsdom

import { fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
