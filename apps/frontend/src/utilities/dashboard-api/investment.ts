import { dashboardFetch, postJson } from './core'

export interface InvestmentMemoDto {
  id: string
  version: number
  body: string
  createdAt: string
  sentAt: string | null
}

export function listInvestmentMemos(id: string): Promise<{ memos: InvestmentMemoDto[] }> {
  return dashboardFetch(`/investment/cases/${encodeURIComponent(id)}`)
}

export function saveInvestmentMemo(id: string, body: string): Promise<unknown> {
  return dashboardFetch(`/investment/cases/${encodeURIComponent(id)}/memo`, postJson({ body }))
}

export function sendInvestmentMemo(id: string, version: number): Promise<unknown> {
  return dashboardFetch(`/investment/cases/${encodeURIComponent(id)}/memo/send`, postJson({ version }))
}
