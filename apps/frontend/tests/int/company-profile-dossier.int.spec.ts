// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { chooseOption } from './combobox-helpers'

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
    economicCode: '41111149518',
    province: 'بوشهر',
    city: 'برازجان',
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
  productsServices: [{ title: 'سامانه جامع مانیتورینگ صنعتی' }, { title: 'پلتفرم ابری داده' }],
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
    // The company type; the separate legal-entity type field is no longer shown.
    expect(screen.getAllByDisplayValue('سهامی خاص')).toHaveLength(1)
    expect(screen.getByDisplayValue('دانش‌بنیان نوع یک')).toBeTruthy()
    // The founding year is no longer shown (the establishment date covers it).
    expect(screen.queryByDisplayValue('1390')).toBeNull()
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
    // The missing-item badge and the (now unsuffixed, `*`-marked) upload field share the label.
    expect(screen.getAllByText('اساس‌نامه').length).toBeGreaterThan(0)
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

  it('applies the registration rules to the company fields and does not save until they pass', async () => {
    vi.mocked(fetchProfileDossier).mockResolvedValue(mockDossierResponse)
    vi.mocked(updateProfile).mockResolvedValue(mockProfile)
    // A company registered before these fields were required.
    const older: ProfileDto = {
      ...mockProfile,
      company: { ...mockProfile.company, economicCode: '411111495187', province: '', city: '' },
    }
    render(createElement(CompanyProfileView, { initialProfile: older, initialDossier: mockDossierResponse }))
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0]!)
    fireEvent.change(screen.getByDisplayValue('12345'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))

    // The register form's messages, on their fields.
    expect(await screen.findByText('شماره ثبت باید بین ۳ تا ۶ رقم باشد.')).toBeTruthy()
    expect(screen.getByText('کد اقتصادی باید ۱۱ رقم باشد.')).toBeTruthy()
    expect(screen.getByText('استان را انتخاب کنید.')).toBeTruthy()
    expect(screen.getByText('شهر را انتخاب کنید.')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('لطفاً موارد مشخص‌شده را اصلاح کنید.')
    expect(updateProfile).not.toHaveBeenCalled()

    // Correcting a field clears its message.
    fireEvent.change(screen.getByDisplayValue('12'), { target: { value: '۱۲۳۴۵۶' } })
    expect(screen.queryByText('شماره ثبت باید بین ۳ تا ۶ رقم باشد.')).toBeNull()
  })

  it('sends numeric registration fields with English digits, as signup stores them', async () => {
    vi.mocked(fetchProfileDossier).mockResolvedValue(mockDossierResponse)
    vi.mocked(updateProfile).mockResolvedValue(mockProfile)
    render(createElement(CompanyProfileView, { initialProfile: mockProfile, initialDossier: mockDossierResponse }))
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0]!)
    fireEvent.change(screen.getByDisplayValue('12345'), { target: { value: ' ۵۴۳۲۱ ' } })
    fireEvent.change(screen.getByDisplayValue('41111149518'), { target: { value: '۴۲۲۲۲۲۲۲۲۲۲' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        company: { registrationNumber: '54321', economicCode: '42222222222' },
        dossier: {},
      }),
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
    // The only checkbox is the center-establishment answer; no «ندارم» checkboxes.
    expect(screen.queryAllByRole('checkbox').map((box) => box.id)).toEqual(['company-basic-centerEstablishment'])
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
        productsServices: [...mockDossier.productsServices, { title: 'محصول همکار' }],
      },
    })
    render(
      createElement(ResumeProfileView, {
        initialDossier: mockDossierResponse,
        companyId: 'comp-1',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: `حذف ${mockDossier.productsServices[0]!.title}` }))
    await screen.findByText('محصول همکار')
    expect(screen.getByRole('alert').textContent).toContain('نسخه تازه')
    expect(updateProfileDossier).not.toHaveBeenCalled()
  })

  it('offers knowledge-based status and classification as lists and saves the center answer from a checkbox', async () => {
    vi.mocked(fetchProfileDossier).mockResolvedValue(mockDossierResponse)
    vi.mocked(updateProfile).mockResolvedValue(mockProfile)
    render(createElement(CompanyProfileView, { initialProfile: mockProfile, initialDossier: mockDossierResponse }))
    // Removed fields are gone.
    for (const removed of [/نوع شخصیت حقوقی/, /سال تأسیس \(عدد/, /^وضعیت شرکت$/]) {
      expect(screen.queryByText(removed)).toBeNull()
    }
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0]!)

    const classification = screen.getByRole('combobox', { name: 'طبقه‌بندی شرکت' })
    fireEvent.focus(classification)
    fireEvent.change(classification, { target: { value: 'صنع' } })
    fireEvent.click(await screen.findByRole('option', { name: 'صنعتی' }))
    const knowledge = screen.getByRole('combobox', { name: 'وضعیت دانش‌بنیانی' })
    fireEvent.focus(knowledge)
    fireEvent.change(knowledge, { target: { value: 'نوع دو' } })
    fireEvent.click(await screen.findByRole('option', { name: 'دانش‌بنیان نوع دو' }))

    // The company had a park name: unticking records "not established".
    const center = screen.getByRole('checkbox', { name: 'استقرار در مرکز رشد / پارک علم و فناوری' })
    expect(center.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(center)
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        company: {},
        dossier: {
          knowledgeBasedStatus: 'دانش‌بنیان نوع دو',
          classification: 'صنعتی',
          // "Not established"; the server clears the old park name with it.
          notAvailable: ['centerEstablishment'],
        },
      }),
    )
  })

  it('asks for a key member\'s education and degree place and drops the certificate issuer and number', async () => {
    vi.mocked(fetchProfileDossier).mockResolvedValue(mockDossierResponse)
    vi.mocked(updateProfileDossier).mockResolvedValue(mockDossierResponse)
    render(createElement(ResumeProfileView, { initialDossier: mockDossierResponse, companyId: 'comp-1' }))

    fireEvent.click(screen.getByRole('button', { name: 'عضو جدید' }))
    fireEvent.change(screen.getByLabelText('نام و نام خانوادگی'), { target: { value: 'رضا کریمی' } })
    fireEvent.change(screen.getByLabelText('سمت / نقش'), { target: { value: 'مدیر تولید' } })
    fireEvent.change(screen.getByLabelText('تحصیلات (اختیاری)'), { target: { value: 'کارشناسی مکانیک' } })
    fireEvent.change(screen.getByLabelText('محل اخذ مدرک (اختیاری)'), { target: { value: 'دانشگاه تهران' } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت' }))
    await waitFor(() =>
      expect(updateProfileDossier).toHaveBeenCalledWith({
        keyMembers: [
          ...mockDossier.keyMembers,
          { name: 'رضا کریمی', role: 'مدیر تولید', education: 'کارشناسی مکانیک', degreePlace: 'دانشگاه تهران' },
        ],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'افزودن' }))
    expect(screen.queryByLabelText(/مرجع صادرکننده/)).toBeNull()
    expect(screen.queryByLabelText(/شماره مرجع/)).toBeNull()
    const picker = screen.getByLabelText('فایل یا عکس گواهی (اختیاری)') as HTMLInputElement
    expect(picker.type).toBe('file')
    expect(picker.accept).toContain('.png')
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
    fireEvent.click(screen.getByRole('button', { name: `حذف ${mockDossier.productsServices[0]!.title}` }))
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
    // The only checkbox is the center-establishment answer; no «ندارم» checkboxes.
    expect(screen.queryAllByRole('checkbox').map((box) => box.id)).toEqual(['company-basic-centerEstablishment'])
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
    expect(document.querySelectorAll('[data-slot="required-marker"]').length).toBeGreaterThan(5)
    // The register form's placeholder.
    expect(screen.getByPlaceholderText('نام رسمی شرکت را وارد کنید')).toBeTruthy()
    // The only checkbox is the center-establishment answer; no «ندارم» checkboxes.
    expect(screen.queryAllByRole('checkbox').map((box) => box.id)).toEqual(['company-basic-centerEstablishment'])
  })

  it('lays the basic fields out in one equal-height grid and saves with a primary button on the right', () => {
    render(
      createElement(CompanyProfileView, { initialProfile: mockProfile, initialDossier: mockDossierResponse }),
    )
    const grid = document.querySelector('[data-slot="basic-info-grid"]')!
    expect(grid.className).toContain('grid')
    expect(grid.className).toContain('md:grid-cols-2')
    const cells = grid.querySelectorAll(':scope > [data-slot="profile-field"]')
    // Registration fields (with province and city) and the dossier fields, without the
    // removed legal-entity type, founding year and company status.
    expect(cells.length).toBe(14)
    cells.forEach((cell) => expect(cell.className).toContain('h-full'))
    expect(grid.className).toContain('gap-y-5')
    expect(grid.className).toContain('gap-x-4')
    // Figma 238:4213 order (first item on the right in RTL), then the fields Figma does not show.
    const labels = Array.from(cells).map((cell) => cell.querySelector('label')!.firstChild!.textContent)
    // Company status is no longer asked for.
    expect(labels.slice(0, 6)).toEqual([
      'نام شرکت',
      'تاریخ تاسیس',
      'نوع شرکت',
      'شماره ثبت',
      'کد اقتصادی',
      'شناسه ملی',
    ])
    expect(document.querySelector('[data-slot="address-list"]')!.className).toContain('gap-5')
    expect(screen.queryByText(/مرحله اول/)).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0]!)
    const actions = document.querySelector('[data-slot="basic-info-actions"]')!
    const buttons = Array.from(actions.querySelectorAll('button'))
    // Primary first in the DOM, so it is on the right in RTL.
    expect(buttons.map((button) => button.textContent)).toEqual(['ذخیره', 'انصراف'])
    fireEvent.click(buttons[1]!)
    expect(document.querySelector('[data-slot="basic-info-actions"]')).toBeNull()
  })

  it('address dialog: province and city are the registration dropdowns, every field has a placeholder, save is first', () => {
    render(
      createElement(CompanyProfileView, { initialProfile: mockProfile, initialDossier: mockDossierResponse }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'آدرس جدید' }))
    // The basic-info grid also has استان/شهر (the registration location).
    const dialog = within(screen.getByRole('dialog'))
    const province = dialog.getByLabelText('استان') as HTMLInputElement
    const city = dialog.getByLabelText('شهر') as HTMLInputElement
    expect(province.getAttribute('role')).toBe('combobox')
    expect(city.getAttribute('role')).toBe('combobox')
    expect(city.disabled).toBe(true)
    expect(province.placeholder).toBe('استان را جستجو یا انتخاب کنید')

    chooseOption(province, 'بوشهر')
    expect(city.disabled).toBe(false)
    chooseOption(city, 'بوشهر')
    expect(city.value).toBe('بوشهر')
    // Changing the province drops the old city.
    chooseOption(province, 'اصفهان')
    expect(city.value).toBe('')

    expect(screen.getByPlaceholderText('مثال: دفتر مرکزی')).toBeTruthy()
    expect(screen.getByPlaceholderText('مثال: 1234567890')).toBeTruthy()
    expect(screen.getByPlaceholderText('نشانی کامل را وارد کنید…')).toBeTruthy()

    const footer = document.querySelector('[data-slot="dialog-footer"]')!
    expect(Array.from(footer.querySelectorAll('button')).map((button) => button.textContent)).toEqual(['ذخیره', 'لغو'])
  })

  it('keeps a legacy free-text province selectable when editing a saved address', () => {
    const legacy: ProfileDto = {
      ...mockProfile,
      addresses: [{ ...mockProfile.addresses[0]!, province: 'استان قدیمی', city: 'شهر قدیمی' }],
    }
    render(createElement(CompanyProfileView, { initialProfile: legacy, initialDossier: mockDossierResponse }))
    fireEvent.click(screen.getByTitle('ویرایش آدرس'))
    const dialog = within(screen.getByRole('dialog'))
    expect((dialog.getByLabelText('استان') as HTMLInputElement).value).toBe('استان قدیمی')
    expect((dialog.getByLabelText('شهر') as HTMLInputElement).value).toBe('شهر قدیمی')
  })

  it('resume certificates have no ready-made file slot, only the add button', () => {
    render(
      createElement(ResumeProfileView, { initialDossier: mockDossierResponse, companyId: 'comp-1' }),
    )
    expect(screen.queryByText('فایل گواهی‌ها و مجوزها')).toBeNull()
    expect(screen.getByRole('button', { name: 'افزودن' })).toBeTruthy()
    // The catalogue upload is a different section and stays.
    expect(screen.getByText('فایل کاتالوگ')).toBeTruthy()
  })
})
