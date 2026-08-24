import { describe, expect, it } from 'vitest'

const findNonPlainValue = (value: unknown, path = 'admin.meta'): string | undefined => {
  if (value === null || ['boolean', 'number', 'string', 'undefined'].includes(typeof value)) {
    return undefined
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const nonPlainPath = findNonPlainValue(item, `${path}[${index}]`)

      if (nonPlainPath) return nonPlainPath
    }

    return undefined
  }

  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    return path
  }

  for (const [key, item] of Object.entries(value)) {
    const nonPlainPath = findNonPlainValue(item, `${path}.${key}`)

    if (nonPlainPath) return nonPlainPath
  }

  return undefined
}

describe('Payload admin metadata', () => {
  it('only exposes plain values to Payload client components', async () => {
    const { default: configPromise } = await import('@payload-config')
    const config = await configPromise

    expect(findNonPlainValue(config.admin.meta)).toBeUndefined()
  }, 30_000)
})
