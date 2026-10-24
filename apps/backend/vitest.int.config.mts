import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/int/**/*.int.spec.ts'],
    setupFiles: ['./tests/int/isolation.setup.ts'],
    // All int specs share one disposable Postgres, so run files one at a time
    // to keep table cleanup and migration-rehearsal fixtures isolated. Individual
    // specs explicitly exercise concurrent connections where required.
    fileParallelism: false,
  },
})
