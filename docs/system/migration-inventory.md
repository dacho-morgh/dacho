# Migration inventory and rehearsal concerns

Inspected 2026-10-23. The inventory describes code in this checkout; no production migration was executed. See [test environment](test-environment.md) for the isolated synthetic rehearsal procedure.

| Owner | Location / migration journal | Current files | Scope |
| --- | --- | --- | --- |
| Payload CMS | `packages/cms-core/src/migrations/`, imported in `index.ts`; Payload `payload_migrations` journal in `public` | 20 TypeScript migrations from `20260810_103455` through `20261022_200000_add_service_ordering` (some generated JSON snapshots) | CMS content, users, companies, role evolution, events page content and editorial fields |
| Backend | `apps/backend/migrations/`; `dashboard.pgmigrations` journal via node-pg-migrate | 6 TypeScript migrations `1780511400000`–`1780511400005` (T07 update, 2026-10-24) | Requests, letters, activities, support tickets/messages, author-role rekey and safe tracking sequence |
| Runtime-created OTP storage | `apps/backend/src/otp/postgres-code-store.ts` | No numbered migration | `dashboard.otp_codes` is ensured at runtime; inventory/restore must include it if present |

Payload runs explicit migrations with schema push disabled in `packages/cms-core/src/payload.config.ts`. That configuration has **no schema override**, and its migrations use `public` explicitly; `public` is the observed CMS schema in this checkout. The approved [backend design](backend-design.md) uses `cms.*` as a conceptual ownership label, so a future migration must not assume a deployed `cms` SQL schema. Backend `runMigrations` uses the actual `dashboard` schema and an advisory lock. Both services share one database but their migration journals and ownership boundaries differ; applying just one side does not produce a fully usable test app. Initial CMS migrations are chronological by `index.ts`; future migration files must be added there.

## Existing data risks to resolve before a real rollout

T07 adds the request tracking sequence without rewriting existing codes. Its initialization, old-writer exclusion, backup and rollback requirements are documented in [request tracking foundation](request-tracking-foundation.md). The isolated migration tests use synthetic data and do not complete the real-data inventory below.

1. `20261017_210000_company_and_collapsed_roles` maps legacy CMS `admin`/`editor` and applicant/representative accounts, creates a company only for unambiguous national IDs, and retains duplicate-ID legacy records for manual reconciliation. It does **not** map the seven operational roles. Review each real account and preserve editorial `editor` explicitly; do not infer System Owner from the old `admin` label.
2. `20261017_223000_rename_user_role_and_drop_roles_collection` renames the users role relation and retains legacy workflow/role tables rather than deleting them. Confirm real row counts and dependent references before later cleanup. The existing integration spec tests a synthetic legacy schema in a rollback transaction; it is not an inventory of deployed data.
3. `20261018_090000_add_editor_role` adds an enum label; its `down` is intentionally a no-op because dropping a populated enum value would lose assignments. Treat rollback as restore/forward repair, not automatic down migration.
4. Generic dashboard requests are owner-user based and lack company/event/subtopic/revision identity. Any future conversion needs an explicit mapping for each existing row, unmatched services and correspondence. Avoid assigning live requests to a new event by guesswork.
5. Public editorial media and future private documents need separate storage and backup manifests. Current public media paths are not a private-file migration source without classification and access review.

Before a real migration, capture versioned DB + file backups together, production row counts and duplicate national IDs, account/role/editor mapping, dashboard request/letter dependencies, migration journals, a restore checkpoint and a rollback/forward-repair decision. Rehearse on a sanitized disposable copy with the same schema version. The Phase 0 isolated suite uses synthetic data only and cannot complete this real-data inventory.
