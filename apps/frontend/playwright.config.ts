import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: [
    // Opt in when Playwright should own the real backend lifecycle. Otherwise
    // local runs use the backend already configured by the developer.
    ...(process.env.PLAYWRIGHT_BACKEND_SERVER_COMMAND
      ? [
          {
            command: process.env.PLAYWRIGHT_BACKEND_SERVER_COMMAND,
            url: `${process.env.BACKEND_URL ?? 'http://localhost:4000'}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 180000,
          },
        ]
      : []),
    {
      // CI runs the e2e suite against a production build (`pnpm start`); locally
      // `pnpm dev` stays the default for fast iteration.
      command: process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? 'pnpm dev',
      reuseExistingServer: !process.env.CI,
      url: 'http://localhost:3000',
      // First `next dev` compile of the Payload app + workspace packages can
      // exceed the 60s default before :3000 responds.
      timeout: 180000,
    },
  ],
})
