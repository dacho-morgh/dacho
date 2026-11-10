// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordDialog } from '@/components/dashboard/profile/change-password-dialog'
import {
  COMPANY_EDIT_REVERIFICATION_REASON,
  CompanyVerificationCard,
} from '@/components/dashboard/profile/company-verification-card'
import { PersonalInfoSection } from '@/components/dashboard/profile/personal-info-section'
import { useReverificationConfirm } from '@/components/dashboard/profile/use-reverification-confirm'
import type { CompanyVerificationDto, MissingDossierItemsDto } from '@/utilities/dashboard-api'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const complete: MissingDossierItemsDto = { required: [], optional: [], canRequestVerification: true }
const verification = (patch: Partial<CompanyVerificationDto>): CompanyVerificationDto => ({
  status: 'unsubmitted', revision: 0, submittedAt: null, decidedAt: null, reason: null, canRequestVerification: true, ...patch,
})
const card = (v: CompanyVerificationDto, missing = complete, onSubmit = vi.fn()) =>
  render(createElement(CompanyVerificationCard, {
    verification: v, missing, companyName: 'شرکت نمونه', nationalId: '10100578556', submitting: false, onSubmit,
  }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('S4 company verification card (Figma 16, 22-24)', () => {
  it('asks for the missing items while the dossier is incomplete and names the page and section of each, with submit disabled and no complete-info button', () => {
    card(verification({ canRequestVerification: false }), { required: ['articlesOfAssociation'], optional: [], canRequestVerification: false })
    expect(screen.getByText('اطلاعات شرکت هنوز کامل نیست')).toBeTruthy()
    expect(screen.getByText('اساس‌نامه')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'ارسال برای احراز' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/صفحهٔ «پروفایل شرکت»، بخش «مدارک رسمی شرکت»/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'تکمیل اطلاعات شرکت' })).toBeNull()
    expect(screen.queryByText('تکمیل اطلاعات')).toBeNull()
  })

  it('groups missing items by the page and section that hold their form', () => {
    card(verification({ canRequestVerification: false }), {
      required: ['legalEntityType', 'foundingYear', 'articlesOfAssociation', 'productsServices', 'addresses'],
      optional: [],
      canRequestVerification: false,
    })
    const groups = Array.from(document.querySelectorAll('[data-slot="missing-group"]')).map((group) => group.textContent)
    expect(groups).toEqual([
      'صفحهٔ «پروفایل شرکت»، بخش «اطلاعات پایه»؛ این موارد را پر کنید:نوع شخصیت حقوقیسال تأسیس',
      'صفحهٔ «پروفایل شرکت»، بخش «مدارک رسمی شرکت»؛ این موارد را پر کنید:اساس‌نامه',
      'صفحهٔ «رزومه»، بخش «محصولات و خدمات»؛ این موارد را پر کنید:محصولات و خدمات',
      'صفحهٔ «پروفایل شرکت»، بخش «آدرس‌ها»؛ این موارد را پر کنید:آدرس‌ها',
    ])
  })

  it('shows the review steps while pending and the approval facts once approved', () => {
    card(verification({ status: 'pending', submittedAt: '2026-11-01T00:00:00.000Z', canRequestVerification: false }))
    expect(screen.getByText('احراز هویت در حال بررسی است')).toBeTruthy()
    expect(screen.getByText('بررسی دبیرخانه')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'مشاهده کارتابل نامه' }).getAttribute('href')).toBe('/dashboard/inbox')
    expect(screen.queryByRole('button', { name: 'ارسال برای احراز' })).toBeNull()
    cleanup()
    card(verification({ status: 'approved', decidedAt: '2026-11-02T00:00:00.000Z', canRequestVerification: false }))
    expect(screen.getByText('شرکت شما احراز هویت شده است')).toBeTruthy()
    expect(screen.getByText('10100578556')).toBeTruthy()
    expect(screen.queryByText(/ثبت درخواست رسمی و رزرو غرفه/)).toBeNull()
  })

  it('shows the reason and a resubmit action after rejection or an edit-driven return', () => {
    const onSubmit = vi.fn()
    card(verification({ status: 'rejected', reason: 'مدارک مطابقت ندارد' }), complete, onSubmit)
    expect(screen.getByText('مدارک مطابقت ندارد')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'ارسال دوباره برای احراز' }))
    expect(onSubmit).toHaveBeenCalledOnce()
    cleanup()
    card(verification({ status: 'returned', reason: COMPANY_EDIT_REVERIFICATION_REASON }))
    expect(screen.getByText('اطلاعات شرکت ویرایش شد؛ احراز مجدد لازم است')).toBeTruthy()
    expect(screen.getByText(/ثبت درخواست رسمی و رزرو غرفه/)).toBeTruthy()
  })
})

describe('S4 re-verification warning (FE38)', () => {
  it('resolves at once when nothing is approved or pending', async () => {
    const { result } = renderHook(() => useReverificationConfirm('returned'))
    await expect(result.current.confirm()).resolves.toBe(true)
  })

  it('asks before an edit that withdraws an approval and honours cancel and confirm', async () => {
    const { result } = renderHook(() => useReverificationConfirm('approved'))
    const { rerender } = render(result.current.dialog)
    let answer!: Promise<boolean>
    act(() => { answer = result.current.confirm() })
    rerender(result.current.dialog)
    fireEvent.click(await screen.findByRole('button', { name: 'انصراف' }))
    await expect(answer).resolves.toBe(false)

    act(() => { answer = result.current.confirm() })
    rerender(result.current.dialog)
    fireEvent.click(await screen.findByRole('button', { name: 'ذخیره و احراز مجدد' }))
    await expect(answer).resolves.toBe(true)
  })
})

describe('S4 own account (FE37)', () => {
  const account = { id: 7, name: 'کاربر', phone: '09120000000', email: '', updatedAt: '2026-11-03T00:00:00.000Z' }

  it('sends only changed fields with the concurrency token and shows a taken mobile under its field', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'account_conflict', errors: [{ field: 'phone', code: 'taken' }] }), { status: 409 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(createElement(PersonalInfoSection, { initialAccount: account }))
    fireEvent.click(screen.getByRole('button', { name: 'ویرایش' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'شماره تلفن همراه' }), { target: { value: '۰۹۱۲۱۱۱۲۲۲۲' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/users/me/account')
    expect(JSON.parse(init.body)).toEqual({ phone: '09121112222', expectedUpdatedAt: account.updatedAt })
    expect(await screen.findByText('این شماره همراه برای حساب دیگری ثبت شده است.')).toBeTruthy()
    expect(screen.getByText('برخی از مقادیر پذیرفته نشد. موارد مشخص‌شده را اصلاح کنید.')).toBeTruthy()
  })

  it('validates the password change before sending and maps a wrong current password to its field', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_current_password' }), { status: 403 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(createElement(ChangePasswordDialog, { open: true, onOpenChange: vi.fn() }))
    const fill = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fill('رمز فعلی', 'old-password')
    fill('رمز جدید', 'new-password-1')
    fireEvent.click(screen.getByRole('button', { name: 'تغییر رمز' }))
    expect(await screen.findByText('تکرار رمز جدید را وارد کنید.')).toBeTruthy()

    fill('تکرار رمز جدید', 'different')
    fireEvent.click(screen.getByRole('button', { name: 'تغییر رمز' }))
    expect(await screen.findByText('تکرار رمز با رمز جدید یکسان نیست.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    fill('تکرار رمز جدید', 'new-password-1')
    fireEvent.click(screen.getByRole('button', { name: 'تغییر رمز' }))
    expect(await screen.findByText('رمز فعلی درست نیست.')).toBeTruthy()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ currentPassword: 'old-password', newPassword: 'new-password-1' })
  })
})
