import type { Pool } from 'pg'

import type { DocumentCategory } from '../access/policy.js'
import type { Company } from '../auth/company-store.js'
import {
  ABSENCE_FIELDS,
  isAbsenceField,
  type AbsenceField,
  type CertificateLicence,
  type CompanyFields,
  type KeyMember,
  type PastProjectCustomer,
} from '../auth/user-store.js'
import { DocumentRepository } from '../documents/repo.js'

/** The company's own stage-2 completion and resume data. */
export interface CompanyDossier {
  legalEntityType: string
  knowledgeBasedStatus: string
  classification: string
  foundingYear: string
  activityDomain: string
  website: string
  centerEstablishment: string
  insuredEmployeeCount: number | null
  productsServices: string[]
  keyMembers: KeyMember[]
  pastProjectsCustomers: PastProjectCustomer[]
  requestedServices: string[]
  certificatesLicenses: CertificateLicence[]
  notAvailable: AbsenceField[]
}

export const EMPTY_DOSSIER: CompanyDossier = {
  legalEntityType: '',
  knowledgeBasedStatus: '',
  classification: '',
  foundingYear: '',
  activityDomain: '',
  website: '',
  centerEstablishment: '',
  insuredEmployeeCount: null,
  productsServices: [],
  keyMembers: [],
  pastProjectsCustomers: [],
  requestedServices: [],
  certificatesLicenses: [],
  notAvailable: [],
}

export class DossierValidationError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

const STRING_FIELDS = [
  'legalEntityType',
  'knowledgeBasedStatus',
  'classification',
  'foundingYear',
  'activityDomain',
  'website',
  'centerEstablishment',
] as const

const DOCUMENT_ABSENCE_FIELDS = ['catalogues', 'certificatesLicenses', 'amendmentNotices'] as const
const REQUIRED_DOCUMENT_CATEGORIES = ['articlesOfAssociation', 'establishmentNotices'] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const nonEmpty = (value: string | undefined | null): boolean =>
  typeof value === 'string' && value.trim() !== ''

function hasDossierValue(dossier: CompanyDossier, field: AbsenceField): boolean {
  switch (field) {
    case 'insuredEmployeeCount':
      return dossier.insuredEmployeeCount !== null
    case 'pastProjectsCustomers':
      return dossier.pastProjectsCustomers.length > 0
    case 'requestedServices':
      return dossier.requestedServices.length > 0
    case 'certificatesLicenses':
      return dossier.certificatesLicenses.length > 0
    case 'centerEstablishment':
    case 'website':
      return nonEmpty(dossier[field])
    case 'catalogues':
    case 'amendmentNotices':
      return false
  }
}

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new DossierValidationError(`invalid_${field}`)
  return value.map((item) => {
    if (typeof item !== 'string') throw new DossierValidationError(`invalid_${field}`)
    return item.trim()
  }).filter((item) => item !== '')
}

function records<T>(value: unknown, field: string, map: (item: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) throw new DossierValidationError(`invalid_${field}`)
  return value.map((item) => {
    if (!isRecord(item)) throw new DossierValidationError(`invalid_${field}`)
    return map(item)
  })
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new DossierValidationError(`invalid_${field}`)
  return value.trim()
}

function requiredString(value: unknown, field: string): string {
  const text = optionalString(value, field)
  if (!text) throw new DossierValidationError(`invalid_${field}`)
  return text
}

/**
 * Validates the dossier subset of a profile write. Unknown keys are ignored so
 * the same request can still carry `company`, `contacts` and `executives`.
 */
export function pickDossierUpdate(input: unknown): Partial<CompanyFields> {
  if (!isRecord(input)) return {}
  const update: Partial<CompanyFields> = {}

  for (const field of STRING_FIELDS) {
    if (!(field in input)) continue
    const value = input[field]
    if (typeof value !== 'string') throw new DossierValidationError(`invalid_${field}`)
    update[field] = value.trim()
  }
  if (update.foundingYear !== undefined && update.foundingYear !== '') {
    const year = Number(update.foundingYear)
    if (!/^\d{4}$/.test(update.foundingYear) || year < 1200 || year > 2100) {
      throw new DossierValidationError('invalid_foundingYear')
    }
  }

  if ('insuredEmployeeCount' in input) {
    const value = input.insuredEmployeeCount
    if (value === null || value === '') {
      update.insuredEmployeeCount = null
    } else if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
      update.insuredEmployeeCount = value
    } else {
      throw new DossierValidationError('invalid_insuredEmployeeCount')
    }
  }

  if ('productsServices' in input) update.productsServices = strings(input.productsServices, 'productsServices')
  if ('requestedServices' in input) update.requestedServices = strings(input.requestedServices, 'requestedServices')

  if ('keyMembers' in input) {
    update.keyMembers = records(input.keyMembers, 'keyMembers', (item) => ({
      name: requiredString(item.name, 'keyMembers'),
      role: requiredString(item.role, 'keyMembers'),
    }))
  }

  if ('pastProjectsCustomers' in input) {
    update.pastProjectsCustomers = records(input.pastProjectsCustomers, 'pastProjectsCustomers', (item) => ({
      project: requiredString(item.project, 'pastProjectsCustomers'),
      ...(optionalString(item.customer, 'pastProjectsCustomers') !== undefined
        ? { customer: optionalString(item.customer, 'pastProjectsCustomers')! }
        : {}),
      ...(optionalString(item.summary, 'pastProjectsCustomers') !== undefined
        ? { summary: optionalString(item.summary, 'pastProjectsCustomers')! }
        : {}),
    }))
  }

  if ('certificatesLicenses' in input) {
    update.certificatesLicenses = records(input.certificatesLicenses, 'certificatesLicenses', (item) => ({
      title: requiredString(item.title, 'certificatesLicenses'),
      ...(optionalString(item.issuer, 'certificatesLicenses') !== undefined
        ? { issuer: optionalString(item.issuer, 'certificatesLicenses')! }
        : {}),
      ...(optionalString(item.reference, 'certificatesLicenses') !== undefined
        ? { reference: optionalString(item.reference, 'certificatesLicenses')! }
        : {}),
    }))
  }

  if ('notAvailable' in input) {
    if (!Array.isArray(input.notAvailable)) throw new DossierValidationError('invalid_notAvailable')
    const values = input.notAvailable.map((item) => {
      if (!isAbsenceField(item)) throw new DossierValidationError('invalid_absence_field')
      return item
    })
    update.notAvailable = [...new Set(values)]
  }

  return update
}

export function dossierOfCompany(company: Company | undefined): CompanyDossier {
  return {
    legalEntityType: company?.legalEntityType ?? '',
    knowledgeBasedStatus: company?.knowledgeBasedStatus ?? '',
    classification: company?.classification ?? '',
    foundingYear: company?.foundingYear ?? '',
    activityDomain: company?.activityDomain ?? '',
    website: company?.website ?? '',
    centerEstablishment: company?.centerEstablishment ?? '',
    insuredEmployeeCount: company?.insuredEmployeeCount ?? null,
    productsServices: [...(company?.productsServices ?? [])],
    keyMembers: [...(company?.keyMembers ?? [])],
    pastProjectsCustomers: [...(company?.pastProjectsCustomers ?? [])],
    requestedServices: [...(company?.requestedServices ?? [])],
    certificatesLicenses: [...(company?.certificatesLicenses ?? [])],
    notAvailable: Array.isArray(company?.notAvailable)
      ? company.notAvailable.filter(isAbsenceField)
      : [],
  }
}

/**
 * Merges a validated update with the current dossier and keeps absence answers
 * and values mutually exclusive: declaring `does_not_have` clears the value;
 * supplying a real value removes that field from the absence list.
 */
export function mergeDossier(
  current: CompanyDossier,
  update: Partial<CompanyFields>,
): CompanyDossier {
  const next: CompanyDossier = { ...current }
  for (const field of STRING_FIELDS) {
    const value = update[field]
    if (value !== undefined) next[field] = value
  }
  if (update.insuredEmployeeCount !== undefined) next.insuredEmployeeCount = update.insuredEmployeeCount
  if (update.productsServices !== undefined) next.productsServices = update.productsServices
  if (update.keyMembers !== undefined) next.keyMembers = update.keyMembers
  if (update.pastProjectsCustomers !== undefined) next.pastProjectsCustomers = update.pastProjectsCustomers
  if (update.requestedServices !== undefined) next.requestedServices = update.requestedServices
  if (update.certificatesLicenses !== undefined) next.certificatesLicenses = update.certificatesLicenses
  if (update.notAvailable !== undefined) next.notAvailable = update.notAvailable

  // A value and an absence answer may not arrive in the same write. An older
  // absence answer is removed below when the representative supplies a value;
  // an older value is cleared when the representative now says "doesn't have".
  const declaredInUpdate = new Set(update.notAvailable ?? [])
  const supplied = update as Record<string, unknown>
  for (const field of DOCUMENT_ABSENCE_FIELDS) {
    if (!declaredInUpdate.has(field)) continue
    if (field === 'certificatesLicenses' && update.certificatesLicenses !== undefined
      && next.certificatesLicenses.length > 0) {
      throw new DossierValidationError('conflicting_absence')
    }
  }
  for (const field of ABSENCE_FIELDS) {
    if (DOCUMENT_ABSENCE_FIELDS.includes(field as (typeof DOCUMENT_ABSENCE_FIELDS)[number])) continue
    if (declaredInUpdate.has(field) && supplied[field] !== undefined && hasDossierValue(next, field)) {
      throw new DossierValidationError('conflicting_absence')
    }
  }

  for (const field of ABSENCE_FIELDS) {
    if (supplied[field] !== undefined && hasDossierValue(next, field)) {
      next.notAvailable = next.notAvailable.filter((value) => value !== field)
    }
  }

  for (const field of next.notAvailable) {
    switch (field) {
      case 'centerEstablishment':
        next.centerEstablishment = ''
        break
      case 'website':
        next.website = ''
        break
      case 'insuredEmployeeCount':
        next.insuredEmployeeCount = null
        break
      case 'pastProjectsCustomers':
        next.pastProjectsCustomers = []
        break
      case 'requestedServices':
        next.requestedServices = []
        break
      case 'certificatesLicenses':
        next.certificatesLicenses = []
        break
      default:
        break
    }
  }

  for (const field of ABSENCE_FIELDS) {
    if (hasDossierValue(next, field)) {
      next.notAvailable = next.notAvailable.filter((value) => value !== field)
    }
  }

  return next
}

const DOSSIER_KEYS = [
  'legalEntityType',
  'knowledgeBasedStatus',
  'classification',
  'foundingYear',
  'activityDomain',
  'website',
  'centerEstablishment',
  'insuredEmployeeCount',
  'productsServices',
  'keyMembers',
  'pastProjectsCustomers',
  'requestedServices',
  'certificatesLicenses',
  'notAvailable',
] as const

/**
 * Only the fields that actually changed. This keeps independent concurrent
 * saves from overwriting each other and leaves untouched arrays intact.
 */
export function dossierPatch(
  current: CompanyDossier,
  next: CompanyDossier,
): Partial<CompanyFields> {
  const patch: Partial<CompanyFields> = {}
  for (const key of DOSSIER_KEYS) {
    if (JSON.stringify(current[key]) !== JSON.stringify(next[key])) {
      const writable = patch as Record<string, unknown>
      writable[key] = next[key]
    }
  }
  return patch
}

export interface DossierDocument {
  id: string
  category: DocumentCategory
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface DossierDocumentSource {
  listCompanyDocuments(companyId: string): Promise<DossierDocument[]>
}

export class SqlDossierDocumentSource implements DossierDocumentSource {
  constructor(private readonly pool: Pool) {}

  async listCompanyDocuments(companyId: string): Promise<DossierDocument[]> {
    const records = await new DocumentRepository(this.pool).listForCompany(companyId)
    return records.map((record) => ({
      id: record.id,
      category: record.category,
      filename: record.filename,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      createdAt: record.createdAt,
    }))
  }
}

/** In-memory stand-in used by the unit-test harness. */
export class InMemoryDossierDocumentSource implements DossierDocumentSource {
  private readonly byCompany = new Map<string, DossierDocument[]>()
  private nextId = 1

  add(
    companyId: string,
    category: DocumentCategory,
    filename = `${category}.pdf`,
    sizeBytes = 64,
  ): DossierDocument {
    const document: DossierDocument = {
      id: `document-${this.nextId++}`,
      category,
      filename,
      mimeType: 'application/pdf',
      sizeBytes,
      createdAt: new Date(0).toISOString(),
    }
    this.byCompany.set(companyId, [...(this.byCompany.get(companyId) ?? []), document])
    return document
  }

  async listCompanyDocuments(companyId: string): Promise<DossierDocument[]> {
    return [...(this.byCompany.get(companyId) ?? [])]
  }
}

export interface MissingDossierItems {
  /** Required fields or documents with no value and no permitted absence. */
  required: string[]
  /** Optional value-or-absence fields that currently have neither answer. */
  optional: string[]
  /** True when the company can ask Secretariat to verify this dossier. */
  canRequestVerification: boolean
}

export function missingDossierItems(
  company: Company,
  dossier: CompanyDossier,
  documents: readonly DossierDocument[],
): MissingDossierItems {
  const documentCategories = new Set(documents.map((document) => document.category))
  const absent = new Set(dossier.notAvailable)
  const required: string[] = []
  const optional: string[] = []

  const requireValue = (key: string, present: boolean) => {
    if (!present) required.push(key)
  }
  requireValue('registrationNumber', nonEmpty(company.registrationNumber))
  requireValue('legalEntityType', nonEmpty(dossier.legalEntityType))
  requireValue('foundingYear', nonEmpty(dossier.foundingYear))
  requireValue('status', nonEmpty(company.status))
  requireValue('classification', nonEmpty(dossier.classification))
  requireValue('knowledgeBasedStatus', nonEmpty(dossier.knowledgeBasedStatus))
  requireValue('activityDomain', nonEmpty(dossier.activityDomain))
  requireValue('productsServices', dossier.productsServices.length > 0)
  requireValue('keyMembers', dossier.keyMembers.length > 0)
  requireValue('addresses', (company.addresses ?? []).length > 0)
  for (const category of REQUIRED_DOCUMENT_CATEGORIES) {
    requireValue(category, documentCategories.has(category))
  }

  const optionalValue = (key: AbsenceField, present: boolean) => {
    if (!present && !absent.has(key)) optional.push(key)
  }
  optionalValue('centerEstablishment', nonEmpty(dossier.centerEstablishment))
  optionalValue('website', nonEmpty(dossier.website))
  optionalValue('insuredEmployeeCount', dossier.insuredEmployeeCount !== null)
  optionalValue('pastProjectsCustomers', dossier.pastProjectsCustomers.length > 0)
  optionalValue('requestedServices', dossier.requestedServices.length > 0)
  optionalValue('catalogues', documentCategories.has('catalogues'))
  optionalValue('certificatesLicenses', documentCategories.has('certificatesLicenses'))
  optionalValue('amendmentNotices', documentCategories.has('amendmentNotices'))

  return { required, optional, canRequestVerification: required.length === 0 }
}
