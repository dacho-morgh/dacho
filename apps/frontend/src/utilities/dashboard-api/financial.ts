import type { DocumentCategory } from '@/utilities/document-categories'

import { DashboardApiError, dashboardFetch, postJson } from './core'
import type { EvaluationSummaryDto } from './review'
import type { InvestmentMemoDto } from './investment'

/* ── Financial package (T29, T30) and investment dossier (T31) ────────── */

export interface FinancialChecklistItemDto {
  category: DocumentCategory
  title: string
}

export interface FinancialInvitationDto {
  id: string
  requestId: string
  trackingCode: string | null
  requestRevision: number
  proposalRevision: number
  checklistVersion: string
  checklist: FinancialChecklistItemDto[]
  invitedAt: string
}

export interface FinancialInvitationResponse {
  invitation: FinancialInvitationDto
  /** The statement years the package must cover; null when the founding date has no readable year. */
  statementYears: number[] | null
}

export interface FinancialPackageDocumentDto {
  id: string
  category: DocumentCategory
  filename: string
  sizeBytes: number
  logicalVersion: number
  statementYear: number | null
  /** Present on the investment dossier only. */
  downloadUrl?: string
}

export interface FinancialPackageDto {
  id: string
  requestId: string
  invitationId: string
  packageVersion: number
  checklistVersion: string
  statementYears: number[]
  documents: FinancialPackageDocumentDto[]
  submittedBy: string
  submittedAt: string
}

export function getFinancialInvitation(id: string): Promise<FinancialInvitationResponse> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/financial-invitation`)
}

export function getFinancialPackage(id: string): Promise<{ package: FinancialPackageDto }> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/financial-package`)
}

export type SubmitFinancialPackageResult =
  | { kind: 'submitted'; package: FinancialPackageDto }
  | { kind: 'incomplete'; missingCategories: DocumentCategory[]; missingStatementYears: number[] }

/**
 * The company's one submit. A complete package returns the stored package, also on a
 * repeat; an incomplete one stores nothing and names the gaps. Other refusals throw.
 */
export async function submitFinancialPackage(id: string): Promise<SubmitFinancialPackageResult> {
  const res = await fetch(`/api/dashboard/requests/${encodeURIComponent(id)}/financial-package`, {
    cache: 'no-store',
    ...postJson({}),
  })
  const body = (await res.json().catch(() => null)) as
    | { package?: FinancialPackageDto; error?: string; missingCategories?: DocumentCategory[]; missingStatementYears?: number[] }
    | null
  if (res.ok && body?.package) return { kind: 'submitted', package: body.package }
  if (res.status === 422 && body?.error === 'financial_package_incomplete') {
    return {
      kind: 'incomplete',
      missingCategories: body.missingCategories ?? [],
      missingStatementYears: body.missingStatementYears ?? [],
    }
  }
  throw new DashboardApiError(res.status, typeof body?.error === 'string' ? body.error : 'request_failed')
}

export interface InvestmentEvaluationDto extends EvaluationSummaryDto {
  role?: 'reviewer' | 'employer-reviewer'
}

export interface SupplementaryFileDto {
  id: string
  filename: string
  createdAt?: string
  deliveredAt?: string | null
  downloadUrl?: string
}

/** GET /investment/cases/:id: the dossier of a case handed to this investment person. */
export interface InvestmentCaseDto {
  case: {
    requestId: string
    trackingCode: string
    title: string
    companyName: string | null
    event: { id: string; title: string } | null
    subtopic: { id: string; title: string } | null
    assignedAt: string
  }
  package: FinancialPackageDto & { documents: FinancialPackageDocumentDto[] }
  evaluations: InvestmentEvaluationDto[]
  memos: InvestmentMemoDto[]
  supplementaryFiles: SupplementaryFileDto[]
}

export function getInvestmentCase(id: string): Promise<InvestmentCaseDto> {
  return dashboardFetch(`/investment/cases/${encodeURIComponent(id)}`)
}
