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
    // Every spec here bootstraps the full Payload config against one real
    // Postgres, and the fixtures are hand-picked unique rows (user phone
    // numbers, company national ids). At full fan-out on a 12-core box the
    // contention starts showing up as spurious failures — duplicate-key
    // violations and slow-test timeouts in files that pass in isolation. The
    // backend's int config solves this outright with `fileParallelism: false`;
    // this suite is large enough that serialising it is wasteful, so cap the
    // workers instead.
    maxWorkers: 4,
  },
})