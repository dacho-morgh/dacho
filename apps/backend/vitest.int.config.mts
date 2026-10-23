import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/int/**/*.int.spec.ts'],
    setupFiles: ['./tests/int/isolation.setup.ts'],
    // All int specs share one real Postgres (public.* tables), so run files one
    // at a time — parallel files race on the tracking-code sequence and other
    // shared-table fixtures.
    fileParallelism: false,
  },
})
