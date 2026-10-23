# Phase 0 isolated integration environment

This is an opt-in local environment for backend/Payload integration fixtures and migration rehearsal. It contains **synthetic data only**. It is not a copy of production and does not establish that a real-data migration is safe. The approved requirements explicitly prohibit destructive fixture suites or migration rehearsals on shared/live databases.

## Isolation and fail-closed checks

`docker-compose.test.yml` is a standalone Compose file with project `dacho-phase0-test`, database `dacho_phase0_test`, user `phase0_test`, a dedicated named Postgres volume and loopback port **55439**. It does not refer to the normal Compose project, `pgdata` volume, port 5432 or production secrets. `scripts/phase0-test.ps1` sets `DATABASE_URL` to that exact endpoint and `PAYLOAD_MEDIA_DIR` to ignored `.phase0-test-files` in this checkout; it also prevents dotenv from overriding those process values. The file directory has its own marker. The database is initialized with `public.phase0_test_guard` and an exact marker.

Both integration Vitest configurations load the same guard **before test files**. The guard requires `PHASE0_ISOLATED_TEST=1`, the exact URL including user/password/port/database and no query parameters, the exact marked file directory, and the live database marker. A missing variable or marker aborts the suite. This closes the existing default-URL path in backend specs and protects direct `pnpm ... test:int` invocations. The frontend config's `test:int` includes CMS integration specs that delete fixture rows and create files. Keep these gates if new integration configurations are added. Unit tests do not need Docker.

The guard is a test harness safety net, not a migration deployment gate: direct `payload migrate`/backend `migrate` commands outside the script still accept arbitrary `DATABASE_URL`. Use the wrapper below for rehearsal. Production change control remains separate.

## Local commands (PowerShell from repository root)

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

Database and files must be backed up as one versioned pair; a database-only restore can leave document metadata pointing at missing bytes. The current system has only public editorial media, so a private document store round-trip cannot yet be exercised. The result below does not prove safety of the future seven-role schema migration or confidential-file implementation.

On **2026-10-23**, `Start` created healthy `dacho-phase0-test-postgres-1` with its own named volume. `Migrate` applied all **20 CMS** and **5 backend** migrations; direct journal queries in `dacho_phase0_test` confirmed `public.payload_migrations=20` and `dashboard.pgmigrations=5`. A direct backend `test:int` attempt without the opt-in flag stopped during setup with **zero tests collected**, proving the default destructive path is closed. The wrapper then passed backend integration (**6 files, 35 tests**) and frontend integration (**44 files, 171 tests passed; 1 file/test skipped**). Backend and frontend typechecks passed.

`Backup` produced `.phase0-test-backups/phase0-20261023-180549.dump` with matching `phase0-20261023-180549-files.zip`, after inserting only synthetic `phase0-synthetic-row-v1` and `phase0-synthetic-file-v1`. `RestoreRehearsal` restored the dump to `dacho_phase0_restore` and the ZIP to ignored `restored-files`; the database marker and row matched, and source/restored file SHA-256 matched `AF7F0D581BFACF64FD500C7E31440DD5700FCC40A6031569057738FC969C97A0`. These backup files contain test data and stay ignored locally. No production or shared database was contacted.
