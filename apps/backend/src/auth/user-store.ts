export interface User {
  id: string
  phone: string
  name?: string
  companyId?: string
}

export type ProfileFields = Partial<Pick<User, 'name' | 'companyId'>>

export interface UserStore {
  findOrCreateByPhone(phone: string): Promise<User>
  findById(id: string): Promise<User | undefined>
  update(id: string, fields: ProfileFields): Promise<User>
}

/** In-memory stand-in; the real implementation reads/writes the Payload users collection. */
export class InMemoryUserStore implements UserStore {
  private readonly users = new Map<string, User>()
  private nextId = 1

  async findOrCreateByPhone(phone: string): Promise<User> {
    for (const user of this.users.values()) {
      if (user.phone === phone) return user
    }
    const user: User = { id: String(this.nextId++), phone }
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
}
