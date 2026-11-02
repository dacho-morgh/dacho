# Local isolated test database (no Docker)

The integration suites refuse to run unless they talk to the isolated database (`PHASE0_ISOLATED_TEST=1`, the `phase0_test_guard` marker row and the `.phase0-test-files` marker). With Docker, use `scripts/phase0-test.ps1`. Without it, `scripts/phase0-test-local.ps1` builds the same database on a local PostgreSQL (17 or 18) and sets the same environment.

```powershell
$env:PHASE0_PG_BIN = 'C:\path\to\pgsql\bin'   # omit when pg_ctl is on PATH
$env:PHASE0_PG_DATA = 'C:\path\to\cluster'     # omit for <repo>\.phase0-test-pgdata
./scripts/phase0-test-local.ps1 Start          # init on first run, then start (port 55439)
./scripts/phase0-test-local.ps1 Migrate        # CMS + dashboard migrations
./scripts/phase0-test-local.ps1 Frontend       # frontend integration suite
./scripts/phase0-test-local.ps1 Backend        # backend integration suite
```

- `Start` is safe to rerun: it starts a stopped cluster and leaves existing data alone. Run `Migrate` again after rebasing onto new migrations.
- A cluster does not start on boot. After a restart, run `Start` again.
- `Env` prints the environment as `export` lines for a bash shell, for running a single spec with vitest.
- The `migration-rehearsal` spec needs Docker (`pg_dump`/`pg_restore` inside the container); skip it locally.
- This database is disposable test data only. Never point `PHASE0_PG_DATA` at a dev or shared cluster.

## Running the apps locally

The dev database comes from each app's `.env`. If the global `pnpm` shim fails under Node 24, use `corepack pnpm`.

- Backend: `cd apps/backend && node --env-file=.env node_modules/tsx/dist/cli.mjs watch src/index.ts` (port 4000)
- Frontend: `PORT=3001 corepack pnpm --filter @dacho/frontend dev` (`pnpm dev` through turbo may fail on Windows)
- After pulling new migrations, the dev database needs them too: `corepack pnpm --filter @dacho/frontend payload migrate` and the backend `migrate` script. Otherwise login fails with "relation … does not exist".
- `corepack pnpm --filter @dacho/frontend seed:roles` creates one dev login per operational role (password in `scripts/seed-role-users.ts`), for design checks.
