import type { Pool } from 'pg'

export interface CompanyInfo {
  name: string
  establishmentDate: string
  status: string
  type: string
  registrationNumber: string
  economicCode: string
  nationalId: string
}

export interface ContactInfo {
  phone: string
  email: string
}

export interface Executive {
  role: string
  name: string
}

export interface Address {
  id: string
  title: string
  province: string
  city: string
  postalCode: string
  address: string
}

export interface UserProfile {
  company: CompanyInfo
  contacts: ContactInfo
  executives: Executive[]
  addresses: Address[]
}

const DEFAULT_PROFILE: UserProfile = {
  company: {
    name: 'نام نمونه شرکت',
    establishmentDate: '۱۳۵۱/۰۴/۱۲ (54 سال)',
    status: 'فعال',
    type: 'سهامی عام',
    registrationNumber: '۱۵۷۸۱',
    economicCode: '411111495187',
    nationalId: '10100578556',
  },
  contacts: {
    phone: '۰۹۱۲۳۴۵۶۷۸۹',
    email: 'sample@company.com',
  },
  executives: [
    { role: 'مدیر عامل', name: 'نام نمونه مدیر عامل' },
    { role: 'رییس هیات مدیره', name: 'نام نمونه رییس هیات مدیره' },
  ],
  addresses: [
    {
      id: 'addr-1',
      title: 'نام آدرس',
      province: 'تهران',
      city: 'تهران',
      postalCode: '1531638111',
      address: 'تهران خ بهشتی خ پاکستان کوچه دوم پلاک 29',
    },
    {
      id: 'addr-2',
      title: 'نام آدرس',
      province: 'تهران',
      city: 'تهران',
      postalCode: '1531638111',
      address: 'تهران خ بهشتی خ پاکستان کوچه دوم پلاک 29',
    },
  ],
}

export class ProfileRepository {
  private inMemoryProfiles = new Map<string, UserProfile>()

  constructor(private pool: Pool) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const existing = this.inMemoryProfiles.get(userId)
    if (existing) {
      return structuredClone(existing)
    }
    const initial = structuredClone(DEFAULT_PROFILE)
    this.inMemoryProfiles.set(userId, initial)
    return structuredClone(initial)
  }

  async updateBasicInfo(userId: string, update: Partial<CompanyInfo>): Promise<UserProfile> {
    const profile = await this.getProfile(userId)
    profile.company = { ...profile.company, ...update }
    this.inMemoryProfiles.set(userId, profile)
    return structuredClone(profile)
  }

  async updateContactInfo(userId: string, update: Partial<ContactInfo>): Promise<UserProfile> {
    const profile = await this.getProfile(userId)
    profile.contacts = { ...profile.contacts, ...update }
    this.inMemoryProfiles.set(userId, profile)
    return structuredClone(profile)
  }

  async addAddress(userId: string, input: Omit<Address, 'id'>): Promise<Address> {
    const profile = await this.getProfile(userId)
    const newAddress: Address = {
      id: `addr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...input,
    }
    profile.addresses.push(newAddress)
    this.inMemoryProfiles.set(userId, profile)
    return structuredClone(newAddress)
  }

  async updateAddress(userId: string, addressId: string, input: Partial<Omit<Address, 'id'>>): Promise<Address | null> {
    const profile = await this.getProfile(userId)
    const existing = profile.addresses.find((a) => a.id === addressId)
    if (!existing) return null

    const updated: Address = {
      id: existing.id,
      title: input.title ?? existing.title,
      province: input.province ?? existing.province,
      city: input.city ?? existing.city,
      postalCode: input.postalCode ?? existing.postalCode,
      address: input.address ?? existing.address,
    }

    const index = profile.addresses.findIndex((a) => a.id === addressId)
    profile.addresses[index] = updated
    this.inMemoryProfiles.set(userId, profile)
    return structuredClone(updated)
  }

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const profile = await this.getProfile(userId)
    const initialLength = profile.addresses.length
    profile.addresses = profile.addresses.filter((a) => a.id !== addressId)
    this.inMemoryProfiles.set(userId, profile)
    return profile.addresses.length < initialLength
  }
}
