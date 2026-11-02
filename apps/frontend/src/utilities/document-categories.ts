/** Category names and labels, in a plain module so server components can call them too. */

export const DOCUMENT_CATEGORIES = [
  'rfp',
  'proposal',
  'articlesOfAssociation',
  'establishmentNotices',
  'amendmentNotices',
  'catalogues',
  'certificatesLicenses',
  'financialStatements',
  'debtFacilityEvidence',
  'taxInsuranceRecords',
  'contractsOrdersMousCommitments',
  'projectEstimateUseOfFunds',
  'guaranteeCollateral',
  'supplementaryCaseFiles',
  'boothPaymentReceipt',
  'correspondenceAttachment',
] as const

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

export function documentCategoryLabel(category: DocumentCategory): string {
  return (
    {
      rfp: 'RFP',
      proposal: 'پروپوزال',
      articlesOfAssociation: 'اساس‌نامه',
      establishmentNotices: 'آگهی تأسیس',
      amendmentNotices: 'آگهی تغییرات',
      catalogues: 'کاتالوگ محصولات',
      certificatesLicenses: 'گواهی‌ها و مجوزها',
      financialStatements: 'صورت‌های مالی',
      debtFacilityEvidence: 'بدهی‌ها و تسهیلات',
      taxInsuranceRecords: 'اظهارنامه مالیاتی و بیمه',
      contractsOrdersMousCommitments: 'قراردادها و تعهدات',
      projectEstimateUseOfFunds: 'برآورد و مصرف منابع',
      guaranteeCollateral: 'تضامین و وثایق',
      supplementaryCaseFiles: 'مدارک تکمیلی پرونده',
      boothPaymentReceipt: 'رسید پرداخت غرفه',
      correspondenceAttachment: 'پیوست مکاتبه',
    } satisfies Record<DocumentCategory, string>
  )[category]
}
