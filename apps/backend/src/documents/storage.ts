import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { DocumentTypeRule } from './policy.js'

const STORAGE_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx)$/

/**
 * Private bytes live outside every public/static directory and are addressed by
 * a server-generated UUID, not the uploaded filename. The HTTP layer never
 * redirects or exposes this path.
 */
export class PrivateDocumentStorage {
  private readonly root: string

  constructor(root: string) {
    this.root = path.resolve(root)
  }

  get directory(): string {
    return this.root
  }

  async ensure(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
  }

  async save(body: Buffer, extension: DocumentTypeRule['extension']): Promise<string> {
    await this.ensure()
    const key = `${randomUUID()}${extension}`
    const destination = this.pathFor(key)
    const temporary = `${destination}.tmp`
    await writeFile(temporary, body, { mode: 0o600 })
    await rename(temporary, destination)
    return key
  }

  async read(storageKey: string): Promise<Buffer | null> {
    if (!STORAGE_KEY.test(storageKey)) return null
    try {
      return await readFile(this.pathFor(storageKey))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async remove(storageKey: string): Promise<void> {
    if (!STORAGE_KEY.test(storageKey)) return
    await rm(this.pathFor(storageKey), { force: true })
  }

  private pathFor(storageKey: string): string {
    const resolved = path.resolve(this.root, storageKey)
    if (!resolved.startsWith(this.root + path.sep)) {
      throw new Error('Unsafe private document path')
    }
    return resolved
  }
}
