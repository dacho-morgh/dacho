// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrivateDocumentDto } from '@/utilities/document-api'

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))

const { listDocuments, uploadDocument } = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  uploadDocument: vi.fn(),
}))
vi.mock('@/utilities/document-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utilities/document-api')>()
  return { ...actual, listDocuments, uploadDocument }
})

import { NewLetterForm } from '@/components/dashboard/new-letter-form'
import { MailDetailView } from '@/components/dashboard/mail-detail-view'
import { PrivateDocumentDownload } from '@/components/documents/private-document-download'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { mapLetterAttachments, mapMailData, type LetterDto } from '@/utilities/dashboard-api'
import {
  downloadFromAuthorizedPath,
  isAuthorizedDownloadPath,
  letterAttachmentDownloadPath,
} from '@/utilities/document-api'

const DOC_ID = '11111111-1111-4111-8111-111111111111'
const LETTER_ID = '22222222-2222-4222-8222-222222222222'
const CASE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_CASE_ID = '44444444-4444-4444-8444-444444444444'

const attachment: PrivateDocumentDto = {
  id: DOC_ID,
  category: 'correspondenceAttachment',
  filename: 'reply.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  logicalVersion: 1,
  requestId: CASE_ID,
  companyId: null,
  uploaderId: 'admin-1',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  allowedActions: ['download'],
}

function pdf(name = 'reply.pdf'): File {
  return new File([new Uint8Array(64)], name, { type: 'application/pdf' })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

beforeEach(() => {
  listDocuments.mockReset()
  uploadDocument.mockReset()
  listDocuments.mockResolvedValue([])
})

describe('authorized download paths', () => {
  it('accepts only the access-checked proxy routes', () => {
    expect(isAuthorizedDownloadPath(`/api/dashboard/documents/${DOC_ID}/download`)).toBe(true)
    expect(isAuthorizedDownloadPath(letterAttachmentDownloadPath(LETTER_ID, DOC_ID))).toBe(true)
    for (const path of [
      '/media/reply.pdf',
      'https://cdn.example.com/reply.pdf',
      `//evil.example/api/dashboard/documents/${DOC_ID}/download`,
      `/api/dashboard/documents/${DOC_ID}/download?redirect=/media/x`,
      '/api/dashboard/documents/../media/download',
      '/data/private-documents/3f0c.pdf',
    ]) {
      expect(isAuthorizedDownloadPath(path)).toBe(false)
    }
  })

  it('refuses a non-authorized path without making a request', async () => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    await expect(downloadFromAuthorizedPath('/media/reply.pdf')).rejects.toMatchObject({ code: 'not_found' })
    expect(request).not.toHaveBeenCalled()
  })
})

describe('PrivateDocumentDownload', () => {
  function stubBlobUrl() {
    const createObjectURL = vi.fn(() => 'blob:private')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    return createObjectURL
  }

  it('downloads bytes through the authorized route and saves the server filename', async () => {
    const createObjectURL = stubBlobUrl()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const request = vi.fn().mockResolvedValue(new Response('%PDF', {
      status: 200,
      headers: { 'content-disposition': `attachment; filename="reply.pdf"; filename*=UTF-8''${encodeURIComponent('پاسخ.pdf')}` },
    }))
    vi.stubGlobal('fetch', request)
    render(createElement(PrivateDocumentDownload, { path: letterAttachmentDownloadPath(LETTER_ID, DOC_ID), filename: 'reply.pdf' }))
    fireEvent.click(screen.getByRole('button', { name: 'دانلود reply.pdf' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(request).toHaveBeenCalledWith(`/api/dashboard/letters/${LETTER_ID}/attachments/${DOC_ID}/download`, expect.objectContaining({ cache: 'no-store' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
    click.mockRestore()
  })

  it('shows a Persian denied message for a revoked or unknown document', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'not_found' }, 404)))
    render(createElement(PrivateDocumentDownload, { documentId: DOC_ID, filename: 'reply.pdf' }))
    fireEvent.click(screen.getByRole('button', { name: 'دانلود reply.pdf' }))
    expect((await screen.findByRole('alert')).textContent).toContain('دسترسی شما لغو شده است')
  })

  it('offers sign-in again when the session has expired', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401)))
    render(createElement(PrivateDocumentDownload, { documentId: DOC_ID, filename: 'reply.pdf' }))
    fireEvent.click(screen.getByRole('button', { name: 'دانلود reply.pdf' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('نشست شما منقضی شده است')
    expect(within(alert).getByRole('link', { name: 'ورود دوباره' })).toBeTruthy()
  })

  it('reports missing bytes and network failures without falling back to another URL', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'document_unavailable' }, 410))
      .mockRejectedValueOnce(new TypeError('network'))
    vi.stubGlobal('fetch', request)
    render(createElement(PrivateDocumentDownload, { documentId: DOC_ID, filename: 'reply.pdf' }))
    const button = screen.getByRole('button', { name: 'دانلود reply.pdf' })
    fireEvent.click(button)
    expect((await screen.findByRole('alert')).textContent).toContain('فایل مدرک در دسترس نیست')
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('دریافت فایل انجام نشد'))
    expect(request).toHaveBeenCalledTimes(2)
    for (const [url] of request.mock.calls) expect(url).toBe(`/api/dashboard/documents/${DOC_ID}/download`)
  })
})

describe('letter attachments', () => {
  const letter: LetterDto = {
    id: LETTER_ID,
    type: 'official',
    title: 'نامه',
    body: 'متن',
    senderId: 'admin-1',
    senderName: 'دبیرخانه',
    senderRole: 'central-secretariat',
    recipientId: 'rep-1',
    requestId: CASE_ID,
    read: true,
    sentAt: '2026-11-01T00:00:00.000Z',
    attachments: [
      { id: DOC_ID, filename: 'reply.pdf', sizeBytes: 2_500_000, downloadUrl: '/media/leak.pdf', storageKey: 'x.pdf' },
      { filename: 'no-id.pdf' },
      'garbage',
    ],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  }

  it('keeps only safe metadata from authorized attachments', () => {
    const items = mapLetterAttachments(letter.attachments)
    expect(items).toEqual([{ id: DOC_ID, name: 'reply.pdf', size: expect.stringContaining('مگابایت') }])
    expect(JSON.stringify(items)).not.toContain('/media/')
    expect(JSON.stringify(items)).not.toContain('storageKey')
  })

  it('downloads a letter attachment through the letter-scoped route', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({ error: 'not_found' }, 404))
    vi.stubGlobal('fetch', request)
    render(createElement(MailDetailView, { mail: mapMailData(letter) }))
    expect(screen.getByRole('region', { name: 'پیوست‌های نامه' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'دانلود reply.pdf' }))
    await screen.findByRole('alert')
    expect(request).toHaveBeenCalledWith(`/api/dashboard/letters/${LETTER_ID}/attachments/${DOC_ID}/download`, expect.anything())
  })
})

describe('PrivateDocumentField attachment mode', () => {
  it('does not list existing parent files and lets an uploaded file be detached locally', async () => {
    uploadDocument.mockResolvedValue(attachment)
    const onDocumentsChange = vi.fn()
    const view = render(createElement(PrivateDocumentField, {
      category: 'correspondenceAttachment', requestId: CASE_ID, sessionOnly: true, onDocumentsChange,
    }))
    expect(view.getByText('هنوز فایلی پیوست نشده است.')).toBeTruthy()
    fireEvent.change(view.container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [pdf()] } })
    expect(await view.findByText('reply.pdf')).toBeTruthy()
    expect(listDocuments).not.toHaveBeenCalled()
    await waitFor(() => expect(onDocumentsChange).toHaveBeenLastCalledWith([attachment]))
    fireEvent.click(view.getByRole('button', { name: 'حذف reply.pdf از پیوست‌ها' }))
    await waitFor(() => expect(onDocumentsChange).toHaveBeenLastCalledWith([]))
  })
})

describe('NewLetterForm correspondence attachments', () => {
  const companies = [{ id: 'rep-1', companyName: 'شرکت نمونه' }]
  const cases = [
    { id: CASE_ID, trackingCode: 'REQ-1', title: 'پرونده یک', ownerId: 'rep-1' },
    { id: OTHER_CASE_ID, trackingCode: 'REQ-2', title: 'پرونده دیگر', ownerId: 'rep-2' },
  ]

  function stubApi(send = vi.fn().mockResolvedValue(jsonResponse({ letter: { id: LETTER_ID } }, 201)), casesResponse = () => jsonResponse({ items: cases })) {
    vi.stubGlobal('fetch', (input: unknown, init?: RequestInit) =>
      String(input).startsWith('/api/dashboard/admin/requests') ? Promise.resolve(casesResponse()) : send(input, init))
    return send
  }

  function fill() {
    fireEvent.change(screen.getByLabelText('گیرنده'), { target: { value: 'rep-1' } })
    fireEvent.change(screen.getByLabelText('عنوان نامه'), { target: { value: 'عنوان' } })
    fireEvent.change(screen.getByLabelText('نوع نامه'), { target: { value: 'official' } })
    fireEvent.change(screen.getByLabelText('متن نامه'), { target: { value: 'متن' } })
  }

  async function chooseCase(id = CASE_ID) {
    const select = screen.getByLabelText('پرونده مرتبط (اختیاری)') as HTMLSelectElement
    await waitFor(() => expect(select.disabled).toBe(false))
    fireEvent.change(select, { target: { value: id } })
  }

  it('lists only the recipient cases from the authorized request API', async () => {
    stubApi()
    render(createElement(NewLetterForm, { companies }))
    fill()
    await chooseCase()
    const options = Array.from((screen.getByLabelText('پرونده مرتبط (اختیاری)') as HTMLSelectElement).options).map((option) => option.textContent)
    expect(options).toEqual(['بدون پرونده', 'REQ-1 — پرونده یک'])
  })

  it('rejects an invalid file locally with Persian copy and sends nothing', async () => {
    const send = stubApi()
    render(createElement(NewLetterForm, { companies }))
    fill()
    await chooseCase()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(32)], 'photo.png', { type: 'image/png' })] } })
    expect(await screen.findByText(/فرمت فایل مجاز نیست/)).toBeTruthy()
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(10_000_001)], 'big.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByText(/حجم فایل بیشتر از حد مجاز است/)).toBeTruthy()
    expect(uploadDocument).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('blocks sending while an upload is pending, then sends the case and attachment ids', async () => {
    let finishUpload!: (value: PrivateDocumentDto) => void
    uploadDocument.mockImplementation(() => new Promise((resolve) => { finishUpload = resolve }))
    const send = stubApi()
    render(createElement(NewLetterForm, { companies }))
    fill()
    await chooseCase()
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [pdf()] } })
    await waitFor(() => expect(uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'correspondenceAttachment', requestId: CASE_ID }),
      expect.any(Function),
    ))
    const submit = screen.getByRole('button', { name: 'ارسال نامه' }) as HTMLButtonElement
    await waitFor(() => expect(submit.disabled).toBe(true))
    fireEvent.submit(screen.getByRole('form', { name: 'ارسال نامه جدید' }))
    expect(send).not.toHaveBeenCalled()

    finishUpload(attachment)
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.click(submit)
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard/letters'))
    expect(send).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(send.mock.calls[0][1].body))).toEqual({
      recipientId: 'rep-1', title: 'عنوان', type: 'official', body: 'متن', requestId: CASE_ID, attachmentIds: [DOC_ID],
    })
  })

  it('drops attachments from a previous case selection instead of sending stale ids', async () => {
    uploadDocument.mockResolvedValue(attachment)
    const send = stubApi()
    render(createElement(NewLetterForm, { companies }))
    fill()
    await chooseCase()
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [pdf()] } })
    expect(await screen.findByText('reply.pdf')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('پرونده مرتبط (اختیاری)'), { target: { value: '' } })
    expect(screen.queryByText('reply.pdf')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'ارسال نامه' }))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(send.mock.calls[0][1].body))).toEqual({ recipientId: 'rep-1', title: 'عنوان', type: 'official', body: 'متن' })
  })

  it('shows a Persian upload error from the server and keeps the letter unsent', async () => {
    const { DocumentApiError } = await import('@/utilities/document-api')
    uploadDocument.mockRejectedValue(new DocumentApiError(403, 'forbidden'))
    const send = stubApi()
    render(createElement(NewLetterForm, { companies }))
    fill()
    await chooseCase()
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [pdf()] } })
    expect((await screen.findAllByText('شما اجازهٔ انجام این عملیات را ندارید.')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeTruthy()
    expect(send).not.toHaveBeenCalled()
  })

  it('explains denied and failed case lookups', async () => {
    stubApi(undefined, () => jsonResponse({ error: 'forbidden' }, 403))
    const view = render(createElement(NewLetterForm, { companies }))
    fireEvent.change(screen.getByLabelText('گیرنده'), { target: { value: 'rep-1' } })
    expect((await screen.findByText(/دسترسی به پرونده‌های این گیرنده/)).textContent).toContain('بدون پیوست')
    view.unmount()

    stubApi(undefined, () => jsonResponse({ error: 'boom' }, 500))
    render(createElement(NewLetterForm, { companies }))
    fireEvent.change(screen.getByLabelText('گیرنده'), { target: { value: 'rep-1' } })
    expect((await screen.findByRole('alert')).textContent).toContain('دریافت پرونده‌های گیرنده انجام نشد')
  })
})
