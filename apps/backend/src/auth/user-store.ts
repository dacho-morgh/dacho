/**
 * The authorization axis: a user holds zero or more roles. Collapsed from the
 * former `role: applicant|staff` + `cmsRole: admin|editor` pair.
 */
export const USER_ROLES = ['admin', 'representative', 'referee'] as const

export type UserRole = (typeof USER_ROLES)[number]

export interface User {
  id: string
  phone: string
  name?: string
  email?: string
  /** The representative's job title within the company (سمت). */
  position?: string
  /** The roles this user holds. A user may hold several at once. */
  roles?: UserRole[]
  /**
   * The id of the company this user represents, resolved by the store from the
   * `companies.representative` relationship (the FK lives on the company).
   */
  companyId?: string
}

/** The subset of a company a representative may edit. */
export type CompanyFields = {
  name?: string
  nationalId?: string
  registrationNumber?: string
  type?: string
  province?: string
  city?: string
  establishmentDate?: string
  status?: string
  economicCode?: string
  executives?: Executive[]
  addresses?: Address[]
}

export interface Executive {
  position: string
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

export type ProfileFields = Partial<Pick<User, 'phone' | 'name' | 'email' | 'position'>>

export interface UserStore {
  findOrCreateByPhone(phone: string): Promise<User>
  findById(id: string): Promise<User | undefined>
  update(id: string, fields: ProfileFields): Promise<User>
  list(options?: { role?: UserRole; search?: string }): Promise<User[]>
}

/** True when the user holds the given role. */
export function hasUserRole(user: Pick<User, 'roles'> | null | undefined, role: UserRole): boolean {
  return Array.isArray(user?.roles) && user.roles.includes(role)
}

/** In-memory stand-in; the real implementation reads/writes the Payload users collection. */
export class InMemoryUserStore implements UserStore {
  private readonly users = new Map<string, User>()
  private nextId = 1

  async findOrCreateByPhone(phone: string): Promise<User> {
    for (const user of this.users.values()) {
      if (user.phone === phone) return user
    }
    const user: User = { id: String(this.nextId++), phone, roles: ['representative'] }
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

  async list(options: { role?: UserRole; search?: string } = {}): Promise<User[]> {
    return [...this.users.values()].filter((user) => {
      if (options.role && !hasUserRole(user, options.role)) return false
      if (options.search) {
        const needle = options.search.toLocaleLowerCase()
        return [user.name, user.email, user.phone]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(needle))
      }
      return true
    })
  }
}