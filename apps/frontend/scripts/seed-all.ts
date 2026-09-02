import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const frontendDirectory = fileURLToPath(new URL('../', import.meta.url))
const tsxCli = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url))
const payloadCli = fileURLToPath(new URL('../node_modules/payload/bin.js', import.meta.url))

// Order matters: the landing seed replaces services, then the dashboard seed
// enriches those services with their operational keys and workflows.
const seedScripts = [
  'seed-landing.ts',
  'seed-dashboard.ts',
  'seed-forms.ts',
  'seed-service-account.ts',
  'create-admin.ts',
] as const

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    // dotenv/config and the Payload CLI resolve configuration from the app root.
    cwd: frontendDirectory,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

console.log('\n=== Applying pending Payload migrations ===')
run(process.execPath, [payloadCli, 'migrate'])

for (const script of seedScripts) {
  console.log(`\n=== Running ${script} ===`)

  const scriptPath = fileURLToPath(new URL(script, import.meta.url))
  run(process.execPath, [tsxCli, scriptPath])
}

console.log('\nAll seeds completed successfully.')
