# Phase 0 isolated integration environment

## Real-backend browser checks

The CI E2E job uses its own disposable Postgres service. It migrates Payload,
seeds content and an explicit CMS service account, and builds both services.
Each run generates a fresh ES256 signing key, service API key and internal proxy
secret. Playwright owns both processes, waits for backend `/health` (the backend
listens only after its startup migrations), and stops them after the suite. CI
does not reuse existing servers; the signing-key file is removed even on failure.

For local E2E, use a disposable database and synthetic data only. Configure the
same backend-required environment documented in `.env.example`, run
`seed:service-account` with an explicit `SERVICE_ACCOUNT_API_KEY`, and set the
matching `PAYLOAD_API_KEY` and `INTERNAL_PROXY_SECRET` for both processes. Set
`PLAYWRIGHT_BACKEND_SERVER_COMMAND="pnpm --filter @dacho/backend start"` after
building the backend to have Playwright own it; otherwise start the configured
backend yourself. The frontend command still defaults to `pnpm dev` locally.
The mobile profile checks require real authenticated API company/contact data
and visible fixture fields at 360, 390 and 430 px; HTTP 200 alone is insufficient.
These checks are engineering regression evidence, not human acceptance or T45.

This is an opt-in local environment for backend/Payload integration fixtures and migration rehearsal. It contains **synthetic data only**. It is not a copy of production and does not establish that a real-data migration is safe. The approved requirements explicitly prohibit destructive fixture suites or migration rehearsals on shared/live databases.

## Isolation and fail-closed checks

`docker-compose.test.yml` is a standalone Compose file with project `dacho-phase0-test`, database `dacho_phase0_test`, user `phase0_test`, a dedicated named Postgres volume and loopback port **55439**. It does not refer to the normal Compose project, `pgdata` volume, port 5432 or production secrets. `scripts/phase0-test.ps1` sets `DATABASE_URL` to that exact endpoint, `PAYLOAD_MEDIA_DIR` to ignored `.phase0-test-files` and `PRIVATE_DOCUMENTS_DIR` to `.phase0-test-files/private-documents` in this checkout; it also prevents dotenv from overriding those process values. The file directory has its own marker. The database is initialized with `public.phase0_test_guard` and an exact marker.

Both integration Vitest configurations load the same guard **before test files**. The guard requires `PHASE0_ISOLATED_TEST=1`, the exact URL including user/password/port/database and no query parameters, the exact marked file directory, a separate marked private-document subdirectory, and the live database marker. A missing variable or marker aborts the suite. This closes the existing default-URL path in backend specs and protects direct `pnpm ... test:int` invocations. The frontend config's `test:int` includes CMS integration specs that delete fixture rows and create files. Keep these gates if new integration configurations are added. Unit tests do not need Docker.

The guard is a test harness safety net, not a migration deployment gate: direct `payload migrate`/backend `migrate` commands outside the script still accept arbitrary `DATABASE_URL`. Use the wrapper below for rehearsal. Production change control remains separate.

## Local commands (PowerShell from repository root)

GitHub Actions uses the same isolation contract: the integration job creates
its ephemeral Postgres service with the Phase 0 credentials/database and port
55439, sets the opt-in flag, checkout-local media directory and separate
private-document directory at job scope, and initializes both markers before
migrations or either suite. The initial
CI failure came from leaving its old `5432/dacho-cms` service/env in place
after introducing the guard. See `.github/workflows/ci.yml` and the regression
check `python scripts/test-ci-isolation.py`; the guard itself remains active.

```powershell
./scripts/phase0-test.ps1 Start
./scripts/phase0-test.ps1 Migrate
./scripts/phase0-test.ps1 Backend
./scripts/phase0-test.ps1 Frontend
./scripts/phase0-test.ps1 Backup
./scripts/phase0-test.ps1 RestoreRehearsal
./scripts/phase0-test.ps1 Stop
```

`Start` creates only the ignored test file area and dedicated container/volume. `Migrate` checks both markers before running CMS migrations in `public` and backend migrations in `dashboard` on the isolated database. Run it before frontend integration specs that use Payload. `Backend` and `Frontend` use the same guards. `Backup` inserts a clearly synthetic round-trip row and file, then writes a PostgreSQL custom-format dump and matching file ZIP to ignored `.phase0-test-backups`. `RestoreRehearsal` restores the latest pair into the fixed **separate** `dacho_phase0_restore` database and an ignored `restored-files` directory; it checks the database marker, synthetic row, file marker and file SHA-256 while leaving the working test database intact. `Stop` stops the isolated container and preserves its volume and backups for inspection. `Status` shows only this Compose project.

Do not combine `docker-compose.test.yml` with another Compose file or override the fixed database/volume. No real user/company/document dump belongs in this setup. If testing migration against a sanitized real-data copy later, obtain a separate plan and scrubbed fixture; the current marker and URL intentionally refuse it.

## Rehearsal evidence and limits

Database and files must be backed up as one versioned pair; a database-only restore can leave document metadata pointing at missing bytes. The marked test file root now contains both editorial fixtures and the `private-documents` subdirectory, so a future backup pairs the `.dump` with private metadata bytes as well. The 2026-10-23 restore result predates that store and is not evidence that a private-document backup/restore has been rehearsed; the 2026-10-24 batch did not re-run Backup/RestoreRehearsal.

On **2026-10-23**, `Start` created healthy `dacho-phase0-test-postgres-1` with its own named volume. `Migrate` applied all **20 CMS** and **5 backend** migrations; direct journal queries in `dacho_phase0_test` confirmed `public.payload_migrations=20` and `dashboard.pgmigrations=5`. A direct backend `test:int` attempt without the opt-in flag stopped during setup with **zero tests collected**, proving the default destructive path is closed. The wrapper then passed backend integration (**6 files, 35 tests**) and frontend integration (**44 files, 171 tests passed; 1 file/test skipped**). Backend and frontend typechecks passed.

On **2026-10-24**, the T09/T10 batch re-ran the same guarded wrapper. The
disposable database now records **7 backend** migrations
(`dashboard.pgmigrations=7`), including
`1780511400006_shared_access_and_private_documents`. Backend integration passed
**8 files / 49 tests**; frontend integration passed **49 files + 1 skipped** and
**202 tests passed + 1 skipped**. The private-document suite exercises the real
file directory and Postgres rows, including exact 10,000,000/10,000,001-byte
boundaries, cross-company denial, financial exclusion, assignment/role/deactivation
revocation and failed-upload non-advancement. Backup/restore was not re-run for
this batch; the 2026-10-23 pair remains the recorded rehearsal evidence.

`Backup` produced `.phase0-test-backups/phase0-20261023-180549.dump` with matching `phase0-20261023-180549-files.zip`, after inserting only synthetic `phase0-synthetic-row-v1` and `phase0-synthetic-file-v1`. `RestoreRehearsal` restored the dump to `dacho_phase0_restore` and the ZIP to ignored `restored-files`; the database marker and row matched, and source/restored file SHA-256 matched `AF7F0D581BFACF64FD500C7E31440DD5700FCC40A6031569057738FC969C97A0`. These backup files contain test data and stay ignored locally. No production or shared database was contacted.

## Delivery record

PR [#149](https://github.com/dacho-morgh/dacho/pull/149) (reviewed head `fa15705`) was squash-merged into `staging` as `f29b229d495ccce6b4dd4d6271d905ea099ff548` on 2026-10-24. Its staging CI ([run 40112972154](https://github.com/dacho-morgh/dacho/actions/runs/40112972154)) passed all five checks, including E2E with the real backend, and published the `staging-sha-f29b229` images. The same real-backend mobile profile assertions also passed on the integrated PR #150 head `279d172` ([run 40113036156](https://github.com/dacho-morgh/dacho/actions/runs/40113036156)). Issue #148 is closed and its project card is Done.

These checks remain engineering regression evidence: no human acceptance, T45 completion or staging runtime deployment is claimed. The integration isolation guard and the five shared staging checks remain active.
