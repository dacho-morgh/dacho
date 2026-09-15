import { randomUUID } from 'node:crypto'
import type { Address as StoredAddress, Executive as StoredExecutive, UserStore } from '../auth/user-store.js'

export interface CompanyInfo { name: string; establishmentDate: string; status: string; type: string; registrationNumber: string; economicCode: string; nationalId: string }
export interface ContactInfo { phone: string; email: string }
export interface Executive { role: string; name: string }
export interface Address { id: string; title: string; province: string; city: string; postalCode: string; address: string }
export interface UserProfile { company: CompanyInfo; contacts: ContactInfo; executives: Executive[]; addresses: Address[] }

const EMPTY_PROFILE: UserProfile = {
  company: { name: '', establishmentDate: '', status: '', type: '', registrationNumber: '', economicCode: '', nationalId: '' },
  contacts: { phone: '', email: '' }, executives: [], addresses: [],
}

/** Canonical dashboard profile backed by the Payload users collection. */
export class ProfileRepository {
  constructor(private readonly users: UserStore) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.users.findById(userId)
    if (!user) return structuredClone(EMPTY_PROFILE)
    return fromUser(user)
  }

  async updateBasicInfo(userId: string, update: Partial<CompanyInfo>): Promise<UserProfile> {
    await this.users.update(userId, {
      ...(update.name !== undefined ? { companyName: update.name } : {}),
      ...(update.establishmentDate !== undefined ? { companyEstablishmentDate: update.establishmentDate } : {}),
      ...(update.status !== undefined ? { companyStatus: update.status } : {}),
      ...(update.type !== undefined ? { companyType: update.type } : {}),
      ...(update.registrationNumber !== undefined ? { companyRegistrationNumber: update.registrationNumber } : {}),
      ...(update.economicCode !== undefined ? { companyEconomicCode: update.economicCode } : {}),
      ...(update.nationalId !== undefined ? { companyNationalId: update.nationalId } : {}),
    })
    return this.getProfile(userId)
  }

  async updateContactInfo(userId: string, update: Partial<ContactInfo>): Promise<UserProfile> {
    await this.users.update(userId, { ...(update.phone !== undefined ? { phone: update.phone } : {}), ...(update.email !== undefined ? { email: update.email } : {}) })
    return this.getProfile(userId)
  }

  async updateExecutives(userId: string, executives: Executive[]): Promise<UserProfile> {
    await this.users.update(userId, { executives })
    return this.getProfile(userId)
  }

  async addAddress(userId: string, input: Omit<Address, 'id'>): Promise<Address> {
    const profile = await this.getProfile(userId)
    const address: Address = { id: randomUUID(), ...input }
    await this.users.update(userId, { addresses: [...profile.addresses, address] })
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
    await this.users.update(userId, { addresses })
    return updated
  }

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const profile = await this.getProfile(userId)
    const addresses = profile.addresses.filter((address) => address.id !== addressId)
    if (addresses.length === profile.addresses.length) return false
    await this.users.update(userId, { addresses })
    return true
  }
}

function fromUser(user: Exclude<Awaited<ReturnType<UserStore['findById']>>, undefined>): UserProfile {
  return {
    company: {
      name: user.companyName ?? '', establishmentDate: user.companyEstablishmentDate ?? '', status: user.companyStatus ?? '',
      type: user.companyType ?? '', registrationNumber: user.companyRegistrationNumber ?? '', economicCode: user.companyEconomicCode ?? '', nationalId: user.companyNationalId ?? '',
    },
    contacts: { phone: user.phone ?? '', email: user.email ?? '' },
    executives: (user.executives ?? []).map((item: StoredExecutive) => ({ role: String(item.role ?? ''), name: String(item.name ?? '') })),
    addresses: (user.addresses ?? []).map((item: StoredAddress, index) => ({
      id: String(item.id ?? `address-${index}`), title: String(item.title ?? ''), province: String(item.province ?? ''), city: String(item.city ?? ''), postalCode: String(item.postalCode ?? ''), address: String(item.address ?? ''),
    })),
  }
}
