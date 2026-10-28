# Migration inventory and rehearsal concerns

Inspected 2026-10-23; updated 2026-10-26 for T16. The inventory describes code in this checkout; no production migration was executed. See [test environment](test-environment.md) for the isolated synthetic rehearsal procedure.

| Owner | Location / migration journal | Current files | Scope |
| --- | --- | --- | --- |
| Payload CMS | `packages/cms-core/src/migrations/`, imported in `index.ts`; Payload `payload_migrations` journal in `public` | 23 TypeScript migrations from `20260810_103455` through `20261026_120000_company_dossier` (excluding `index.ts`; some generated JSON snapshots) | CMS content, users, companies, role evolution, events page content, editorial fields, company activity domain and dossier |
| Backend | `apps/backend/migrations/`; `dashboard.pgmigrations` journal via node-pg-migrate | 14 TypeScript migrations: `1780511400000`–`1780511400009`, `1780511400011`–`1780511400013`, `1780511400017` | Requests, letters, activities, support tickets/messages, author-role rekey, safe tracking sequence, case assignments, private document metadata, transition history, booth catalogue, company dossier boundary, event configuration, event audit history, company-owned requests and evaluations |
| Runtime-created OTP storage | `apps/backend/src/otp/postgres-code-store.ts` | No numbered migration | `dashboard.otp_codes` is ensured at runtime; inventory/restore must include it if present |

Payload runs explicit migrations with schema push disabled in `packages/cms-core/src/payload.config.ts`. That configuration has **no schema override**, and its migrations use `public` explicitly; `public` is the observed CMS schema in this checkout. The approved [backend design](backend-design.md) uses `cms.*` as a conceptual ownership label, so a future migration must not assume a deployed `cms` SQL schema. Backend `runMigrations` uses the actual `dashboard` schema and an advisory lock. Both services share one database but their migration journals and ownership boundaries differ; applying just one side does not produce a fully usable test app. Initial CMS migrations are chronological by `index.ts`; future migration files must be added there.

T25 adds `dashboard.evaluations` in `1780511400017_evaluations`, keyed by request,
person and revision. It stores draft/final state, rubric scores, answers and finalization
time. See [evaluation foundation](evaluation-foundation.md) for authorization, locking
and the remaining dedicated review-round dependencies.

T08 preserves legacy assignments, quarantines ambiguous accounts and requires explicit owner mapping; see [personnel foundation](personnel-foundation.md). Existing editorial privilege is independent of operational authority. No real accounts have been mapped by this implementation.

T09/T10 add only additive backend tables: `dashboard.case_assignments` (with an
active-row partial unique index and retained revocation history) and
`dashboard.private_documents` (safe storage metadata, at least one parent,
inclusive 10,000,000-byte check). They create no rows for existing requests and
do not rewrite company or request ownership. Deployment must mount and back up
`PRIVATE_DOCUMENTS_DIR` together with the database; see
[private documents](private-documents.md) and [test environment](test-environment.md).

T16 adds `dashboard.events`: title, description, registration window,
responsible chief, responsible investment reviewer, revision, creator and
timestamps. A second additive migration adds its `revision` column and
`dashboard.event_audit` rows with actor, reason, revision, changed fields and
before/after snapshots. The database enforces a non-empty title, non-empty
responsible ids, an ordered registration window, distinct responsible people
and one audit row per event revision. It creates no rows and does not rewrite
public `events`/`exhibitions` CMS content. Event commands are owner-only;
updates are revision-checked and audited atomically, and assigned responsibility
is read scope for the current chief or investment reviewer only.

Company-owned requests migration `1780511400013_company_owned_requests` adds nullable
`dashboard.requests.company_id` and its index. Its number follows staging's already
applied `1780511400011`/`1780511400012`; the unpublished `1780511400010` filename
is intentionally unused, not a migration to insert into existing journals. No live
deployment of that unpublished entry occurred. A disposable rehearsal database
that recorded it must be reset before testing the renamed migration; never rewrite
a live journal to accommodate a rename.

Backfill reads `public.companies` only when that table exists. CMS company ids and
representative ids are integers; `representative_id` has a non-unique index, not a
uniqueness constraint. Only representatives linked to exactly one company map to
requests, and existing non-null request companies stay unchanged. Unmapped and
ambiguous owners remain null for explicit reconciliation; oldest creation time,
including tied timestamps, is not ownership evidence. Rollback drops the new
column and its values, so retain a DB backup and reviewed mapping before rollout.

## Read-only aggregate inventory (T04 tooling slice)

From repository root, run against a **sanitized disposable database copy**, using an account granted SELECT on every application table:

```sh
INVENTORY_ACK=read-only-inventory pnpm --filter @dacho/backend inventory
```

Supply `DATABASE_URL` through the operator's secret environment; never commit it or paste credentials into reports. The command uses one repeatable-read, read-only transaction and a 30-second per-statement timeout. JSON contains exact row counts as decimal strings for visible base tables in `public` and `dashboard`, ordered by schema/table; it never emits row contents, connection URLs, personal IDs or filenames. Other schemas are deliberately excluded. Read-only does not mean zero load: use the disposable copy, not production.

PostgreSQL only exposes tables visible to the account in `information_schema`; restricted grants can omit tables. Compare names with the schema inventory and use an account with complete SELECT grants before treating counts as complete. Any query failure rejects the report rather than printing partial results. This is aggregate-count tooling only: migration journal contents, duplicate-ID checks, role/editor mapping, relationship audits, file backup manifests and restore rehearsal remain separate work. No real-data inventory or T04 completion is claimed.
## Existing data risks to resolve before a real rollout

T07 adds the request tracking sequence without rewriting existing codes. Its initialization, old-writer exclusion, backup and rollback requirements are documented in [request tracking foundation](request-tracking-foundation.md). The isolated migration tests use synthetic data and do not complete the real-data inventory below.

1. `20261017_210000_company_and_collapsed_roles` maps legacy CMS `admin`/`editor` and applicant/representative accounts, creates a company only for unambiguous national IDs, and retains duplicate-ID legacy records for manual reconciliation. It does **not** map the seven operational roles. Review each real account and preserve editorial `editor` explicitly; do not infer System Owner from the old `admin` label.
2. `20261017_223000_rename_user_role_and_drop_roles_collection` renames the users role relation and retains legacy workflow/role tables rather than deleting them. Confirm real row counts and dependent references before later cleanup. The existing integration spec tests a synthetic legacy schema in a rollback transaction; it is not an inventory of deployed data.
3. `20261018_090000_add_editor_role` adds an enum label; its `down` is intentionally a no-op because dropping a populated enum value would lose assignments. Treat rollback as restore/forward repair, not automatic down migration.
4. Generic dashboard requests now have company and revision fields, but company backfill deliberately leaves unmatched or ambiguous owners null; event/subtopic identity is still absent. Any later conversion needs an explicit mapping for each unresolved row, unmatched services and correspondence. Avoid assigning live requests to a company or new event by guesswork.
5. Public editorial media and private documents use separate storage and backup manifests. The T10 store starts empty and is not populated from public media; classifying existing public files as private documents would require a separate reviewed migration.

Before a real migration, capture versioned DB + file backups together, production row counts and duplicate national IDs, account/role/editor mapping, dashboard request/letter dependencies, migration journals, a restore checkpoint and a rollback/forward-repair decision. Rehearse on a sanitized disposable copy with the same schema version. The Phase 0 isolated suite uses synthetic data only and cannot complete this real-data inventory.
