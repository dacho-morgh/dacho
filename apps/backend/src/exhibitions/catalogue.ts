export const BOOTH_STATUSES = ['available', 'unavailable'] as const
export type BoothStatus = (typeof BOOTH_STATUSES)[number]

export const PRICE_UNITS = ['toman'] as const
export type PriceUnit = (typeof PRICE_UNITS)[number]

export interface ExhibitionCatalogueSettings {
  exhibitionId: string
  companyBoothLimit: number
  guideMapReference: string | null
  updatedAt: string
}

export interface Booth {
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

export interface BoothPriceVersion {
  id: string
  boothId: string
  exhibitionId: string
  identifier: string
  priceAmount: number
  priceUnit: PriceUnit
  createdBy: string | null
  createdAt: string
}

export interface SettingsWrite {
  companyBoothLimit: number
  guideMapReference: string | null
}

export interface BoothWrite {
  identifier: string
  specification: string
  location: string | null
  status: BoothStatus
  active: boolean
  priceAmount: number
  priceUnit: PriceUnit
}

export type BoothChanges = Partial<BoothWrite>

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoothStatus(value: unknown): value is BoothStatus {
  return typeof value === 'string' && (BOOTH_STATUSES as readonly string[]).includes(value)
}

function isPriceUnit(value: unknown): value is PriceUnit {
  return typeof value === 'string' && (PRICE_UNITS as readonly string[]).includes(value)
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function parseSettingsInput(body: unknown): Validation<SettingsWrite> {
  if (!isRecord(body)) return { ok: false, error: 'invalid_settings' }

  if (!isPositiveSafeInteger(body.companyBoothLimit)) {
    return { ok: false, error: 'invalid_company_booth_limit' }
  }

  const guideMapReference = body.guideMapReference
  if (
    guideMapReference !== undefined &&
    guideMapReference !== null &&
    (typeof guideMapReference !== 'string' || guideMapReference.trim().length > 2048)
  ) {
    return { ok: false, error: 'invalid_guide_map_reference' }
  }

  return {
    ok: true,
    value: {
      companyBoothLimit: body.companyBoothLimit,
      guideMapReference:
        typeof guideMapReference === 'string' && guideMapReference.trim() !== ''
          ? guideMapReference.trim()
          : null,
    },
  }
}

function parseIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const identifier = value.trim()
  if (identifier === '' || identifier.length > 120) return null
  return identifier
}

function parseSpecification(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const specification = value.trim()
  if (specification === '' || specification.length > 2000) return null
  return specification
}

function parseLocation(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const location = value.trim()
  return location === '' ? null : location
}

export function parseBoothCreate(body: unknown): Validation<BoothWrite> {
  if (!isRecord(body)) return { ok: false, error: 'invalid_booth' }

  const identifier = parseIdentifier(body.identifier)
  if (identifier === null) return { ok: false, error: 'invalid_booth_identifier' }

  const specification = parseSpecification(body.specification)
  if (specification === null) return { ok: false, error: 'invalid_booth_specification' }

  const location = parseLocation(body.location)
  if (location === undefined) return { ok: false, error: 'invalid_booth_location' }

  const status = body.status ?? 'available'
  if (!isBoothStatus(status)) return { ok: false, error: 'invalid_booth_status' }

  const active = body.active ?? true
  if (typeof active !== 'boolean') return { ok: false, error: 'invalid_booth_active' }

  if (!isPositiveSafeInteger(body.priceAmount)) {
    return { ok: false, error: 'invalid_price_amount' }
  }
  if (!isPriceUnit(body.priceUnit)) {
    return { ok: false, error: 'invalid_price_unit' }
  }

  return {
    ok: true,
    value: {
      identifier,
      specification,
      location,
      status,
      active,
      priceAmount: body.priceAmount,
      priceUnit: body.priceUnit,
    },
  }
}

export function parseBoothUpdate(body: unknown): Validation<BoothChanges> {
  if (!isRecord(body)) return { ok: false, error: 'invalid_booth' }

  const changes: BoothChanges = {}
  let provided = false

  if (body.identifier !== undefined) {
    const identifier = parseIdentifier(body.identifier)
    if (identifier === null) return { ok: false, error: 'invalid_booth_identifier' }
    changes.identifier = identifier
    provided = true
  }

  if (body.specification !== undefined) {
    const specification = parseSpecification(body.specification)
    if (specification === null) return { ok: false, error: 'invalid_booth_specification' }
    changes.specification = specification
    provided = true
  }

  if (Object.prototype.hasOwnProperty.call(body, 'location')) {
    const location = parseLocation(body.location)
    if (location === undefined) return { ok: false, error: 'invalid_booth_location' }
    changes.location = location
    provided = true
  }

  if (body.status !== undefined) {
    if (!isBoothStatus(body.status)) return { ok: false, error: 'invalid_booth_status' }
    changes.status = body.status
    provided = true
  }

  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') return { ok: false, error: 'invalid_booth_active' }
    changes.active = body.active
    provided = true
  }

  const hasPriceAmount = body.priceAmount !== undefined
  const hasPriceUnit = body.priceUnit !== undefined
  if (hasPriceAmount || hasPriceUnit) {
    if (!isPositiveSafeInteger(body.priceAmount)) {
      return { ok: false, error: 'invalid_price_amount' }
    }
    if (!isPriceUnit(body.priceUnit)) {
      return { ok: false, error: 'invalid_price_unit' }
    }
    changes.priceAmount = body.priceAmount
    changes.priceUnit = body.priceUnit
    provided = true
  }

  if (!provided) return { ok: false, error: 'invalid_booth_update' }
  return { ok: true, value: changes }
}
