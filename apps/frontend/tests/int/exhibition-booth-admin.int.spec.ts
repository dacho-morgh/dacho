// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ExhibitionBoothAdmin,
  type ExhibitionInfo,
} from '@/components/dashboard/exhibition-admin/exhibition-booth-admin'
import * as dashboardApi from '@/utilities/dashboard-api'

const mockCatalogue: dashboardApi.ExhibitionCatalogueDto = {
  exhibitionId: 'exhibition-1',
  companyBoothLimit: 2,
  guideMapReference: 'doc-map-1',
  booths: [
    {
      id: 'booth-1',
      exhibitionId: 'exhibition-1',
      identifier: 'A-101',
      specification: '۱۲ متر مربع، اسپیس فریم',
      location: 'سالن اصلی',
      status: 'available',
      active: true,
      available: true,
      priceAmount: 15000000,
      priceUnit: 'toman',
      priceVersionId: 'pv-1',
      createdAt: '2026-10-27T00:00:00Z',
      updatedAt: '2026-10-27T00:00:00Z',
    },
    {
      id: 'booth-2',
      exhibitionId: 'exhibition-1',
      identifier: 'B-202',
      specification: '۲۴ متر مربع جزیره',
      location: 'سالن ملل',
      status: 'unavailable',
      active: false,
      available: false,
      priceAmount: 30000000,
      priceUnit: 'toman',
      priceVersionId: 'pv-2',
      createdAt: '2026-10-27T00:00:00Z',
      updatedAt: '2026-10-27T00:00:00Z',
    },
  ],
}

const mockExhibition: ExhibitionInfo = {
  id: 'exhibition-1',
  title: 'نمایشگاه بین‌المللی فناوری',
  location: 'محل دائمی نمایشگاه‌ها',
  dates: '۱ تا ۴ آذر ۱۴۰۵',
}

describe('ExhibitionBoothAdmin component', () => {
  beforeEach(() => {
    vi.spyOn(dashboardApi, 'getAdminExhibitionCatalogue').mockResolvedValue(mockCatalogue)
    vi.spyOn(dashboardApi, 'updateExhibitionSettings').mockResolvedValue({
      settings: {
        exhibitionId: 'exhibition-1',
        companyBoothLimit: 3,
        guideMapReference: 'doc-map-2',
        updatedAt: '2026-10-27T10:00:00Z',
      },
    })
    vi.spyOn(dashboardApi, 'createBooth').mockResolvedValue({
      booth: {
        id: 'booth-3',
        exhibitionId: 'exhibition-1',
        identifier: 'C-303',
        specification: '۱۸ متر مربع',
        location: 'سالن ۳',
        status: 'available',
        active: true,
        available: true,
        priceAmount: 20000000,
        priceUnit: 'toman',
        priceVersionId: 'pv-3',
        createdAt: '2026-10-27T10:00:00Z',
        updatedAt: '2026-10-27T10:00:00Z',
      },
    })
    vi.spyOn(dashboardApi, 'updateBooth').mockResolvedValue({
      booth: {
        ...mockCatalogue.booths[0],
        specification: 'مشخصات ویرایش شده',
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('includes the explicit toman unit when editing an existing booth', async () => {
    render(
      createElement(ExhibitionBoothAdmin, {
        exhibition: mockExhibition,
        initialCatalogue: mockCatalogue,
      }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }))
    await waitFor(() =>
      expect(dashboardApi.updateBooth).toHaveBeenCalledWith(
        'exhibition-1',
        'booth-1',
        expect.objectContaining({ priceAmount: 15000000, priceUnit: 'toman' }),
      ),
    )
  })

  it('keeps failed catalogue loads distinct from empty data and disables mutation controls', async () => {
    vi.mocked(dashboardApi.getAdminExhibitionCatalogue).mockRejectedValue(
      new dashboardApi.DashboardApiError(403, 'forbidden'),
    )
    render(createElement(ExhibitionBoothAdmin, { exhibition: mockExhibition }))
    expect(
      (screen.getByRole('button', { name: 'ذخیره تنظیمات' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect((await screen.findByRole('alert')).textContent).toContain('اجازه مدیریت')
    expect(screen.queryByText('هنوز غرفه‌ای برای این نمایشگاه تعریف نشده است')).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'تعریف غرفه جدید' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(dashboardApi.updateExhibitionSettings).not.toHaveBeenCalled()
  })

  it('rejects decimal prices without issuing a different integer price', async () => {
    render(
      createElement(ExhibitionBoothAdmin, {
        exhibition: mockExhibition,
        initialCatalogue: mockCatalogue,
      }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0])
    fireEvent.change(screen.getByLabelText(/قیمت قطعی غرفه/), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }))
    await screen.findByRole('alert')
    expect(dashboardApi.updateBooth).not.toHaveBeenCalled()
  })

  it('locks duplicate submits and closing while pending and preserves answers on failure', async () => {
    let fail!: (reason: Error) => void
    vi.mocked(dashboardApi.updateBooth).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject
        }),
    )
    render(
      createElement(ExhibitionBoothAdmin, {
        exhibition: mockExhibition,
        initialCatalogue: mockCatalogue,
      }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0])
    const form = screen.getByRole('form', { name: 'اطلاعات غرفه' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(dashboardApi.updateBooth).toHaveBeenCalledOnce())
    expect((screen.getByRole('button', { name: 'بستن' }) as HTMLButtonElement).disabled).toBe(true)
    fail(new dashboardApi.DashboardApiError(409, 'duplicate_identifier'))
    await screen.findByRole('alert')
    expect((screen.getByLabelText(/شناسه غرفه/) as HTMLInputElement).value).toBe('A-101')
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'ذخیره تغییرات' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    )
  })

  it('renders catalogue settings, stats badges and booth list in toman', async () => {
    render(
      createElement(ExhibitionBoothAdmin, {
        exhibition: mockExhibition,
        initialCatalogue: mockCatalogue,
      }),
    )

    expect(screen.getByText(/مدیریت کاتالوگ غرفه‌ها: نمایشگاه بین‌المللی فناوری/)).toBeDefined()
    expect(screen.getAllByText('A-101').length).toBeGreaterThan(0)
    expect(screen.getAllByText('B-202').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('2')).toBeDefined()
    expect(screen.getByDisplayValue('doc-map-1')).toBeDefined()
    expect(screen.getByText('کل: 2')).toBeDefined()
    expect(screen.getByText('فعال: 1')).toBeDefined()
    expect(screen.getByText('در دسترس: 1')).toBeDefined()
  })

  it('saves updated company booth limit and guide map reference', async () => {
    render(
      createElement(ExhibitionBoothAdmin, {
        exhibition: mockExhibition,
        initialCatalogue: mockCatalogue,
      }),
    )

    const limitInput = screen.getByLabelText('سقف مجاز غرفه برای هر شرکت (تعداد)')
    fireEvent.change(limitInput, { target: { value: '3' } })

    const saveBtn = screen.getByRole('button', { name: /ذخیره تنظیمات/ })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(dashboardApi.updateExhibitionSettings).toHaveBeenCalledWith('exhibition-1', {
        companyBoothLimit: 3,
        guideMapReference: 'doc-map-1',
      })
      expect(screen.getByText(/تنظیمات کاتالوگ با موفقیت به‌روزرسانی شد/)).toBeDefined()
    })
  })

  it('filters booths by search query and status', async () => {
    render(
      createElement(ExhibitionBoothAdmin, {
        exhibition: mockExhibition,
        initialCatalogue: mockCatalogue,
      }),
    )

    const searchInput = screen.getByPlaceholderText('جستجو در غرفه‌ها...')
    fireEvent.change(searchInput, { target: { value: 'A-101' } })

    expect(screen.getAllByText('A-101').length).toBeGreaterThan(0)
    expect(screen.queryByText('B-202')).toBeNull()
  })

  it('opens modal, validates inputs, and creates new booth', async () => {
    render(
      createElement(ExhibitionBoothAdmin, {
        exhibition: mockExhibition,
        initialCatalogue: mockCatalogue,
      }),
    )

    const addBtn = screen.getByRole('button', { name: /تعریف غرفه جدید/ })
    fireEvent.click(addBtn)

    expect(screen.getByText('افزودن غرفه جدید')).toBeDefined()

    fireEvent.change(screen.getByLabelText(/شناسه غرفه/), { target: { value: 'C-303' } })
    fireEvent.change(screen.getByLabelText(/ابعاد و مشخصات/), { target: { value: '۱۸ متر مربع' } })
    fireEvent.change(screen.getByLabelText(/قیمت قطعی غرفه/), { target: { value: '۲۰۰۰۰۰۰۰' } })

    const submitBtn = screen.getByRole('button', { name: 'ثبت غرفه' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(dashboardApi.createBooth).toHaveBeenCalledWith(
        'exhibition-1',
        expect.objectContaining({
          identifier: 'C-303',
          specification: '۱۸ متر مربع',
          priceAmount: 20000000,
          priceUnit: 'toman',
        }),
      )
    })
  })
})
