export interface User {
  id: string
  phone: string
  name?: string
  companyId?: string
  email?: string
  position?: string
  role?: 'applicant' | 'staff'
  cmsRole?: 'admin' | 'editor' | null
  companyName?: string
  companyNationalId?: string
  companyRegistrationNumber?: string
  companyType?: string
  companyProvince?: string
  companyCity?: string
  companyEstablishmentDate?: string
  companyStatus?: string
  companyEconomicCode?: string
  executives?: Executive[]
  addresses?: Address[]
}

export interface Executive {
  role: string
  name: string
}

export interface Address {
  id?: string
  title: string
  province: string
  city: string
  postalCode: string
  address: string
}

export type ProfileFields = Partial<
  Pick<
    User,
    | 'phone'
    | 'name'
    | 'companyId'
    | 'email'
    | 'position'
    | 'companyName'
    | 'companyNationalId'
    | 'companyRegistrationNumber'
    | 'companyType'
    | 'companyProvince'
    | 'companyCity'
    | 'companyEstablishmentDate'
    | 'companyStatus'
    | 'companyEconomicCode'
    | 'executives'
    | 'addresses'
  >
>

export interface UserStore {
  findOrCreateByPhone(phone: string): Promise<User>
  findById(id: string): Promise<User | undefined>
  update(id: string, fields: ProfileFields): Promise<User>
  list(options?: { role?: User['role']; search?: string }): Promise<User[]>
}

/** In-memory stand-in; the real implementation reads/writes the Payload users collection. */
export class InMemoryUserStore implements UserStore {
  private readonly users = new Map<string, User>()
  private nextId = 1

  async findOrCreateByPhone(phone: string): Promise<User> {
    for (const user of this.users.values()) {
      if (user.phone === phone) return user
    }
    const user: User = { id: String(this.nextId++), phone, role: 'applicant', cmsRole: null, executives: [], addresses: [] }
    this.users.set(user.id, user)
    return user
  }

  async findById(id: string): Promise<User | undefined> {
    return this.users.get(id)
  }

  async update(id: string, fields: ProfileFields): Promise<User> {
    const user = this.users.get(id)
    if (!user) throw new Error(`User not found: ${id}`)
    const updated = { ...user, ...fields }
    this.users.set(id, updated)
    return updated
  }

  async list(options: { role?: User['role']; search?: string } = {}): Promise<User[]> {
    return [...this.users.values()].filter((user) => {
      if (options.role && user.role !== options.role) return false
      if (options.search) {
        const needle = options.search.toLocaleLowerCase()
        return [user.name, user.email, user.phone, user.companyName]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(needle))
      }
      return true
    })
  }
}
