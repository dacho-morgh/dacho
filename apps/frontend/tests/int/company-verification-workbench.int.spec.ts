// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompanyList } from '@/components/dashboard/company-list'
import { CompanyDetailView } from '@/components/dashboard/company-detail-view'

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => '/dashboard/companies',
  useSearchParams: () => new URLSearchParams(),
}))

const mockDocumentApi = vi.hoisted(() => ({
  downloadDocument: vi.fn(),
}))

vi.mock('@/utilities/document-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utilities/document-api')>()
  return {
    ...original,
    downloadDocument: mockDocumentApi.downloadDocument,
  }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  if (typeof window !== 'undefined') {
    localStorage.clear()
  }
})

describe('FE05: Secretariat Company Verification Workbench', () => {
  const mockCompanyListItems = [
    {
      id: 'rep-1',
      companyId: 'comp-1',
      name: 'نماینده یک',
      companyName: 'شرکت پترو صنعت',
      companyType: 'سهامی خاص',
      companyProvince: 'تهران',
      companyCity: 'تهران',
      companyEstablishmentDate: '2020-01-01',
      executives: [{ role: 'مدیر عامل', name: 'علی رضایی' }],
      verificationStatus: 'pending',
      verificationRevision: 2,
    },
    {
      id: 'rep-2',
      companyId: 'comp-2',
      name: 'نماینده دو',
      companyName: 'شرکت نفت و گاز جنوب',
      companyType: 'سهامی عام',
      companyProvince: 'بوشهر',
      companyCity: 'عسلویه',
      companyEstablishmentDate: '2015-05-10',
      executives: [{ role: 'مدیر عامل', name: 'سارا احمدی' }],
      verificationStatus: 'approved',
      verificationRevision: 1,
    },
    {
      id: 'rep-3',
      companyId: 'comp-3',
      name: 'نماینده سه',
      companyName: 'شرکت توسعه انرژی',
      companyType: 'با مسئولیت محدود',
      companyProvince: 'فارس',
      companyCity: 'شیراز',
      companyEstablishmentDate: '2018-09-15',
      executives: [{ role: 'مدیر عامل', name: 'محمد کریمی' }],
      verificationStatus: 'returned',
      verificationRevision: 1,
    },
  ]

  it('renders company list with queue tabs and verification status badges', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: mockCompanyListItems }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    render(createElement(CompanyList))

    // Queue tabs
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /همه/ })).toBeTruthy()
      expect(screen.getByRole('tab', { name: /در انتظار بررسی/ })).toBeTruthy()
      expect(screen.getByRole('tab', { name: /تأیید شده/ })).toBeTruthy()
      expect(screen.getByRole('tab', { name: /برگشت داده شده/ })).toBeTruthy()
      expect(screen.getByRole('tab', { name: /رد شده/ })).toBeTruthy()
    })

    // Companies displayed
    expect(screen.getByText('شرکت پترو صنعت')).toBeTruthy()
    expect(screen.getByText('شرکت نفت و گاز جنوب')).toBeTruthy()
    expect(screen.getByText('شرکت توسعه انرژی')).toBeTruthy()

    // Status badges and revisions
    expect(screen.getAllByText('در انتظار بررسی').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('(نسخه ۲)')).toBeTruthy()
    expect(screen.getAllByText('تأیید شده').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('برگشت داده شده').length).toBeGreaterThanOrEqual(1)

    // Filter by clicking 'در انتظار بررسی' tab
    fireEvent.click(screen.getByRole('tab', { name: /در انتظار بررسی/ }))
    expect(screen.getByText('شرکت پترو صنعت')).toBeTruthy()
    expect(screen.queryByText('شرکت نفت و گاز جنوب')).toBeNull()
    expect(screen.queryByText('شرکت توسعه انرژی')).toBeNull()
  })

  it('displays verification workbench, snapshot documents, and validates reason for return/reject', async () => {
    const companyDetail = {
      representative: {
        id: 'rep-1',
        name: 'علی رضایی',
        phone: '09121111111',
        email: 'ali@example.com',
      },
      companyId: 'comp-1',
      company: {
        name: 'شرکت پترو صنعت',
        nationalId: '10100578556',
        registrationNumber: '15781',
        type: 'سهامی خاص',
        economicCode: '411111495187',
        status: 'فعال',
        establishmentDate: '1390/01/01',
      },
      executives: [{ role: 'مدیر عامل', name: 'علی رضایی' }],
      addresses: [{ title: 'دفتر مرکزی', address: 'تهران خیابان بهشتی', postalCode: '1531638111' }],
      allowedActions: ['read', 'approve', 'return', 'reject'],
      verification: {
        id: 'verif-1',
        status: 'pending',
        revision: 2,
        submittedAt: '2026-10-20T10:00:00Z',
        snapshot: {
          company: {
            name: 'شرکت پترو صنعت',
            nationalId: '10100578556',
            registrationNumber: '15781',
            type: 'سهامی خاص',
            economicCode: '411111495187',
          },
          documents: [
            {
              id: 'doc-1',
              category: 'articlesOfAssociation',
              filename: 'statute.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 1048576,
            },
          ],
        },
      },
    }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dashboard/admin/companies/rep-1')) {
        return Promise.resolve(new Response(JSON.stringify(companyDetail), { status: 200 }))
      }
      if (url.includes('/api/dashboard/admin/verifications/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              verification: companyDetail.verification,
              allowedActions: companyDetail.allowedActions,
            }),
            { status: 200 },
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }))
    })
    vi.stubGlobal('fetch', mockFetch)

    render(createElement(CompanyDetailView, { id: 'rep-1' }))

    await waitFor(() => {
      expect(screen.getByText('میز کار بررسی و تصمیم احراز دبیرخانه')).toBeTruthy()
      expect(screen.getByText('statute.pdf')).toBeTruthy()
      expect(screen.getAllByText('اساس‌نامه').length).toBeGreaterThanOrEqual(1)
    })

    // Try returning without reason -> client error
    fireEvent.click(screen.getByRole('button', { name: 'برگشت جهت اصلاح' }))
    expect(screen.getByText('ثبت دلیل برای بازگرداندن یا رد الزامی است.')).toBeTruthy()

    // Authorized document download
    mockDocumentApi.downloadDocument.mockResolvedValueOnce({
      blob: new Blob(['pdf-content'], { type: 'application/pdf' }),
      filename: 'statute.pdf',
    })
    fireEvent.click(screen.getByRole('button', { name: 'دانلود مدرک' }))
    await waitFor(() => {
      expect(mockDocumentApi.downloadDocument).toHaveBeenCalledWith('doc-1')
    })
  })

  it('handles stale revision 409 by refreshing and protecting user typed reason', async () => {
    const initialDetail = {
      representative: { id: 'rep-1', name: 'علی رضایی', phone: '09121111111' },
      companyId: 'comp-1',
      company: { name: 'شرکت پترو صنعت' },
      allowedActions: ['read', 'approve', 'return', 'reject'],
      verification: {
        id: 'verif-1',
        status: 'pending',
        revision: 2,
        snapshot: {},
      },
    }

    const updatedDetail = {
      ...initialDetail,
      verification: {
        ...initialDetail.verification,
        revision: 3,
      },
    }

    let fetchCount = 0
    const mockFetch = vi.fn().mockImplementation((url: string, _init?: RequestInit) => {
      if (url.includes('/verification/decision')) {
        // Return 409 stale revision
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'stale_revision' }), { status: 409 }),
        )
      }
      if (url.includes('/api/dashboard/admin/companies/rep-1')) {
        fetchCount++
        const payload = fetchCount > 1 ? updatedDetail : initialDetail
        return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    vi.stubGlobal('fetch', mockFetch)

    render(createElement(CompanyDetailView, { id: 'rep-1' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'تأیید مدارک' })).toBeTruthy()
    })

    const textarea = screen.getByLabelText(/توضیحات و دلیل تصمیم/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'مدارک اولیه بررسی شد اما نسخه تغییر کرد' } })
    expect(textarea.value).toBe('مدارک اولیه بررسی شد اما نسخه تغییر کرد')

    // Click approve
    fireEvent.click(screen.getByRole('button', { name: 'تأیید مدارک' }))

    // Stale notice displayed
    await waitFor(() => {
      expect(
        screen.getByText(/نسخه پرونده احراز تغییر یافته است. اطلاعات صفحه به‌روزرسانی شد/),
      ).toBeTruthy()
    })

    // Text in textarea is PRESERVED
    expect(textarea.value).toBe('مدارک اولیه بررسی شد اما نسخه تغییر کرد')
  })

  it('displays warning when representative views their own company (self-approval prohibited)', async () => {
    const ownCompanyDetail = {
      representative: { id: 'rep-self', name: 'خودم', phone: '09120000000' },
      companyId: 'comp-self',
      company: { name: 'شرکت شخصی' },
      // Backend sets allowedActions to ['read'] when actor is representative of this company
      allowedActions: ['read'],
      verification: {
        id: 'verif-self',
        status: 'pending',
        revision: 1,
        snapshot: {},
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(ownCompanyDetail), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    render(createElement(CompanyDetailView, { id: 'rep-self' }))

    await waitFor(() => {
      expect(
        screen.getByText(/شما نماینده این شرکت هستید. تأیید یا تصمیم‌گیری برای شرکت خود مجاز نیست/),
      ).toBeTruthy()
    })

    // Decision buttons must NOT be present
    expect(screen.queryByRole('button', { name: 'تأیید مدارک' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'برگشت جهت اصلاح' })).toBeNull()
  })

  it('shows identity edits awaiting re-verification when live company differs from approved snapshot', async () => {
    const modifiedDetail = {
      representative: { id: 'rep-1', name: 'علی رضایی', phone: '09121111111' },
      companyId: 'comp-1',
      company: {
        name: 'نام جدید شرکت ویرایش‌شده',
        nationalId: '10100578556',
        type: 'سهامی عام',
      },
      allowedActions: ['read'],
      verification: {
        id: 'verif-1',
        status: 'returned',
        revision: 1,
        snapshot: {
          company: {
            name: 'نام قبلی تأییدشده در اسناد',
            nationalId: '10100578556',
            type: 'سهامی خاص',
          },
        },
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(modifiedDetail), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    render(createElement(CompanyDetailView, { id: 'rep-1' }))

    await waitFor(() => {
      const region = screen.getByRole('region', { name: 'تغییرات هویتی نیازمند احراز مجدد' })
      expect(within(region).getByText('نام قبلی تأییدشده در اسناد')).toBeTruthy()
      expect(within(region).getByText('نام جدید شرکت ویرایش‌شده')).toBeTruthy()
    })
  })
})
