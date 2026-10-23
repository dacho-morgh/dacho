# Delivery branches

Use `staging` as the integration branch and the default base for feature/fix pull requests. Continue work on a `codex/` branch, then merge to `staging` only after the shared CI checks pass.

`main` is production: a change there can deploy directly to the live service. Pushes, merges, force pushes, resets and production deployment from `main` require an explicit release instruction from the human user for that action. A request to implement, test, publish staging images or update a task does not authorize a production release. Keep production credentials, volumes and image tags separate from staging.

Staging must run the same lint, typecheck, unit, database-free build, integration and E2E checks as production. Publish staging images only after those checks pass. Keep the integration-test isolation guard active in CI.

For staging build/runtime configuration and operator commands, read [docs/staging.md](docs/staging.md). For approved product scope and task dependencies, read [docs/system/README.md](docs/system/README.md).
