// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BoothBooking } from '@/components/dashboard/exhibition-booths/booth-booking'
import { BoothRequestsQueue } from '@/components/dashboard/exhibition-booths/booth-requests-queue'
import * as dashboardApi from '@/utilities/dashboard-api'
import type { BoothDto, BoothReservationDto } from '@/utilities/dashboard-api'

const exhibition = { id: '7', title: 'نمایشگاه نفت', dates: null, location: null }

function booth(overrides: Partial<BoothDto> = {}): BoothDto {
  return {
    id: 'b1', exhibitionId: '7', identifier: 'A-12', specification: '۱۲ متر', location: 'سالن ۱',
    status: 'available', active: true, available: true, priceAmount: 15_000_000, priceUnit: 'toman',
    priceVersionId: 'pv1', createdAt: '', updatedAt: '',
    ...overrides,
  }
}

function reservation(overrides: Partial<BoothReservationDto> = {}): BoothReservationDto {
  return {
    id: 'r1', boothId: 'b1', boothIdentifier: 'A-12', exhibitionId: '7', companyName: 'شرکت آلفا',
    active: true, attendanceStatus: 'pending', attendanceReason: null, paymentStatus: 'unpaid',
    priceAmount: 15_000_000, createdAt: '2026-11-01T00:00:00.000Z', latestReceipt: null,
    allowedActions: ['read'],
    ...overrides,
  }
}

const receipt = {
  id: 'rc1', reservationId: 'r1', version: 1, trackingCode: '123', amountToman: 15_000_000,
  paidAt: null, description: null, status: 'pending_verification' as const, createdAt: '',
  decisionReason: null, decidedAt: null,
  files: [{ id: 'f1', receiptId: 'rc1', filename: 'fish.pdf', mimeType: 'application/pdf', sizeBytes: 10, createdAt: '' }],
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('company booth booking (FE25/FE27 basic)', () => {
  it('requests a free booth and reports a booth lost to a concurrent reservation without claiming success', async () => {
    vi.spyOn(dashboardApi, 'getExhibitionCatalogue').mockResolvedValue({
      exhibitionId: '7', companyBoothLimit: 2, guideMapReference: null,
      booths: [booth(), booth({ id: 'b2', identifier: 'B-03', available: false, status: 'unavailable' })],
    })
    vi.spyOn(dashboardApi, 'listMyBoothReservations').mockResolvedValue({ items: [] })
    const reserve = vi
      .spyOn(dashboardApi, 'reserveBooth')
      .mockRejectedValue(new dashboardApi.DashboardApiError(409, 'booth_unavailable'))

    render(createElement(BoothBooking, { exhibition }))
    const button = await screen.findByRole('button', { name: 'درخواست غرفه A-12' })
    expect(screen.getByRole('button', { name: 'درخواست غرفه B-03' })).toHaveProperty('disabled', true)
    expect(screen.getByText(/مهلت خودکار ندارد/)).toBeTruthy()

    fireEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'این غرفه هم‌زمان برای شرکت دیگری رزرو شد. فهرست غرفه‌ها به‌روز شد.',
    )
    expect(reserve).toHaveBeenCalledWith('7', 'b1')
    expect(screen.queryByText(/ثبت شد/)).toBeNull()
  })

  it('offers receipt upload only for an approved request and shows a returned receipt reason', async () => {
    vi.spyOn(dashboardApi, 'getExhibitionCatalogue').mockResolvedValue({
      exhibitionId: '7', companyBoothLimit: null, guideMapReference: null, booths: [booth()],
    })
    vi.spyOn(dashboardApi, 'listMyBoothReservations').mockResolvedValue({
      items: [
        reservation(),
        reservation({
          id: 'r2', boothId: 'b2', boothIdentifier: 'B-03', attendanceStatus: 'approved', paymentStatus: 'returned',
          allowedActions: ['read', 'submit_receipt'],
          latestReceipt: { ...receipt, reservationId: 'r2', status: 'returned', decisionReason: 'مبلغ ناخواناست' },
        }),
      ],
    })
    const upload = vi.spyOn(dashboardApi, 'uploadBoothReceipt').mockResolvedValue({
      receipt: { ...receipt, version: 2 },
      reservation: reservation({ id: 'r2', attendanceStatus: 'approved', paymentStatus: 'pending_verification' }),
    })

    render(createElement(BoothBooking, { exhibition }))
    expect(await screen.findByText('در انتظار تأیید حضور')).toBeTruthy()
    expect(screen.getByText('دلیل برگشت: مبلغ ناخواناست')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'ثبت فیش' })).toHaveLength(1)

    const file = new File(['%PDF'], 'fish-2.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/فایل فیش/), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت فیش' }))
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    expect(upload).toHaveBeenCalledWith('7', 'r2', { file, trackingCode: undefined, amountToman: 15_000_000 })
  })
})

describe('Secretariat booth request queue (FE26/FE27 basic)', () => {
  it('approves attendance and requires a reason before returning a receipt', async () => {
    vi.spyOn(dashboardApi, 'listBoothRequests').mockResolvedValue({
      items: [
        reservation({ allowedActions: ['read', 'approve', 'reject'] }),
        reservation({
          id: 'r2', boothIdentifier: 'B-03', attendanceStatus: 'approved', paymentStatus: 'pending_verification',
          latestReceipt: { ...receipt, reservationId: 'r2' },
          allowedActions: ['read', 'verify_receipt', 'return_receipt'],
        }),
      ],
    })
    const attendance = vi
      .spyOn(dashboardApi, 'decideBoothAttendance')
      .mockResolvedValue({ reservation: reservation({ attendanceStatus: 'approved' }) })
    const decide = vi.spyOn(dashboardApi, 'decideBoothReceipt').mockResolvedValue({
      receipt: { ...receipt, status: 'returned', decisionReason: 'ناخوانا' },
      reservation: reservation({ id: 'r2', paymentStatus: 'returned' }),
    })

    render(createElement(BoothRequestsQueue, { exhibition }))
    expect(await screen.findByRole('tab', { name: 'تأیید حضور (۱)' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'بررسی فیش (۱)' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'تأیید حضور' }))
    await waitFor(() => expect(attendance).toHaveBeenCalledWith('7', 'r1', { action: 'approve' }))

    fireEvent.click(await screen.findByRole('button', { name: 'برگشت فیش' }))
    fireEvent.click(screen.getByRole('button', { name: 'ثبت برگشت فیش' }))
    expect(decide).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('نوشتن دلیل الزامی است.')

    fireEvent.change(screen.getByLabelText('دلیل برگشت فیش'), { target: { value: 'ناخوانا' } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت برگشت فیش' }))
    await waitFor(() =>
      expect(decide).toHaveBeenCalledWith('7', 'r2', { action: 'return', receiptId: 'rc1', reason: 'ناخوانا' }),
    )
  })

  it('reports a stale receipt decision and refreshes the list', async () => {
    const list = vi.spyOn(dashboardApi, 'listBoothRequests').mockResolvedValue({
      items: [
        reservation({
          attendanceStatus: 'approved', paymentStatus: 'pending_verification', latestReceipt: receipt,
          allowedActions: ['read', 'verify_receipt', 'return_receipt'],
        }),
      ],
    })
    vi.spyOn(dashboardApi, 'decideBoothReceipt').mockRejectedValue(
      new dashboardApi.DashboardApiError(409, 'stale_receipt'),
    )
    render(createElement(BoothRequestsQueue, { exhibition }))
    const item = (await screen.findByText(/شرکت آلفا/)).closest('li')!
    fireEvent.click(within(item).getByRole('button', { name: 'تأیید فیش' }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'این درخواست در این فاصله تغییر کرده است. فهرست به‌روز شد.',
    )
    expect(list).toHaveBeenCalledTimes(2)
  })
})
