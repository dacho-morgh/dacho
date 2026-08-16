# dacho

Production-ready, self-hosted architecture for **dacho innovation fun**. Two deployable services plus a shared, React-free CMS domain package, in one pnpm + Turborepo monorepo.

See [`docs/linear/back-end-system-design.md`](docs/linear/back-end-system-design.md) for the full architecture.

## Packages

| Package | Kind | Stack | Role |
|---|---|---|---|
| `apps/frontend` | deployable | Next.js 16 + Payload 3 | Fused CMS + public site — admin panel, REST/GraphQL API, and the public site in one app |
| `apps/backend` | deployable | Node.js + TypeScript | Application auth (OTP-first, ES256 JWT, `POST /auth/*` + JWKS) and, upcoming, the workflow engine + business-logic APIs (Express) |
| `packages/cms-core` | library | Payload 3 | **React-free** CMS domain: config, collections, globals, fields, hooks, access control, migrations, and generated `payload-types.ts` |

## Dependency graph

```
apps/frontend ──▶ packages/cms-core ──▶ payload, @payloadcms/*, next, sharp
apps/backend  ──▶ packages/cms-core
```

- **Direction is one-way:** `frontend → cms-core → frameworks`, and `backend → cms-core`. `cms-core` never imports from `frontend` or `backend`.
- **Cross-package** imports use the package name: `@dacho/cms-core` (config + types) and `@dacho/cms-core/utilities` (client-safe `getURL`/`canUseDOM` — deliberately excluded from the config barrel so client components don't bundle the server stack).
- **Internal aliases:** `@cms-core/*` → `packages/cms-core/src/*` (used inside cms-core, avoiding `../` traversal), and `@/*` → `apps/frontend/src/*` (inside the frontend). Both are declared in their package's `tsconfig.json`; the frontend's tsconfig also maps `@cms-core/*` so cms-core files resolve correctly when transpiled from the app.

## Layout

```
apps/
  frontend/         # Fused CMS + site (Next.js + Payload)
  backend/          # Express API — OTP auth (ES256 JWT), future workflow engine
packages/
  cms-core/         # React-free CMS domain + generated types + migrations
```

## Environment variables

### Frontend (`apps/frontend/.env`)

Required — the config **throws on startup** if these are missing (no silent empty defaults):

- `DATABASE_URL` — Postgres connection string (`postgres://dacho:dacho@localhost:5432/dacho-cms`).
- `PAYLOAD_SECRET` — signs Payload auth/JWT tokens.

Optional: `NEXT_PUBLIC_SERVER_URL` (defaults to `http://localhost:3000`), `CRON_SECRET`, `PREVIEW_SECRET`, `BACKEND_JWKS_URL` (JWKS URL the `backend-jwt` strategy uses to verify backend-issued ES256 tokens).

### Backend (`apps/backend`)

Required — `loadConfig` throws at startup if these are missing/empty:

- `DATABASE_URL` — Postgres connection string.
- `JWT_PRIVATE_KEY` — PKCS8 PEM (ES256) signing key.
- `PAYLOAD_URL` — Payload REST base URL (e.g. `http://localhost:3000`).
- `PAYLOAD_API_KEY` — service-account API key (from `pnpm --filter @dacho/frontend seed:service-account`).

Optional: `PORT` (default `4000`), `JWT_KID` (default `dacho-backend`), `OTP_DELIVERY` (`console` | `kavenegar`, default `console`). When `OTP_DELIVERY=kavenegar`, `KAVENEGAR_API_KEY` + `KAVENEGAR_TEMPLATE` are required.

Templates: root `.env.example` (backend) and `apps/frontend/.env.example` (frontend).

## Prerequisites

- Node.js ≥ 20.19
- pnpm ≥ 11 (the workspace uses pnpm 11 `allowBuilds`)
- PostgreSQL

## Getting started

```bash
pnpm install
cp apps/frontend/.env.example apps/frontend/.env   # set DATABASE_URL + PAYLOAD_SECRET
docker compose up -d postgres
pnpm --filter @dacho/frontend payload migrate       # apply schema from cms-core/src/migrations
pnpm dev
```

- Public site: `http://localhost:3000`
- Admin panel: `http://localhost:3000/admin`
- REST API: `http://localhost:3000/api/*`
- GraphQL: `http://localhost:3000/api/graphql`

## Commands

```bash
pnpm dev            # run all workspace dev servers
pnpm build          # build all packages (turbo)
pnpm typecheck      # typecheck all packages (turbo)
pnpm lint           # lint all packages (turbo)

# Tests (need a running Postgres)
pnpm --filter @dacho/frontend test:int   # vitest integration tests (Node environment)
pnpm --filter @dacho/frontend test:e2e   # Playwright (needs seeded content — see below)
```

## Migrations

Migrations live in `packages/cms-core/src/migrations` — cms-core owns the schema. The adapter's `migrationDir` is pinned there so the default resolver (which looks relative to `process.cwd()`) can't miss them when building from the frontend:

```bash
pnpm --filter @dacho/frontend payload migrate
```

In dev, Payload pushes the schema directly; in production builds it applies the migrations.

## Code generation

Both generated artifacts are produced **from the frontend** (it owns `.env` and the custom admin components):

```bash
cd apps/frontend
pnpm generate:types       # writes packages/cms-core/src/payload-types.ts (config's typescript.outputFile)
pnpm generate:importmap   # writes apps/frontend/src/app/(payload)/admin/importMap.js
```

## Tests & seeding

- `test:int` runs `tests/int/**/*.int.spec.ts` against a real Postgres. The environment is `node` (not `jsdom`) because the spec bootstraps the full Payload config.
- `test:e2e` runs Playwright against `pnpm dev` (browser: Playwright 1.61, chromium). The homepage spec expects seeded content — seed first via `POST /next/seed` (there's a "Seed" button on the admin dashboard) or directly against `apps/frontend/src/endpoints/seed/`. Seeding downloads placeholder images from a remote URL, so it needs network access.

## Architecture notes

- **`cms-core` is React-free.** It holds the entire Payload domain (config, collections, globals, fields, hooks, access) and the generated types — nothing else. Custom admin components (custom fields, blocks, login screens) live in `apps/frontend`, keeping the domain package server-only. The only `@/` references inside cms-core are *string* component identifiers (`'@/components/BeforeLogin'`, `'@/Header/RowLabel#RowLabel'`) resolved by the frontend's import map at runtime — not TypeScript imports.
- **The frontend re-exports the CMS config** via a thin `src/payload.config.ts` wrapper. It imports `@dacho/cms-core`, awaits it, and injects its own `admin.importMap.baseDir` so `payload generate:importmap` writes into the frontend, where those components live.
- **`buildConfig()` is async.** Payload 3's `buildConfig` returns `Promise<SanitizedConfig>`, not a plain object. Any consumer of `@dacho/cms-core`'s default export **must `await` it** before spreading or reading `collections`/`db`/`editor`.
- **Backend reads CMS data via Payload's API** — no direct table access; it consumes types from `@dacho/cms-core`.
- **Database schema separation** (target state): `cms.*` for Payload tables, `public.*` for backend tables.

## Deployment strategy

- **Phase 1 (current):** Docker Compose on a single VPS (Postgres, Redis, fused Front-end + CMS, Backend API behind Nginx/Caddy).
- **Aspirational:** full Kubernetes orchestration (Argo CD, canary, Higress gateway, observability) — see the design doc.
