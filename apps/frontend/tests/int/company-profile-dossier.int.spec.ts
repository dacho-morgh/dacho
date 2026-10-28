// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
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
} from '@/utilities/dashboard-api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/profile/company',
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
  executives: [
    { name: 'علی رضایی', role: 'مدیرعامل' },
  ],
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
    { project: 'هوشمندسازی پایانه صادراتی', customer: 'شرکت نفت', summary: 'طراحی زیرساخت پایش بلادرنگ' },
  ],
  requestedServices: ['جذب سرمایه در گردش'],
  certificatesLicenses: [{ title: 'گواهی افتا', issuer: 'سازمان فناوری اطلاعات', reference: 'AFT-99' }],
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
  afterEach(cleanup)

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
    render(createElement(CompanyProfileView, {
      initialProfile: mockProfile,
      initialDossier: mockDossierResponse,
    }))

    // Verification badge
    expect(screen.getByText('آماده احراز هویت')).toBeTruthy()

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

    render(createElement(CompanyProfileView, {
      initialProfile: mockProfile,
      initialDossier: unverifiedDossier,
    }))

    expect(screen.getByText(/در حال تکمیل/)).toBeTruthy()
    expect(screen.getByText('نوع شخصیت حقوقی')).toBeTruthy()
    expect(screen.getByText('سال تأسیس')).toBeTruthy()
    expect(screen.getByText('اساس‌نامه')).toBeTruthy()
  })

  it('renders ResumeProfileView with repeatable items and absence states (FE04, FE29)', () => {
    render(createElement(ResumeProfileView, {
      initialDossier: mockDossierResponse,
      companyId: 'comp-1',
    }))

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

  it('renders absence banner when absence option is selected in ResumeProfileView', () => {
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

    render(createElement(ResumeProfileView, {
      initialDossier: absentDossier,
      companyId: 'comp-1',
    }))

    expect(screen.getByText('ثبت شده است که شرکت سابقه پروژه یا مشتری قبلی ندارد.')).toBeTruthy()
    expect(screen.getByText('ثبت شده است که شرکت کاتالوگ ندارد.')).toBeTruthy()
  })
})
