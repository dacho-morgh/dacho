import { randomUUID } from 'node:crypto'
import type { Address as StoredAddress, Executive as StoredExecutive, UserStore } from '../auth/user-store.js'
import type { Company, CompanyStore } from '../auth/company-store.js'

export interface CompanyInfo { name: string; establishmentDate: string; status: string; type: string; registrationNumber: string; economicCode: string; nationalId: string }
export interface ContactInfo { phone: string; email: string }
export interface Executive { role: string; name: string }
export interface Address { id: string; title: string; province: string; city: string; postalCode: string; address: string }
export interface UserProfile { company: CompanyInfo; contacts: ContactInfo; executives: Executive[]; addresses: Address[] }

const EMPTY_PROFILE: UserProfile = {
  company: { name: '', establishmentDate: '', status: '', type: '', registrationNumber: '', economicCode: '', nationalId: '' },
  contacts: { phone: '', email: '' }, executives: [], addresses: [],
}

/**
 * Canonical dashboard profile. The company half reads and writes the
 * `companies` record the user represents; the contact half stays on the user,
 * which remains the identity store.
 */
export class ProfileRepository {
  constructor(
    private readonly users: UserStore,
    private readonly companies: CompanyStore,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.users.findById(userId)
    if (!user) return structuredClone(EMPTY_PROFILE)
    const company = await this.companies.findByRepresentative(userId)
    return fromUserAndCompany(user, company)
  }

  /** Applies the update to the company the user represents. */
  private async updateCompany(userId: string, fields: Partial<Company>): Promise<void> {
    const company = await this.companies.findByRepresentative(userId)
    if (!company) return
    await this.companies.update(company.id, fields)
  }

  async updateBasicInfo(userId: string, update: Partial<CompanyInfo>): Promise<UserProfile> {
    await this.updateCompany(userId, {
      ...(update.name !== undefined ? { name: update.name } : {}),
      ...(update.establishmentDate !== undefined ? { establishmentDate: update.establishmentDate } : {}),
      ...(update.status !== undefined ? { status: update.status } : {}),
      ...(update.type !== undefined ? { type: update.type } : {}),
      ...(update.registrationNumber !== undefined ? { registrationNumber: update.registrationNumber } : {}),
      ...(update.economicCode !== undefined ? { economicCode: update.economicCode } : {}),
    })
    return this.getProfile(userId)
  }

  async updateContactInfo(userId: string, update: Partial<ContactInfo>): Promise<UserProfile> {
    await this.users.update(userId, { ...(update.phone !== undefined ? { phone: update.phone } : {}), ...(update.email !== undefined ? { email: update.email } : {}) })
    return this.getProfile(userId)
  }

  async updateExecutives(userId: string, executives: Executive[]): Promise<UserProfile> {
    await this.updateCompany(userId, { executives: executives.map(toStoredExecutive) })
    return this.getProfile(userId)
  }

  async addAddress(userId: string, input: Omit<Address, 'id'>): Promise<Address> {
    const profile = await this.getProfile(userId)
    const address: Address = { id: randomUUID(), ...input }
    await this.updateCompany(userId, { addresses: [...profile.addresses, address] })
    return address
  }

  async updateAddress(userId: string, addressId: string, input: Partial<Omit<Address, 'id'>>): Promise<Address | null> {
    const profile = await this.getProfile(userId)
    const index = profile.addresses.findIndex((address) => address.id === addressId)
    if (index < 0) return null
    const current = profile.addresses[index]
    if (!current) return null
    const updated: Address = {
      id: addressId,
      title: input.title ?? current.title,
      province: input.province ?? current.province,
      city: input.city ?? current.city,
      postalCode: input.postalCode ?? current.postalCode,
      address: input.address ?? current.address,
    }
    const addresses = [...profile.addresses]
    addresses[index] = updated
    await this.updateCompany(userId, { addresses })
    return updated
  }

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const profile = await this.getProfile(userId)
    const addresses = profile.addresses.filter((address) => address.id !== addressId)
    if (addresses.length === profile.addresses.length) return false
    await this.updateCompany(userId, { addresses })
    return true
  }
}

function fromUserAndCompany(
  user: Exclude<Awaited<ReturnType<UserStore['findById']>>, undefined>,
  company: Company | undefined,
): UserProfile {
  return {
    company: {
      name: company?.name ?? '',
      establishmentDate: company?.establishmentDate ?? '',
      status: company?.status ?? '',
      type: company?.type ?? '',
      registrationNumber: company?.registrationNumber ?? '',
      economicCode: company?.economicCode ?? '',
      nationalId: company?.nationalId ?? '',
    },
    contacts: { phone: user.phone ?? '', email: user.email ?? '' },
    executives: (company?.executives ?? []).map((item: StoredExecutive) => ({
      role: String(item.position ?? ''),
      name: String(item.name ?? ''),
    })),
    addresses: (company?.addresses ?? []).map((item: StoredAddress, index: number) => ({
      id: String(item.id ?? `address-${index}`),
      title: String(item.title ?? ''),
      province: String(item.province ?? ''),
      city: String(item.city ?? ''),
      postalCode: String(item.postalCode ?? ''),
      address: String(item.address ?? ''),
    })),
  }
}

/** The dashboard's `role` label for an executive maps to the stored `position`. */
function toStoredExecutive(executive: Executive): StoredExecutive {
  return { position: executive.role, name: executive.name }
}
