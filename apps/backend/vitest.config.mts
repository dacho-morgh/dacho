import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Backend specs bootstrap Express — always Node. Integration tests that need
    // a real Postgres live in tests/int/ and run via `test:int`.
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/int/**'],
  },
})
