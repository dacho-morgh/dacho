// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FinancialPackagePanel } from '@/components/dashboard/financial-package-panel'
import type { FinancialInvitationResponse, FinancialPackageDto } from '@/utilities/dashboard-api'

// The field reads and uploads files itself; here only the slots the panel asks for matter.
vi.mock('@/components/documents/private-document-field', () => ({
  PrivateDocumentField: ({ label, statementYear }: { label: string; statementYear?: number }) =>
    createElement('div', { 'data-testid': 'package-slot', 'data-year': statementYear ?? '' }, label),
}))
vi.mock('@/components/documents/private-document-download', () => ({
  PrivateDocumentDownload: ({ filename }: { filename: string }) => createElement('span', null, filename),
}))

const invitation: FinancialInvitationResponse = {
  invitation: {
    id: 'inv-1',
    requestId: 'req-1',
    trackingCode: 'EV-1',
    requestRevision: 3,
    proposalRevision: 1,
    checklistVersion: 'financial-package-2026-v1',
    checklist: [
      { category: 'financialStatements', title: 'صورت‌های مالی' },
      { category: 'debtFacilityEvidence', title: 'بدهی‌ها و تسهیلات' },
    ],
    invitedAt: '2026-10-20T00:00:00.000Z',
  },
  statementYears: [2024, 2025],
}

const pkg: FinancialPackageDto = {
  id: 'pkg-1',
  requestId: 'req-1',
  invitationId: 'inv-1',
  packageVersion: 1,
  checklistVersion: 'financial-package-2026-v1',
  statementYears: [2024, 2025],
  documents: [
    { id: 'd1', category: 'financialStatements', filename: 'fs-2024.pdf', sizeBytes: 10, logicalVersion: 1, statementYear: 2024 },
    { id: 'd2', category: 'debtFacilityEvidence', filename: 'debt.pdf', sizeBytes: 10, logicalVersion: 1, statementYear: null },
  ],
  submittedBy: 'company-user',
  submittedAt: '2026-10-22T00:00:00.000Z',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function mockApi(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => handler(url, init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const renderPanel = (props: Partial<{ canSubmit: boolean; resultPublished: boolean }> = {}) =>
  render(createElement(FinancialPackagePanel, {
    requestId: 'req-1',
    trackingCode: 'EV-1',
    canSubmit: true,
    resultPublished: false,
    ...props,
  }))

describe('FinancialPackagePanel', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders nothing before the chief advances the case', async () => {
    const fetchMock = mockApi(() => json(409, { error: 'financial_stage_not_open' }))
    const { container } = renderPanel()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('asks for one statement file per year the server names, then each other category', async () => {
    mockApi((url) => (url.endsWith('/financial-package') ? json(404, { error: 'not_found' }) : json(200, invitation)))
    renderPanel()
    await screen.findByTestId('financial-package-form')
    expect(screen.getAllByTestId('package-slot').map((slot) => [slot.textContent, slot.getAttribute('data-year')])).toEqual([
      ['صورت‌های مالی سال ۲۰۲۴', '2024'],
      ['صورت‌های مالی سال ۲۰۲۵', '2025'],
      ['بدهی‌ها و تسهیلات', ''],
    ])
  })

  it('shows the gaps the server reported and keeps the form when the package is incomplete', async () => {
    mockApi((url, init) => {
      if (init?.method === 'POST') {
        return json(422, { error: 'financial_package_incomplete', missingCategories: ['debtFacilityEvidence'], missingStatementYears: [2024] })
      }
      return url.endsWith('/financial-package') ? json(404, { error: 'not_found' }) : json(200, invitation)
    })
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'ثبت و ارسال بسته مالی' }))
    const gaps = await screen.findByTestId('financial-package-gaps')
    expect(gaps.textContent).toContain('بدهی‌ها و تسهیلات')
    expect(gaps.textContent).toContain('صورت مالی سال ۲۰۲۴')
    expect(screen.getByTestId('financial-package-form')).toBeTruthy()
  })

  it('switches to the submitted status once the server stores the package', async () => {
    mockApi((url, init) => {
      if (init?.method === 'POST') return json(201, { package: pkg })
      return url.endsWith('/financial-package') ? json(404, { error: 'not_found' }) : json(200, invitation)
    })
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'ثبت و ارسال بسته مالی' }))
    await screen.findByTestId('financial-package-submitted')
    expect(screen.getByText('بسته مالی با موفقیت ثبت شد')).toBeTruthy()
    expect(screen.getByTestId('financial-package-count').textContent).toBe('۲ فایل دریافت شده')
    expect(screen.queryByRole('button', { name: 'ثبت و ارسال بسته مالی' })).toBeNull()
  })

  it('explains an unreadable founding date instead of a generic failure', async () => {
    mockApi((url, init) => {
      if (init?.method === 'POST') return json(422, { error: 'establishment_date_unavailable' })
      if (url.endsWith('/financial-package')) return json(404, { error: 'not_found' })
      return json(200, { ...invitation, statementYears: null })
    })
    renderPanel()
    await screen.findByText('سال‌های صورت مالی مشخص نیست')
    fireEvent.click(screen.getByRole('button', { name: 'ثبت و ارسال بسته مالی' }))
    expect((await screen.findByRole('alert')).textContent).toContain('تاریخ تأسیس را در پروفایل شرکت اصلاح کنید')
  })

  it('reads a stored package as submitted, and drops the banner once a result is published', async () => {
    mockApi((url) => (url.endsWith('/financial-package') ? json(200, { package: pkg }) : json(200, invitation)))
    renderPanel({ canSubmit: false, resultPublished: true })
    await screen.findByTestId('financial-package-submitted')
    expect(screen.queryByText('بسته مالی با موفقیت ثبت شد')).toBeNull()
    expect(screen.getByText('نتیجه منتشر شده')).toBeTruthy()
  })
})
