// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextRequest } from 'next/server'
import { createElement, useState, type ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LettersPage from '@/app/(frontend)/dashboard/letters/page'
import { CompanyDetailView } from '@/components/dashboard/company-detail-view'
import { DashboardRouteError } from '@/components/dashboard/dashboard-route-error'
import { ProfileDialog } from '@/components/dashboard/profile/profile-dialog'
import { RequestAssignmentPanel } from '@/components/dashboard/request-assignment-panel'
import { proxy } from '@/proxy'
import { DashboardApiError, describeMutationFailure } from '@/utilities/dashboard-api'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), senior: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('payload', () => ({
  getPayload: async () => ({
    auth: async () => ({ user: { id: 'user-1', isActive: true, operationalRole: 'representative' } }),
    find: async () => ({ docs: [] }),
  }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/utilities/dashboard-server', () => ({
  isSeniorManagerUser: mocks.senior,
  serverDashboardFetchResult: mocks.fetch,
}))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

const ok = { kind: 'ok', data: { items: [] } }

describe('letters list', () => {
  it.each([
    ['admin', true, '/admin/letters?limit=100'],
    ['role-scoped', false, '/letters?limit=100'],
  ])('shows a failed %s letters read as a notice, never an empty mailbox', async (_name, senior, path) => {
    mocks.senior.mockResolvedValue(senior)
    mocks.fetch.mockImplementation(async (url: string) =>
      url === path ? { kind: 'unavailable', status: 500 } : ok,
    )
    render(await LettersPage())
    expect(screen.getByRole('alert').getAttribute('data-state')).toBe('unavailable')
    expect(screen.queryByText('صندوق نامه‌های شما خالیست')).toBeNull()
  })

  it('keeps the mailbox for roles the support queue is closed to', async () => {
    mocks.senior.mockResolvedValue(false)
    mocks.fetch.mockImplementation(async (url: string) =>
      url.startsWith('/support') ? { kind: 'denied' } : ok,
    )
    render(await LettersPage())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('صندوق نامه‌های شما خالیست')).toBeTruthy()
  })

  it('reports an unavailable support queue instead of hiding its tickets', async () => {
    mocks.senior.mockResolvedValue(false)
    mocks.fetch.mockImplementation(async (url: string) =>
      url.startsWith('/support') ? { kind: 'unavailable', status: 503 } : ok,
    )
    render(await LettersPage())
    expect(screen.getByRole('alert').getAttribute('data-state')).toBe('unavailable')
  })

  it('offers sign-in again for an expired session', async () => {
    mocks.senior.mockResolvedValue(false)
    mocks.fetch.mockResolvedValue({ kind: 'unauthenticated' })
    render(await LettersPage())
    expect(screen.getByRole('alert').getAttribute('data-state')).toBe('expired')
    expect(screen.getByRole('link', { name: 'ورود دوباره' }).getAttribute('href')).toContain('/login')
  })

  it('separates no search match from an empty mailbox', async () => {
    mocks.senior.mockResolvedValue(false)
    mocks.fetch.mockResolvedValue(ok)
    render(await LettersPage())
    fireEvent.change(screen.getByRole('textbox', { name: 'جستجو' }), { target: { value: 'چیزی' } })
    expect(screen.getByText('نتیجه‌ای پیدا نشد')).toBeTruthy()
    expect(screen.queryByText('صندوق نامه‌های شما خالیست')).toBeNull()
  })
})

describe('company detail', () => {
  it.each([
    [401, 'expired'],
    [403, 'denied'],
    [500, 'unavailable'],
  ])('shows status %i as %s without fields or upload controls', async (status, state) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })))
    render(createElement(CompanyDetailView, { id: 'company-1' }))
    expect(screen.getByRole('status')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('alert').getAttribute('data-state')).toBe(state))
    expect(screen.queryByText('اطلاعات پایه')).toBeNull()
    expect(screen.queryByText('مدارک خصوصی شرکت')).toBeNull()
  })

  it('treats a dropped connection as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('failed') }))
    render(createElement(CompanyDetailView, { id: 'company-1' }))
    await waitFor(() => expect(screen.getByRole('alert').getAttribute('data-state')).toBe('unavailable'))
  })
})

describe('write failures', () => {
  it('gives each failure its own next step', () => {
    const fallback = 'انجام نشد'
    expect(describeMutationFailure(new DashboardApiError(401, 'x'), fallback)).toContain('نشست')
    expect(describeMutationFailure(new DashboardApiError(403, 'x'), fallback)).toContain('اجازه')
    expect(describeMutationFailure(new DashboardApiError(409, 'x'), fallback)).toContain('تغییر کرده')
    expect(describeMutationFailure(new TypeError('failed'), fallback)).toContain('ارتباط')
    expect(describeMutationFailure(new DashboardApiError(422, 'x'), fallback)).toBe(fallback)
  })

  it('survives a dropped connection while assigning and keeps the selection', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') throw new TypeError('failed')
      return Response.json({
        items: url.endsWith('/employees') ? [{ id: 'e1', name: 'داور', operationalRole: 'reviewer' }] : [],
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    render(createElement(RequestAssignmentPanel, { id: 'request-1' }))
    await screen.findByText('هنوز انتسابی ثبت نشده است.')
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    await screen.findByRole('option', { name: /داور/ })
    fireEvent.change(select, { target: { value: 'e1' } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت انتساب' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('ارتباط'))
    expect(select.value).toBe('e1')
  })

  it('does not call an unread assignment list empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    render(createElement(RequestAssignmentPanel, { id: 'request-1' }))
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0))
    expect(screen.queryByText('هنوز انتسابی ثبت نشده است.')).toBeNull()
    expect(screen.getByText('دریافت فهرست کارکنان انجام نشد. صفحه را دوباره بارگذاری کنید.')).toBeTruthy()
  })
})

describe('access service outage', () => {
  it('serves a readable Persian page with a retry, not bare text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    const response = await proxy(
      new NextRequest('http://localhost:3000/dashboard/letters?secret=<b>', {
        headers: { cookie: 'payload-token=session' },
      }),
    )
    const page = await response.text()
    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(page).toContain('dir="rtl"')
    expect(page).toContain('<a href="">تلاش دوباره</a>')
    expect(page).not.toContain('secret')
  })
})

describe('route error boundary', () => {
  it('retries by re-fetching rather than re-rendering the failure', () => {
    const retry = vi.fn()
    render(createElement(DashboardRouteError, { error: new Error('boom'), retry }))
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('asks a tab left on an old build to reload', () => {
    const error = Object.assign(new Error('Loading chunk 12 failed'), { name: 'ChunkLoadError' })
    render(createElement(DashboardRouteError, { error, retry: vi.fn() }))
    expect(screen.getByText('نسخه تازه‌ای از سامانه منتشر شده است')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'تازه کردن صفحه' })).toBeTruthy()
  })
})

describe('dialog keyboard contract', () => {
  function Harness({ field }: { field: 'input' | 'button' }) {
    const [open, setOpen] = useState(false)
    return createElement(
      'div',
      null,
      createElement('button', { type: 'button', onClick: () => setOpen(true) }, 'open'),
      open &&
        createElement(
          ProfileDialog,
          {
            title: 'عنوان',
            onClose: () => setOpen(false),
            actions: createElement('button', { type: 'button' }, 'ذخیره'),
          } as ComponentProps<typeof ProfileDialog>,
          field === 'input'
            ? createElement('input', { 'aria-label': 'نام' })
            : createElement('button', { type: 'button' }, 'میانی'),
        ),
    )
  }

  function openDialog(field: 'input' | 'button') {
    render(createElement(Harness, { field }))
    const opener = screen.getByRole('button', { name: 'open' })
    opener.focus()
    fireEvent.click(opener)
    return opener
  }

  it('starts on the first field to fill in', () => {
    openDialog('input')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'نام' }))
  })

  it('traps Tab, closes on Escape and returns focus', () => {
    const opener = openDialog('button')
    const close = screen.getByRole('button', { name: 'بستن پنجره' })
    const save = screen.getByRole('button', { name: 'ذخیره' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(save)
    fireEvent.keyDown(save, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(close, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
