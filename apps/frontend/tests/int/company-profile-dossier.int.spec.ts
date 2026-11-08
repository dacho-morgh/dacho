// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompanyProfileView } from '@/components/dashboard/profile/company-profile-view'
import { ResumeProfileView } from '@/components/dashboard/profile/resume-profile-view'
import {
  DOSSIER_FIELD_LABELS,
  dossierFieldLabel,
  toEnglishDigits,
  type CompanyDossierDto,
  type DossierResponseDto,
  type ProfileDto,
  fetchProfileDossier,
  updateProfile,
  updateProfileDossier,
} from '@/utilities/dashboard-api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/profile/company',
}))

vi.mock('@/utilities/dashboard-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utilities/dashboard-api')>()),
  fetchProfileDossier: vi.fn(),
  updateProfile: vi.fn(),
  updateProfileDossier: vi.fn(),
}))

// File transport has its own integration suite; isolate dossier form behavior here.
vi.mock('@/components/documents/private-document-field', () => ({
  PrivateDocumentField: ({ label }: { label?: string }) => createElement('div', null, label),
}))

const mockProfile: ProfileDto = {
  companyId: 'comp-1',
  company: {
    name: 'شرکت نوآوران پیشرو',
    status: 'فعال',
    registrationNumber: '12345',
    nationalId: '10100578556',
    establishmentDate: '1390/01/01',
    type: 'سهامی خاص',
    economicCode: '411111495187',
  },
  contacts: {
    email: 'info@pishro.ir',
    phone: '09123456789',
  },
  executives: [{ name: 'علی رضایی', role: 'مدیرعامل' }],
  addresses: [
    {
      id: 'addr-1',
      title: 'دفتر مرکزی',
      province: 'بوشهر',
      city: 'بوشهر',
      postalCode: '7514112345',
      address: 'بلوار خلیج فارس',
    },
  ],
}

const mockDossier: CompanyDossierDto = {
  legalEntityType: 'سهامی خاص',
  knowledgeBasedStatus: 'دانش‌بنیان نوع یک',
  classification: 'فناور',
  foundingYear: '1390',
  activityDomain: 'فناوری اطلاعات و نرم‌افزار',
  website: 'https://pishro.ir',
  centerEstablishment: 'پارک علم و فناوری خلیج فارس',
  insuredEmployeeCount: 15,
  productsServices: ['سامانه جامع مانیتورینگ صنعتی', 'پلتفرم ابری داده'],
  keyMembers: [{ name: 'سارا محمدی', role: 'مدیر فنی' }],
  pastProjectsCustomers: [
    {
      project: 'هوشمندسازی پایانه صادراتی',
      customer: 'شرکت نفت',
      summary: 'طراحی زیرساخت پایش بلادرنگ',
    },
  ],
  requestedServices: ['جذب سرمایه در گردش'],
  certificatesLicenses: [
    { title: 'گواهی افتا', issuer: 'سازمان فناوری اطلاعات', reference: 'AFT-99' },
  ],
  notAvailable: [],
}

const mockDossierResponse: DossierResponseDto = {
  dossier: mockDossier,
  documents: [],
  missing: {
    required: [],
    optional: [],
    canRequestVerification: true,
  },
}

describe('Company Profile Dossier Contracts (FE04, FE30)', () => {
  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it('normalizes Persian and Arabic digits to English digits', () => {
    expect(toEnglishDigits('۱۳۸۵')).toBe('1385')
    expect(toEnglishDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789')
    expect(toEnglishDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890')
    expect(toEnglishDigits('1385')).toBe('1385')
  })

  it('provides Persian labels for all dossier fields and document categories', () => {
    expect(dossierFieldLabel('legalEntityType')).toBe('نوع شخصیت حقوقی')
    expect(dossierFieldLabel('knowledgeBasedStatus')).toBe('وضعیت دانش‌بنیانی')
    expect(dossierFieldLabel('foundingYear')).toBe('سال تأسیس')
    expect(dossierFieldLabel('articlesOfAssociation')).toBe('اساس‌نامه')
    expect(dossierFieldLabel('establishmentNotices')).toBe('آگهی تأسیس')
    expect(dossierFieldLabel('website')).toBe('وب‌سایت رسمی')
    expect(dossierFieldLabel('catalogues')).toBe('کاتالوگ شرکت')
    expect(dossierFieldLabel('unknownField')).toBe('unknownField')
    expect(DOSSIER_FIELD_LABELS.productsServices).toBe('محصولات و خدمات')
  })

  it('renders CompanyProfileView with stage-1 and stage-2 dossier information and verification badge', () => {
    render(
      createElement(CompanyProfileView, {
        initialProfile: mockProfile,
        initialDossier: mockDossierResponse,
      }),
    )

    // Verification state (S4 card): complete dossier, not yet submitted
    expect(screen.getByText('پرونده آماده ارسال برای احراز است')).toBeTruthy()

    // Basic & dossier fields
    expect(screen.getByDisplayValue('شرکت نوآوران پیشرو')).toBeTruthy()
    expect(screen.getByDisplayValue('10100578556')).toBeTruthy()
    expect(screen.getAllByDisplayValue('سهامی خاص')).toHaveLength(2)
    expect(screen.getByDisplayValue('دانش‌بنیان نوع یک')).toBeTruthy()
    expect(screen.getByDisplayValue('1390')).toBeTruthy()
    expect(screen.getByDisplayValue('https://pishro.ir')).toBeTruthy()

    // Address & executive
    expect(screen.getByText('دفتر مرکزی')).toBeTruthy()
    expect(screen.getByText('علی رضایی')).toBeTruthy()
  })

  it('renders missing required items when verification cannot be requested', () => {
    const unverifiedDossier: DossierResponseDto = {
      dossier: { ...mockDossier, legalEntityType: '', foundingYear: '' },
      documents: [],
      missing: {
        required: ['legalEntityType', 'foundingYear', 'articlesOfAssociation'],
        optional: ['website'],
        canRequestVerification: false,
      },
    }

    render(
      createElement(CompanyProfileView, {
        initialProfile: mockProfile,
        initialDossier: unverifiedDossier,
      }),
    )

    expect(screen.getByText('اطلاعات شرکت هنوز کامل نیست')).toBeTruthy()
    expect(screen.getByText('نوع شخصیت حقوقی')).toBeTruthy()
    expect(screen.getByText('سال تأسیس')).toBeTruthy()
    expect(screen.getByText('اساس‌نامه')).toBeTruthy()
  })

  it('renders ResumeProfileView with repeatable items and absence states (FE04, FE29)', () => {
    render(
      createElement(ResumeProfileView, {
        initialDossier: mockDossierResponse,
        companyId: 'comp-1',
      }),
    )

    // Products & Services
    expect(screen.getByText('سامانه جامع مانیتورینگ صنعتی')).toBeTruthy()
    expect(screen.getByText('پلتفرم ابری داده')).toBeTruthy()

    // Key members
    expect(screen.getByText('سارا محمدی')).toBeTruthy()
    expect(screen.getByText('مدیر فنی')).toBeTruthy()

    // Past projects
    expect(screen.getByText('هوشمندسازی پایانه صادراتی')).toBeTruthy()
    expect(screen.getByText(/شرکت نفت/)).toBeTruthy()

    // Requested services
    expect(screen.getByText('جذب سرمایه در گردش')).toBeTruthy()

    // Certificates
    expect(screen.getByText('گواهی افتا')).toBeTruthy()
  })

  it('shows no "ندارم" checkbox in the resume view and keeps legacy absent sections usable', () => {
    const absentDossier: DossierResponseDto = {
      dossier: {
        ...mockDossier,
        pastProjectsCustomers: [],
        notAvailable: ['pastProjectsCustomers', 'catalogues'],
      },
      documents: [],
      missing: {
        required: [],
        optional: [],
        canRequestVerification: true,
      },
    }

    render(
      createElement(ResumeProfileView, {
        initialDossier: absentDossier,
        companyId: 'comp-1',
      }),
    )

    // Design QA #277: the user leaves an unavailable item empty instead of ticking a box.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByText(/ندارم/)).toBeNull()
    expect(screen.getByRole('button', { name: 'پروژه جدید' })).toBeTruthy()
    expect(screen.getByText('فایل کاتالوگ')).toBeTruthy()
  })

  it('blocks company edits after a failed dossier read instead of saving empty defaults', async () => {
    vi.mocked(fetchProfileDossier).mockRejectedValueOnce(new Error('offline'))
    render(createElement(CompanyProfileView, { initialProfile: mockProfile }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'ویرایش' })).toBeNull()
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeTruthy()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('blocks resume writes when the dossier response is missing', async () => {
    vi.mocked(fetchProfileDossier).mockResolvedValueOnce(undefined)
    render(createElement(ResumeProfileView, { companyId: 'comp-1' }))
    await screen.findByRole('alert')
    expect(screen.queryByText('محصول جدید')).toBeNull()
    expect(updateProfileDossier).not.toHaveBeenCalled()
  })

  it('sends only changed basic fields and preserves unrelated dossier values', async () => {
    vi.mocked(fetchProfileDossier).mockResolvedValue(mockDossierResponse)
    vi.mocked(updateProfile).mockResolvedValue(mockProfile)
    render(
      createElement(CompanyProfileView, {
        initialProfile: mockProfile,
        initialDossier: mockDossierResponse,
      }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0]!)
    fireEvent.change(screen.getByDisplayValue(mockProfile.company.name), {
      target: { value: 'نام تازه' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({ company: { name: 'نام تازه' }, dossier: {} }),
    )
  })

  it('clears a legacy absence answer when the website is filled in, keeping other flags', async () => {
    const legacy: DossierResponseDto = {
      ...mockDossierResponse,
      dossier: { ...mockDossier, website: '', notAvailable: ['website'] },
    }
    vi.mocked(fetchProfileDossier).mockResolvedValue({
      ...legacy,
      dossier: { ...legacy.dossier, notAvailable: ['requestedServices', 'website'] },
    })
    vi.mocked(updateProfile).mockResolvedValue(mockProfile)
    render(
      createElement(CompanyProfileView, {
        initialProfile: mockProfile,
        initialDossier: legacy,
      }),
    )
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0]!)
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), {
      target: { value: 'https://novin.ir' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        company: {},
        dossier: { website: 'https://novin.ir', notAvailable: ['requestedServices'] },
      }),
    )
  })

  it('keeps a saved absence answer when the optional field stays empty', async () => {
    const legacy: DossierResponseDto = {
      ...mockDossierResponse,
      dossier: { ...mockDossier, website: '', notAvailable: ['website'] },
    }
    vi.mocked(fetchProfileDossier).mockResolvedValue(legacy)
    vi.mocked(updateProfile).mockResolvedValue(mockProfile)
    render(createElement(CompanyProfileView, { initialProfile: mockProfile, initialDossier: legacy }))
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0]!)
    fireEvent.change(screen.getByDisplayValue(mockProfile.company.name), { target: { value: 'نام تازه' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({ company: { name: 'نام تازه' }, dossier: {} }),
    )
  })

  it('refuses a stale resume array rather than replacing newer saved entries', async () => {
    vi.mocked(fetchProfileDossier).mockResolvedValue({
      ...mockDossierResponse,
      dossier: {
        ...mockDossier,
        productsServices: [...mockDossier.productsServices, 'محصول همکار'],
      },
    })
    render(
      createElement(ResumeProfileView, {
        initialDossier: mockDossierResponse,
        companyId: 'comp-1',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: `حذف ${mockDossier.productsServices[0]}` }))
    await screen.findByText('محصول همکار')
    expect(screen.getByRole('alert').textContent).toContain('نسخه تازه')
    expect(updateProfileDossier).not.toHaveBeenCalled()
  })

  it('serializes resume replacement writes while a save is pending', async () => {
    vi.mocked(fetchProfileDossier).mockResolvedValue(mockDossierResponse)
    let complete!: (response: DossierResponseDto) => void
    vi.mocked(updateProfileDossier).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    render(
      createElement(ResumeProfileView, {
        initialDossier: mockDossierResponse,
        companyId: 'comp-1',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: `حذف ${mockDossier.productsServices[0]}` }))
    await waitFor(() => expect(updateProfileDossier).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'حذف سارا محمدی' }))
    expect(updateProfileDossier).toHaveBeenCalledTimes(1)
    complete(mockDossierResponse)
    await screen.findByText('تغییرات با موفقیت ذخیره شد.')
  })

  it('offers no absence checkbox for amendment notices and still shows the uploader', () => {
    const legacy: DossierResponseDto = {
      ...mockDossierResponse,
      dossier: { ...mockDossier, notAvailable: ['amendmentNotices'] },
    }
    render(createElement(CompanyProfileView, { initialProfile: mockProfile, initialDossier: legacy }))
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByText(/ندارم/)).toBeNull()
    expect(screen.getByText('آگهی‌های آخرین تغییرات')).toBeTruthy()
  })

  it('marks required basic fields with * while editing and lists no "ندارم" option', () => {
    render(
      createElement(CompanyProfileView, {
        initialProfile: mockProfile,
        initialDossier: mockDossierResponse,
      }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0]!)
    expect(screen.getAllByText('*', { selector: '[data-slot="required-marker"]' }).length).toBeGreaterThan(5)
    expect(screen.getByPlaceholderText('نام شرکت را وارد کنید')).toBeTruthy()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })
})
