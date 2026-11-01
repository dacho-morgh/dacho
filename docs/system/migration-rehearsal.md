# Migration rehearsal (T41 / #55)

T41 rehearses the upgrade from the migration level on `main` to the level on `staging`, using populated synthetic data in separate databases. It adds no migration and changes no application behavior. It does not authorize a production migration, and no real account, company or case has been mapped.

## What runs

`apps/backend/tests/int/migration-rehearsal.int.spec.ts` runs in the guarded backend integration suite, so CI repeats it on every PR. It creates four fixed databases beside the working test database, on the same disposable server, and drops them afterwards:

1. **Source copy.** `dacho_t41_legacy` is built to the `main` level (CMS through `20261022_200000_add_service_ordering`, backend through `1780511400004`) and then filled with old accounts, companies, cases, letters, activities and tickets. It is dumped with `pg_dump` and never upgraded.
2. **Upgrade.** The dump is restored into `dacho_t41_cms_first`, and both migration streams run forward. Every value of every old table and column must read back unchanged; only `users_roles` and the two journals may differ.
3. **Repeat start.** Running the migrations again must leave every table and sequence digest unchanged.
4. **Other start order.** The frontend and backend each migrate at their own startup, so nothing fixes their order. The dump is restored into `dacho_t41_backend_first`, the backend goes first, and the reconciliation report must match.
5. **Recovery.** A private document is added, and the database and files are backed up as a pair. The rollout is then damaged by deleting rows, changing a password hash and removing the file. Restoring the pair into `dacho_t41_restored` and a separate directory must reproduce the digests from before the damage and the exact file bytes.
6. **Isolation.** The digests of the source copy and the working test database must match their starting values.

The dump and restore tools run inside the disposable Postgres container named by `PHASE0_PG_CONTAINER`, which the CI job and `scripts/phase0-test.ps1 Backend` set. The suite fails if it is missing.

## Disposition of old records

Run the report on a migrated disposable copy. It reads one read-only snapshot and prints aggregate counts and migration names only:

```sh
RECONCILIATION_ACK=read-only-reconciliation pnpm --filter @dacho/backend reconciliation
```

Each account and case falls in exactly one group. A `review_*` group waits for a named person; no migration settles it.

| Old record | Report group | Result of the migration | Who settles it |
| --- | --- | --- | --- |
| Representative or referee only | `mapped_role` | Becomes `representative` or `reviewer` and stays active | Nobody; confirm the counts |
| Editor only | `editorial_only` | Keeps content access, with no operational role | Nobody; confirm the counts |
| Admin, with or without editor | `review_legacy_admin` | Inactive, no role; old roles stay in `legacy_roles` | System Owner, per account with `map-personnel` |
| Representative and referee together | `review_conflicting_roles` | Inactive, no role | System Owner, per account |
| No role | `review_no_role` | Inactive, no role | System Owner, per account |
| Case whose owner represents one company | `company_linked` | Gets that `company_id` | Nobody; confirm the counts |
| Case whose owner represents several companies | `review_ambiguous_owner` | `company_id` stays empty | Secretariat, with a reviewed mapping |
| Case whose owner has no company | `review_owner_without_company` | `company_id` stays empty | Secretariat, with a reviewed mapping |
| Case whose owner is not an account | `review_unknown_owner` | `company_id` stays empty | Secretariat, with a reviewed mapping |
| Case naming a company that does not exist | `review_unknown_company` | Value is kept | Secretariat, with a reviewed mapping |

The report also gives:

- **`requestScope`:** old cases have no event, so each stays `legacy_open` or `legacy_closed`. Moving one into an event needs an explicit mapping, and none has been defined.
- **`evidence`:** duplicate national IDs, company details on accounts that have no company, representatives of several companies, and letters or tickets addressed to unknown people. Accounts with duplicate national IDs get no company from the migration.
- **`pending.systemOwnerMissing`:** this stays true after migration because no old account becomes System Owner. Bootstrapping one is an explicit operator action; see [personnel foundation](personnel-foundation.md).

Password hashes and salts are kept for every account, including inactive ones.

## Limits

- **Level, not deployed state.** The starting point is the code level on `main`. The journals of the live database have not been read, so the two must be compared before a real rollout.
- **Synthetic data only.** This does not prove that real data migrates cleanly. A rehearsal on a sanitized copy of real data still needs its own plan and scrubbed fixture.
- **Migration runner.** The spec applies CMS migrations through their real `up` functions, one transaction each, as Payload does, but not through the `payload migrate` command. The older content migrations that call the Payload Local API run only while the empty legacy schema is built, against a stub that returns no documents. CI's Migrate step and the E2E job separately cover the real command on an empty database.
- **Application paths after restore.** The spec checks rows, relationships and file bytes. Login and permitted downloads on a restored build remain a human check.
- **Open gates.** Backup and restore of the production stack remain [T46](https://github.com/dacho-morgh/dacho/issues/60). [UAT41](https://github.com/dacho-morgh/dacho/issues/142) remains **Not run**.
