// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SecretariatFollowUpPanel } from '@/components/dashboard/secretariat-follow-up-panel'
import type { CaseFollowUpDto } from '@/utilities/dashboard-api'

const MEMO = 'متن داخلی یادداشت'

const base: CaseFollowUpDto = {
  stageOpen: true,
  canAct: true,
  memos: [{ id: 'm1', version: 1, body: MEMO, authorName: 'مسئول', sentAt: '2026-10-20T00:00:00.000Z' }],
  supplementaryRequests: [],
  files: [],
  results: [],
  published: null,
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function mockApi(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => handler(url, init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const renderPanel = () => render(createElement(SecretariatFollowUpPanel, { id: 'req-1' }))
const resultBox = () => screen.getByLabelText('متن جداگانه نتیجه') as HTMLTextAreaElement

describe('SecretariatFollowUpPanel', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders nothing for a role the server denies', async () => {
    const fetchMock = mockApi(() => json(403, { error: 'forbidden' }))
    const { container } = renderPanel()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(container.firstChild).toBeNull())
  })

  it('tells a failed read apart from an empty case and offers a retry', async () => {
    mockApi(() => json(500, { error: 'server_error' }))
    renderPanel()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'دریافت اطلاعات پیگیری انجام نشد.')
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeTruthy()
  })

  it('never prefills the company text with the memo and publishes only after a preview', async () => {
    let data = base
    const fetchMock = mockApi((url, init) => {
      if (init?.method === 'POST' && url.endsWith('/result')) {
        data = {
          ...data,
          results: [{
            id: 'r1', version: 1, body: 'متن برای شرکت', authorName: 'دبیرخانه',
            createdAt: '2026-10-21T00:00:00.000Z', publishedByName: null, publishedAt: null,
          }],
        }
        return json(201, {})
      }
      if (init?.method === 'POST' && url.endsWith('/result/publish')) return json(200, {})
      return json(200, data)
    })
    renderPanel()

    await screen.findByText(MEMO)
    expect(resultBox().value).toBe('')
    expect(screen.queryByRole('button', { name: 'انتشار برای شرکت' })).toBeNull()

    fireEvent.change(resultBox(), { target: { value: 'متن برای شرکت' } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت پیش‌نویس و پیش‌نمایش' }))

    const publish = await screen.findByRole('button', { name: 'انتشار برای شرکت' })
    fireEvent.click(publish)

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url.endsWith('/result/publish'))
      expect(JSON.parse(call?.[1]?.body as string)).toEqual({ version: 1 })
    })
  })

  it('hides publication again once the text differs from the saved preview', async () => {
    mockApi(() => json(200, {
      ...base,
      results: [{
        id: 'r1', version: 1, body: 'متن ثبت‌شده', authorName: null,
        createdAt: '2026-10-21T00:00:00.000Z', publishedByName: null, publishedAt: null,
      }],
    }))
    renderPanel()
    await screen.findByRole('button', { name: 'انتشار برای شرکت' })
    fireEvent.change(resultBox(), { target: { value: 'متن تغییرکرده' } })
    expect(screen.queryByRole('button', { name: 'انتشار برای شرکت' })).toBeNull()
  })

  it('explains a stale publish', async () => {
    mockApi((url, init) => {
      if (init?.method === 'POST') return json(409, { error: 'result_version_stale' })
      return json(200, {
        ...base,
        results: [{
          id: 'r1', version: 1, body: 'متن', authorName: null,
          createdAt: '2026-10-21T00:00:00.000Z', publishedByName: null, publishedAt: null,
        }],
      })
    })
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'انتشار برای شرکت' }))
    expect((await screen.findByRole('alert')).textContent).toContain('نسخه تازه‌تری')
  })

  it('offers no commands to the owner, who only oversees', async () => {
    mockApi(() => json(200, {
      ...base,
      canAct: false,
      files: [{
        id: 'f1', filename: 'a.pdf', createdAt: '2026-10-21T00:00:00.000Z', deliveredAt: null,
        downloadUrl: '/api/dashboard/documents/f1/download',
      }],
    }))
    renderPanel()
    await screen.findByText('a.pdf')
    expect(screen.queryByLabelText('متن جداگانه نتیجه')).toBeNull()
    expect(screen.queryByRole('button', { name: 'ارجاع به مسئول سرمایه‌گذاری' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'ارسال درخواست به شرکت' })).toBeNull()
  })
})
