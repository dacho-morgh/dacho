// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountProfileView } from '@/components/dashboard/profile/account-profile-view'
import { CompanyProfileView } from '@/components/dashboard/profile/company-profile-view'
import { ResumeProfileView } from '@/components/dashboard/profile/resume-profile-view'
import type { DossierResponseDto, ProfileDto } from '@/utilities/dashboard-api'

// Document transport is covered separately; these tests focus on profile layout and editing.
vi.mock('@/components/documents/private-document-field', () => ({
  PrivateDocumentField: () => null,
}))

const profile: ProfileDto = {
  company: {
    name: 'شرکت نمونه',
    establishmentDate: '۱۳۵۱/۰۴/۱۲ (54 سال)',
    status: 'فعال',
    type: 'سهامی خاص',
    registrationNumber: '۱۵۷۸۱',
    economicCode: '10100578556',
    nationalId: '411111495187',
  },
  contacts: { phone: '۰۹۱۲۳۴۵۶۷۸۹', email: 'sample@company.com' },
  executives: [{ role: 'مدیرعامل', name: 'کاربر نمونه' }],
  addresses: [
    {
      id: '1',
      title: 'دفتر مرکزی',
      province: 'تهران',
      city: 'تهران',
      postalCode: '1531638111',
      address: 'تهران',
    },
  ],
}

const dossier: DossierResponseDto = {
  dossier: {
    legalEntityType: '', knowledgeBasedStatus: '', classification: '', foundingYear: '',
    activityDomain: '', website: '', centerEstablishment: '', insuredEmployeeCount: null,
    productsServices: [], keyMembers: [], pastProjectsCustomers: [], requestedServices: [],
    certificatesLicenses: [], notAvailable: [],
  },
  documents: [],
  missing: { required: [], optional: [], canRequestVerification: false },
}

function expectHeadingBeforeAction(heading: HTMLElement) {
  const header = heading.parentElement
  expect(header?.firstElementChild).toBe(heading)
  expect(header?.lastElementChild?.tagName).toBe('BUTTON')
}

describe('company profile view', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    render(createElement(CompanyProfileView, { initialProfile: profile, initialDossier: dossier }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders only company sections in RTL', () => {
    const root = screen.getByAltText('Company Profile Avatar').closest('[dir="rtl"]')
    expect(root).not.toBeNull()
    expectHeadingBeforeAction(screen.getByRole('heading', { level: 2, name: 'اطلاعات پایه' }))
    expectHeadingBeforeAction(screen.getByRole('heading', { level: 2, name: 'آدرس ها' }))
    expectHeadingBeforeAction(screen.getByRole('heading', { level: 2, name: 'اشخاص' }))
    expect(screen.queryByRole('heading', { name: 'اطلاعات تماس' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'رزومه و سوابق شرکت' })).toBeNull()
  })

  it('keeps mixed-direction values isolated', () => {
    for (const label of ['شماره ثبت', 'کد اقتصادی', 'شناسه ملی']) {
      expect(screen.getByRole('textbox', { name: label }).getAttribute('dir')).toBe('ltr')
    }
    expect(screen.getByRole('textbox', { name: 'تاریخ تاسیس' }).getAttribute('dir')).toBe('auto')
    expect(screen.getByText('1531638111').getAttribute('dir')).toBe('ltr')
  })

  it('edits and saves company information inline', async () => {
    const fetchMock = vi.mocked(fetch)
    const savedProfile = { ...profile, company: { ...profile.company, name: 'شرکت ویرایش‌شده' } }
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(dossier), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(savedProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(dossier), { status: 200 }))

    const input = screen.getByRole('textbox', { name: 'نام شرکت' }) as HTMLInputElement
    expect(input.readOnly).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'ویرایش' }))
    expect(input.readOnly).toBe(false)
    expect((screen.getByRole('textbox', { name: 'شناسه ملی' }) as HTMLInputElement).readOnly).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.change(input, { target: { value: 'شرکت ویرایش‌شده' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))

    await waitFor(() => expect(input.readOnly).toBe(true))
    expect(input.value).toBe('شرکت ویرایش‌شده')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/profile',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('keeps address dialogs inside the company component', () => {
    fireEvent.click(screen.getByRole('button', { name: 'آدرس جدید' }))
    expectHeadingBeforeAction(
      screen.getByRole('heading', { level: 3, name: 'اضافه کردن آدرس جدید' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'بستن پنجره' }))

    fireEvent.click(screen.getByTitle('ویرایش آدرس'))
    expectHeadingBeforeAction(screen.getByRole('heading', { level: 3, name: 'ویرایش آدرس' }))
  })
})

describe('account and resume profile views', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders and edits only account fields', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(createElement(AccountProfileView, { initialProfile: profile }))

    const phone = screen.getByRole('textbox', { name: 'شماره تلفن همراه' }) as HTMLInputElement
    expect(phone.dir).toBe('ltr')
    expect(phone.readOnly).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'ویرایش' }))
    expect(phone.readOnly).toBe(false)
    expect(screen.queryByRole('heading', { name: 'اطلاعات پایه' })).toBeNull()
  })

  it('renders the resume route content independently', () => {
    render(createElement(ResumeProfileView))
    expect(screen.getByRole('heading', { name: 'رزومه و سوابق شرکت' })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
