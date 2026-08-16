import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // The integration spec bootstraps the full Payload config (db-postgres,
    // Node builtins, sharp) and talks to a real Postgres — it must run in the
    // Node environment, not jsdom. Component tests can opt back into jsdom
    // per-file with `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
  },
})
