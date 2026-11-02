import { dashboardFetch } from './core'

export type BoothStatus = 'available' | 'unavailable'
export type PriceUnit = 'toman'

export interface BoothDto {
  id: string
  exhibitionId: string
  identifier: string
  specification: string
  location: string | null
  status: BoothStatus
  active: boolean
  available: boolean
  priceAmount: number
  priceUnit: PriceUnit
  priceVersionId: string | null
  createdAt: string
  updatedAt: string
}

export interface ExhibitionCatalogueDto {
  exhibitionId: string
  companyBoothLimit: number | null
  guideMapReference: string | null
  booths: BoothDto[]
}

export interface ExhibitionCatalogueSettingsDto {
  exhibitionId: string
  companyBoothLimit: number
  guideMapReference: string | null
  updatedAt: string
}

export interface CreateBoothInput {
  identifier: string
  specification: string
  location?: string | null
  priceAmount: number
  priceUnit: PriceUnit
  status?: BoothStatus
  active?: boolean
}

export type UpdateBoothInput = Omit<Partial<CreateBoothInput>, 'priceAmount' | 'priceUnit'> &
  ({ priceAmount: number; priceUnit: PriceUnit } | { priceAmount?: never; priceUnit?: never })

export interface UpdateExhibitionSettingsInput {
  companyBoothLimit: number
  guideMapReference?: string | null
}

export function formatToman(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '۰ تومان'
  return `${amount.toLocaleString('fa-IR')} تومان`
}

export function parsePersianNumber(value: string): number {
  const normalized = value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .trim()
    .replace(/\s*تومان$/, '')
    .trim()
  // Reject signs, decimals and arbitrary text instead of silently changing the amount.
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:[,٬][0-9]{3})+)$/.test(normalized)) return 0
  const parsed = Number(normalized.replace(/[,٬]/g, ''))
  return Number.isSafeInteger(parsed) ? parsed : 0
}

export function getExhibitionCatalogue(exhibitionId: string): Promise<ExhibitionCatalogueDto> {
  return dashboardFetch<ExhibitionCatalogueDto>(
    `/exhibitions/${encodeURIComponent(exhibitionId)}/catalogue`,
  )
}

export function getAdminExhibitionCatalogue(exhibitionId: string): Promise<ExhibitionCatalogueDto> {
  return dashboardFetch<ExhibitionCatalogueDto>(
    `/admin/exhibitions/${encodeURIComponent(exhibitionId)}/catalogue`,
  )
}

export function updateExhibitionSettings(
  exhibitionId: string,
  input: UpdateExhibitionSettingsInput,
): Promise<{ settings: ExhibitionCatalogueSettingsDto }> {
  return dashboardFetch<{ settings: ExhibitionCatalogueSettingsDto }>(
    `/admin/exhibitions/${encodeURIComponent(exhibitionId)}/settings`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export function createBooth(
  exhibitionId: string,
  input: CreateBoothInput,
): Promise<{ booth: BoothDto }> {
  return dashboardFetch<{ booth: BoothDto }>(
    `/admin/exhibitions/${encodeURIComponent(exhibitionId)}/booths`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export function updateBooth(
  exhibitionId: string,
  boothId: string,
  input: UpdateBoothInput,
): Promise<{ booth: BoothDto }> {
  return dashboardFetch<{ booth: BoothDto }>(
    `/admin/exhibitions/${encodeURIComponent(exhibitionId)}/booths/${encodeURIComponent(boothId)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

/* ── Event Categories, Subtopics, and RFP (FE11 / T17 / T18) ─────────────── */

export type BoothAttendanceStatus = 'pending' | 'approved' | 'rejected'

/** The company's own booth reservation; attendance and payment are decided per booth. */
export interface BoothReservationDto {
  id: string
  boothId: string
  boothIdentifier?: string
  exhibitionId: string
  active: boolean
  attendanceStatus: BoothAttendanceStatus
  attendanceReason: string | null
  priceAmount?: number
  createdAt: string
  allowedActions: string[]
}

export function listMyBoothReservations(exhibitionId: string): Promise<{ items: BoothReservationDto[] }> {
  return dashboardFetch<{ items: BoothReservationDto[] }>(
    `/exhibitions/${encodeURIComponent(exhibitionId)}/my-reservations`,
  )
}
