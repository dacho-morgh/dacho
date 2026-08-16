export interface CodeStore {
  save(phone: string, code: string, ttlSeconds: number): Promise<void>
  verify(phone: string, code: string): Promise<boolean>
}

interface Entry {
  code: string
  expiresAt: number
  attempts: number
}

export interface InMemoryCodeStoreOptions {
  now?: () => number
  maxAttempts?: number
}

/** Single-use, expiring, attempt-limited OTP codes held in memory. */
export class InMemoryCodeStore implements CodeStore {
  private readonly now: () => number
  private readonly maxAttempts: number
  private readonly codes = new Map<string, Entry>()

  constructor(options: InMemoryCodeStoreOptions = {}) {
    this.now = options.now ?? Date.now
    this.maxAttempts = options.maxAttempts ?? 5
  }

  async save(phone: string, code: string, ttlSeconds: number): Promise<void> {
    this.codes.set(phone, { code, expiresAt: this.now() + ttlSeconds * 1000, attempts: 0 })
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const entry = this.codes.get(phone)
    if (!entry) return false

    if (this.now() > entry.expiresAt) {
      this.codes.delete(phone)
      return false
    }

    entry.attempts += 1
    if (entry.attempts > this.maxAttempts) {
      this.codes.delete(phone)
      return false
    }

    if (entry.code !== code) return false

    this.codes.delete(phone) // single-use
    return true
  }
}
