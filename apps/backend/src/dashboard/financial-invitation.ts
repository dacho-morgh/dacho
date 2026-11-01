import type { DocumentCategory } from '../access/policy.js'

export const FINANCIAL_CHECKLIST_VERSION = 'financial-package-2026-v1'

export interface FinancialChecklistItem {
  category: DocumentCategory
  title: string
  description: string
}

/**
 * The fixed package of product requirements, stage 4. Which items allow a formal
 * absence and how statement years are counted are still open inputs for T30, so
 * this list states what is asked for and computes neither.
 */
export const FINANCIAL_CHECKLIST: readonly FinancialChecklistItem[] = [
  { category: 'financialStatements', title: 'صورت‌های مالی', description: 'صورت‌های مالی حداقل سه سال اخیر؛ برای شرکت جوان‌تر، از زمان تأسیس.' },
  { category: 'debtFacilityEvidence', title: 'بدهی‌ها و تسهیلات', description: 'بدهی‌ها و تسهیلات اعتباری جاری.' },
  { category: 'taxInsuranceRecords', title: 'اظهارنامه مالیاتی و بیمه', description: 'اظهارنامه یا گزارش مالیاتی و وضعیت بیمه مرتبط.' },
  { category: 'contractsOrdersMousCommitments', title: 'قراردادها و تعهدات', description: 'قراردادها، سفارش‌های خرید، تفاهم‌نامه‌ها و تعهدات جاری.' },
  { category: 'projectEstimateUseOfFunds', title: 'برآورد و مصرف منابع', description: 'برآورد مالی پروژه و برنامه مصرف منابع.' },
  { category: 'guaranteeCollateral', title: 'تضامین و وثایق', description: 'مدارک تضامین و وثایق موجود.' },
]

/** The chief and the round stay out of it: the company reads this response too. */
export interface FinancialInvitationDto {
  id: string
  requestId: string
  trackingCode: string
  requestRevision: number
  proposalRevision: number
  checklistVersion: string
  checklist: FinancialChecklistItem[]
  invitedAt: string
}
