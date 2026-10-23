import { Services } from '@cms-core/collections/Services'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getPayload: vi.fn() }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@/payload.config', () => ({ default: {} }))

afterEach(() => vi.restoreAllMocks())

it('seeds all six services outside a Next request without revalidating', async () => {
  let id = 0
  const create = vi.fn(async ({ collection, data, context = {} }) => {
    const doc = { ...data, id: ++id }
    if (collection === 'services') {
      for (const hook of Services.hooks?.afterChange ?? []) {
        // Exercise the real hook, including Next's missing request-store error.
        await hook({ doc, req: { context } } as never)
      }
    }
    return doc
  })
  mocks.getPayload.mockResolvedValue({
    logger: { info: vi.fn() },
    find: vi.fn().mockResolvedValue({ docs: [] }),
    create,
    delete: vi.fn(),
    updateGlobal: vi.fn(),
  })
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  await import('../../scripts/seed-landing')
  await vi.waitFor(() => expect(exit).toHaveBeenCalled())
  expect(console.error).not.toHaveBeenCalled()
  expect(exit).toHaveBeenCalledWith(0)
  expect(create.mock.calls.filter(([args]) => args.collection === 'services')).toHaveLength(6)
})
