// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompanyList } from '@/components/dashboard/company-list'
import { CompanyDetailView } from '@/components/dashboard/company-detail-view'

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  /** The query string the page was opened with. */
  search: '',
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => '/dashboard/companies',
  useSearchParams: () => new URLSearchParams(navigation.search),
  notFound: navigation.notFound,
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
  navigation.search = ''
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

    // Wait for the list
    await screen.findByText('شرکت پترو صنعت')

    // Companies displayed
    expect(screen.getByText('شرکت پترو صنعت')).toBeTruthy()
    expect(screen.getByText('شرکت نفت و گاز جنوب')).toBeTruthy()
    expect(screen.getByText('شرکت توسعه انرژی')).toBeTruthy()

    // Status badges and revisions
    expect(screen.getAllByText('در انتظار بررسی').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('(نسخه ۲)')).toBeTruthy()
    expect(screen.getAllByText('تأیید شده').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('برگشت داده شده').length).toBeGreaterThanOrEqual(1)

    // The verification queues live in the shared filter button (FE35), with their counts.
    fireEvent.click(screen.getByRole('button', { name: 'فیلتر شرکت‌ها' }))
    const queues = await screen.findByRole('combobox', { name: 'وضعیت احراز' })
    for (const name of [/همه/, /در انتظار بررسی/, /تأیید شده/, /برگشت داده شده/, /رد شده/]) {
      expect(within(queues).getByRole('option', { name })).toBeTruthy()
    }
    // Nothing changes until «اعمال»; then the queue is part of the URL (and restarts at page 1); the API does the filtering.
    const pending = within(queues).getByRole('option', { name: /در انتظار بررسی/ }) as HTMLOptionElement
    fireEvent.change(queues, { target: { value: pending.value } })
    expect(navigation.push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'اعمال' }))
    // (The filter button reads the path from window.location, which is "/" under jsdom.)
    expect(navigation.push).toHaveBeenCalledWith(expect.stringMatching(/\?status=pending$/))
  })

  describe('paging, selection and bulk actions', () => {
    const page = (items: typeof mockCompanyListItems, extra: Record<string, unknown> = {}) => ({
      items,
      page: 1,
      limit: 10,
      totalDocs: items.length,
      totalPages: 1,
      counts: { all: 3, pending: 1, approved: 1, returned: 1, rejected: 0 },
      ...extra,
    })
    const respond = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

    it('asks the API for the page, queue and search held in the URL, and pages through the URL', async () => {
      navigation.search = 'page=2&status=pending&search=%D9%BE%D8%AA%D8%B1%D9%88'
      const fetchMock = vi.fn().mockResolvedValue(respond(page(mockCompanyListItems.slice(0, 1), { page: 2, totalPages: 3 })))
      vi.stubGlobal('fetch', fetchMock)

      render(createElement(CompanyList))
      await screen.findByText('شرکت پترو صنعت')

      const requested = new URL(String(fetchMock.mock.calls[0]![0]), 'http://localhost')
      expect(requested.pathname).toBe('/api/dashboard/admin/companies')
      expect(Object.fromEntries(requested.searchParams)).toEqual({
        page: '2',
        limit: '10',
        status: 'pending',
        search: 'پترو',
      })
      expect(screen.getByText('صفحه ۲ از ۳')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'صفحه بعد' }))
      expect(navigation.push).toHaveBeenCalledWith('/dashboard/companies?page=3&status=pending&search=%D9%BE%D8%AA%D8%B1%D9%88')
      fireEvent.click(screen.getByRole('button', { name: 'صفحه قبل' }))
      // Page 1 is the default, so it leaves the URL.
      expect(navigation.push).toHaveBeenCalledWith('/dashboard/companies?status=pending&search=%D9%BE%D8%AA%D8%B1%D9%88')
    })

    it('opens with the rows the server read, without fetching or showing a loading line', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const first = mockCompanyListItems[0]!

      render(
        createElement(CompanyList, {
          initial: {
            key: 'page=1&limit=10',
            page: 1,
            totalPages: 2,
            counts: { all: 3, pending: 1, approved: 1, returned: 1, rejected: 0 },
            companies: [
              {
                id: first.id,
                name: first.companyName,
                ceo: 'علی رضایی',
                companyType: first.companyType,
                address: 'تهران، تهران',
                activityAge: '۶ سال',
                verificationStatus: 'pending',
                verificationRevision: 2,
                submittedAt: null,
                updatedAt: null,
              },
            ],
          },
        }),
      )

      // The rows are there on the very first render, and nothing was requested.
      expect(screen.getByText('شرکت پترو صنعت')).toBeTruthy()
      expect(screen.queryByText(/در حال دریافت اطلاعات/)).toBeNull()
      expect(screen.getByText('صفحه ۱ از ۲')).toBeTruthy()
      await waitFor(() => expect(fetchMock).not.toHaveBeenCalled())
    })

    it('approves only the selected pending companies after a confirmation', async () => {
      const fetchMock = vi.fn((url: string, init?: RequestInit) =>
        Promise.resolve(init?.method === 'POST' ? respond({ verification: {} }) : respond(page(mockCompanyListItems))),
      )
      vi.stubGlobal('fetch', fetchMock)

      render(createElement(CompanyList))
      await screen.findByText('شرکت پترو صنعت')
      // Nothing is selected yet, so the actions are not beside the filter.
      expect(screen.queryByRole('group', { name: 'عملیات گروهی' })).toBeNull()

      fireEvent.click(screen.getByRole('checkbox', { name: 'انتخاب همه ردیف‌ها' }))
      // The actions are icon buttons named by their label (shown on hover).
      const actions = screen.getByRole('group', { name: 'عملیات گروهی' })
      // Only the owner may remove companies.
      expect(within(actions).queryByRole('button', { name: 'حذف شرکت‌ها' })).toBeNull()

      fireEvent.click(within(actions).getByRole('button', { name: 'تأیید احراز هویت' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/احراز هویت ۱ شرکت تأیید می‌شود/)).toBeTruthy()
      expect(within(dialog).getByText(/۲ شرکت انتخاب‌شده در انتظار بررسی نیست/)).toBeTruthy()
      fireEvent.click(within(dialog).getByRole('button', { name: 'تأیید' }))

      await waitFor(() => {
        const decisions = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
        expect(decisions).toHaveLength(1)
        expect(decisions[0]![0]).toBe('/api/dashboard/admin/companies/rep-1/verification/decision')
        expect(JSON.parse(String(decisions[0]![1]!.body))).toEqual({ action: 'approve', expectedRevision: 2 })
      })
      // The list reloads and the selection starts empty.
      await waitFor(() => expect(screen.queryByRole('group', { name: 'عملیات گروهی' })).toBeNull())
    })

    it('lists the actions of a row in its popover and runs one on that row alone', async () => {
      const items = mockCompanyListItems.map((item, index) => ({ ...item, updatedAt: `2026-11-0${index + 1}T10:00:00.000Z` }))
      const fetchMock = vi.fn((url: string, init?: RequestInit) =>
        Promise.resolve(init?.method === 'POST' ? respond({ verification: {} }) : respond(page(items))),
      )
      vi.stubGlobal('fetch', fetchMock)

      render(createElement(CompanyList, { canRemoveCompany: true }))
      await screen.findByText('شرکت پترو صنعت')

      // The approved company's popover has no approval; the pending one's has all three.
      const triggers = screen.getAllByRole('button', { name: 'عملیات' })
      fireEvent.click(triggers[1]!)
      expect(await screen.findByRole('link', { name: 'مشاهده' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'تأیید احراز هویت' })).toBeNull()
      expect(screen.getByRole('button', { name: 'حذف شرکت' })).toBeTruthy()
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

      fireEvent.click(triggers[0]!)
      expect(await screen.findByRole('link', { name: 'بررسی' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'تأیید احراز هویت' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/احراز هویت ۱ شرکت تأیید می‌شود/)).toBeTruthy()
      fireEvent.click(within(dialog).getByRole('button', { name: 'تأیید' }))

      await waitFor(() => {
        const decisions = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
        expect(decisions).toHaveLength(1)
        expect(decisions[0]![0]).toBe('/api/dashboard/admin/companies/rep-1/verification/decision')
      })
    })

    /** A fetch whose POST/PATCH answers only when the test says so. */
    function gatedFetch(list: unknown, mutationStatus: number) {
      let release!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const mock = vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST' || init?.method === 'PATCH') {
          await gate
          return respond(mutationStatus === 200 ? { ok: true } : { error: 'refused' }, mutationStatus)
        }
        return respond(list)
      })
      return { mock, release }
    }

    it('approves a company on screen before the server answers', async () => {
      const { mock, release } = gatedFetch(page(mockCompanyListItems), 200)
      vi.stubGlobal('fetch', mock)
      render(createElement(CompanyList))
      await screen.findByText('شرکت پترو صنعت')
      expect(screen.getByText('۱ شرکت در انتظار بررسی')).toBeTruthy()

      fireEvent.click(screen.getAllByRole('button', { name: 'عملیات' })[0]!)
      fireEvent.click(await screen.findByRole('button', { name: 'تأیید احراز هویت' }))
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'تأیید' }))

      // The request is still waiting, yet the pending banner is gone and the company shows as approved.
      await waitFor(() => expect(screen.queryByText('۱ شرکت در انتظار بررسی')).toBeNull())
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(mock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true)
      release()
    })

    it('puts the company back when the server refuses the approval', async () => {
      const { mock, release } = gatedFetch(page(mockCompanyListItems), 409)
      vi.stubGlobal('fetch', mock)
      render(createElement(CompanyList))
      await screen.findByText('شرکت پترو صنعت')

      fireEvent.click(screen.getAllByRole('button', { name: 'عملیات' })[0]!)
      fireEvent.click(await screen.findByRole('button', { name: 'تأیید احراز هویت' }))
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'تأیید' }))
      await waitFor(() => expect(screen.queryByText('۱ شرکت در انتظار بررسی')).toBeNull())

      release()
      // The server's list still has the company pending, so that is what the screen returns to.
      expect(await screen.findByText('۱ شرکت در انتظار بررسی')).toBeTruthy()
    })

    it('removes a deleted company at once', async () => {
      const { mock, release } = gatedFetch(page(mockCompanyListItems.map((item) => ({ ...item, updatedAt: '2026-11-01T10:00:00.000Z' }))), 200)
      vi.stubGlobal('fetch', mock)
      render(createElement(CompanyList, { canRemoveCompany: true }))
      await screen.findByText('شرکت نفت و گاز جنوب')

      fireEvent.click(screen.getAllByRole('button', { name: 'عملیات' })[1]!)
      fireEvent.click(await screen.findByRole('button', { name: 'حذف شرکت' }))
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'حذف شرکت‌ها' }))

      await waitFor(() => expect(screen.queryByText('شرکت نفت و گاز جنوب')).toBeNull())
      expect(screen.getByText('شرکت پترو صنعت')).toBeTruthy()
      release()
    })

    it('shows a new company at once and takes it back, with the form, when the server refuses it', async () => {
      const { mock, release } = gatedFetch(page(mockCompanyListItems), 400)
      vi.stubGlobal('fetch', mock)
      render(createElement(CompanyList, { canCreateCompany: true }))
      await screen.findByText('شرکت پترو صنعت')

      fireEvent.click(screen.getByRole('button', { name: 'شرکت جدید' }))
      const dialog = await screen.findByRole('dialog')
      const fill = (label: string, value: string) =>
        fireEvent.change(within(dialog).getByLabelText(label, { exact: false }), { target: { value } })
      fill('نام شرکت', 'شرکت تازه')
      fill('شناسه ملی', '10101010101')
      fill('حوزه فعالیت', 'انرژی')
      fill('نام و نام خانوادگی', 'مریم احمدی')
      fill('سمت در شرکت', 'مدیرعامل')
      fill('شماره تلفن همراه', '09123456789')
      fill('آدرس ایمیل', 'maryam@example.com')
      fill('رمز موقت ورود', 'Passw0rd!x')
      fireEvent.click(within(dialog).getByRole('button', { name: 'ثبت شرکت' }))

      // Waiting on the server: the dialog is closed and the company is already in the table.
      expect(await screen.findByText('شرکت تازه')).toBeTruthy()
      expect(screen.getByText('در حال ثبت…')).toBeTruthy()
      expect(screen.queryByRole('dialog')).toBeNull()

      release()
      // Refused: the row is gone and the dialog is back with what was typed.
      await waitFor(() => expect(screen.queryByText('در حال ثبت…')).toBeNull())
      const reopened = await screen.findByRole('dialog')
      expect((within(reopened).getByLabelText('نام شرکت', { exact: false }) as HTMLInputElement).value).toBe('شرکت تازه')
    })

    it('tells what is wrong in each field of the new-company form, and has a hint in every field', async () => {
      const fetchMock = vi.fn().mockResolvedValue(respond(page(mockCompanyListItems)))
      vi.stubGlobal('fetch', fetchMock)
      render(createElement(CompanyList, { canCreateCompany: true }))
      await screen.findByText('شرکت پترو صنعت')

      fireEvent.click(screen.getByRole('button', { name: 'شرکت جدید' }))
      const dialog = await screen.findByRole('dialog')
      const field = (label: string) => within(dialog).getByLabelText(label, { exact: false }) as HTMLInputElement

      // Every field says what to type.
      for (const label of [
        'نام شرکت', 'شناسه ملی', 'حوزه فعالیت', 'نوع شرکت', 'نام و نام خانوادگی',
        'سمت در شرکت', 'شماره تلفن همراه', 'آدرس ایمیل', 'رمز موقت ورود',
      ]) {
        expect(field(label).placeholder).not.toBe('')
      }

      // A field is checked when it is left, with its own message, and the message goes once it is fixed.
      fireEvent.blur(field('آدرس ایمیل'))
      expect(await within(dialog).findByText('آدرس ایمیل نماینده را وارد کنید.')).toBeTruthy()
      fireEvent.change(field('آدرس ایمیل'), { target: { value: 'not-an-email' } })
      expect(await within(dialog).findByText(/آدرس ایمیل معتبر وارد کنید/)).toBeTruthy()
      fireEvent.change(field('آدرس ایمیل'), { target: { value: 'maryam@example.com' } })
      await waitFor(() => expect(within(dialog).queryByText(/آدرس ایمیل معتبر وارد کنید/)).toBeNull())

      // Submitting the rest empty marks every required field and sends nothing.
      fireEvent.click(within(dialog).getByRole('button', { name: 'ثبت شرکت' }))
      for (const message of [
        'نام شرکت را وارد کنید.',
        'شناسه ملی شرکت را وارد کنید.',
        'حوزه فعالیت را وارد کنید.',
        'نام و نام خانوادگی نماینده را وارد کنید.',
        'سمت نماینده در شرکت را وارد کنید.',
        'شماره همراه نماینده را وارد کنید.',
        'رمز موقت ورود را وارد کنید.',
      ]) {
        expect(await within(dialog).findByText(message)).toBeTruthy()
      }
      fireEvent.change(field('شماره تلفن همراه'), { target: { value: '0912' } })
      expect(await within(dialog).findByText('شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.')).toBeTruthy()
      fireEvent.change(field('رمز موقت ورود'), { target: { value: 'short' } })
      expect(await within(dialog).findByText(/رمز موقت باید دست‌کم ۸ نویسه باشد/)).toBeTruthy()
      expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'POST')).toBe(true)
    })

    it('lets the owner deactivate the selected companies with the account version', async () => {
      const items = mockCompanyListItems.map((item, index) => ({ ...item, updatedAt: `2026-11-0${index + 1}T10:00:00.000Z` }))
      const fetchMock = vi.fn((url: string, init?: RequestInit) =>
        Promise.resolve(init?.method === 'PATCH' ? respond({ doc: { isActive: false } }) : respond(page(items))),
      )
      vi.stubGlobal('fetch', fetchMock)

      render(createElement(CompanyList, { canRemoveCompany: true }))
      await screen.findByText('شرکت پترو صنعت')

      fireEvent.click(screen.getAllByRole('checkbox', { name: 'انتخاب ردیف' })[1]!)
      const actions = screen.getByRole('group', { name: 'عملیات گروهی' })
      fireEvent.click(within(actions).getByRole('button', { name: 'حذف شرکت‌ها' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/سوابق و درخواست‌ها حذف نمی‌شود/)).toBeTruthy()
      fireEvent.click(within(dialog).getByRole('button', { name: 'حذف شرکت‌ها' }))

      await waitFor(() => {
        const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
        expect(patches).toHaveLength(1)
        expect(patches[0]![0]).toBe('/api/users/personnel/rep-2')
        expect(JSON.parse(String(patches[0]![1]!.body))).toEqual({
          expectedUpdatedAt: '2026-11-02T10:00:00.000Z',
          isActive: false,
        })
      })
    })
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
      expect(screen.getByRole('button', { name: 'تایید احراز هویت' })).toBeTruthy()
    })

    const textarea = screen.getByLabelText(/توضیحات و دلیل تصمیم/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'مدارک اولیه بررسی شد اما نسخه تغییر کرد' } })
    expect(textarea.value).toBe('مدارک اولیه بررسی شد اما نسخه تغییر کرد')

    // Click approve
    fireEvent.click(screen.getByRole('button', { name: 'تایید احراز هویت' }))

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
    expect(screen.queryByRole('button', { name: 'تایید احراز هویت' })).toBeNull()
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

  it.each([
    [401, 'نشست شما منقضی شده است'],
    [403, 'دسترسی به این بخش مجاز نیست'],
    [500, 'دریافت اطلاعات انجام نشد'],
  ])('shows the shared unavailable notice for a %i company response', async (status, title) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'x' }), { status })),
    )

    render(createElement(CompanyDetailView, { id: 'rep-1' }))

    await waitFor(() => {
      expect(screen.getByText(title)).toBeTruthy()
    })
    expect(screen.queryByText('میز کار بررسی و تصمیم احراز دبیرخانه')).toBeNull()
  })

  it('sends the refreshed revision on the decision submitted after a stale refresh', async () => {
    const detail = (revision: number) => ({
      representative: { id: 'rep-1', name: 'علی رضایی', phone: '09121111111' },
      companyId: 'comp-1',
      company: { name: 'شرکت پترو صنعت' },
      allowedActions: ['read', 'approve', 'return', 'reject'],
      verification: { id: 'verif-1', status: 'pending', revision, snapshot: {} },
    })
    let companyReads = 0
    const decisions: { expectedRevision?: number; reason?: string; action: string }[] = []
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/verification/decision')) {
        decisions.push(JSON.parse(String(init?.body)))
        if (decisions.length === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'stale_revision' }), { status: 409 }),
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({ verification: { status: 'returned', revision: 3 } }), {
            status: 200,
          }),
        )
      }
      if (url.includes('/api/dashboard/admin/companies/rep-1')) {
        companyReads++
        return Promise.resolve(
          new Response(JSON.stringify(detail(companyReads > 1 ? 3 : 2)), { status: 200 }),
        )
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }))
    })
    vi.stubGlobal('fetch', mockFetch)

    render(createElement(CompanyDetailView, { id: 'rep-1' }))
    const textarea = (await screen.findByLabelText(/توضیحات و دلیل تصمیم/)) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'نقص مدارک' } })
    expect(localStorage.getItem('dacho:company-decision:rep-1')).toBe('نقص مدارک')

    fireEvent.click(screen.getByRole('button', { name: 'برگشت جهت اصلاح' }))
    await screen.findByText(/نسخه پرونده احراز تغییر یافته است/)
    await waitFor(() => {
      expect(screen.getAllByText('نسخه ۳').length).toBeGreaterThanOrEqual(1)
    })
    expect(decisions[0]).toMatchObject({ action: 'return', expectedRevision: 2, reason: 'نقص مدارک' })

    fireEvent.click(screen.getByRole('button', { name: 'برگشت جهت اصلاح' }))
    await screen.findByText('مدارک شرکت با موفقیت جهت اصلاح بازگردانده شد.')
    expect(decisions[1]).toMatchObject({ action: 'return', expectedRevision: 3, reason: 'نقص مدارک' })
    expect(localStorage.getItem('dacho:company-decision:rep-1')).toBeNull()
  })
})
