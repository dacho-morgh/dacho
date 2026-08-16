# dacho

Production-ready, self-hosted architecture for **dacho innovation fun**. Two deployable services plus a shared, React-free CMS domain package, in one pnpm + Turborepo monorepo.

See [`docs/back-end-system-design.md`](docs/back-end-system-design.md) for the full architecture.

## Packages

| Package | Kind | Stack | Role |
|---|---|---|---|
| `apps/frontend` | deployable | Next.js 16 + Payload 3 | Fused CMS + public site — admin panel, REST/GraphQL API, and the public site in one app |
| `apps/backend` | deployable | Node.js + TypeScript | Business logic and data APIs (framework TBD: Express/NestJS/Fastify) |
| `packages/cms-core` | library | Payload 3 | **React-free** CMS domain definition: config, collections, globals, fields, hooks, access control, and generated `payload-types.ts`. No Next.js, no React. |

## Layout

```
apps/
  frontend/         # Fused CMS + site (Next.js + Payload)
  backend/          # Node.js/TypeScript API
packages/
  cms-core/         # React-free CMS domain + generated types
```

## Prerequisites

- Node.js ≥ 20.9
- pnpm ≥ 9
- PostgreSQL (for the Payload admin panel — `DATABASE_URL`)

## Getting started

```bash
pnpm install
cp apps/frontend/.env.example apps/frontend/.env   # set DATABASE_URL + PAYLOAD_SECRET
pnpm dev
```

- Public site: `http://localhost:3000`
- Admin panel: `http://localhost:3000/admin`
- REST API: `http://localhost:3000/api/*`
- GraphQL: `http://localhost:3000/api/graphql`

## Commands

```bash
pnpm dev          # run all workspace dev servers
pnpm build        # build all packages (turbo)
pnpm typecheck    # typecheck all packages (turbo)
```

## Code generation

Two generated artifacts are owned by different packages — keep them in sync:

```bash
# CMS types — generated in place inside cms-core (typescript.outputFile)
cd packages/cms-core && pnpm generate:types

# Admin import map — generated in the frontend (importMap.baseDir injected there)
cd apps/frontend && pnpm generate:importmap
```

## Architecture notes

- **`cms-core` is React-free.** It holds the entire Payload domain (config, collections, globals, fields, hooks, access) and the generated types — nothing else. Custom admin components (custom fields, blocks, login screens) live in `apps/frontend`, keeping the domain package server-only.
- **The frontend re-exports the CMS config** via a thin `src/payload.config.ts` wrapper. It imports `@dacho/cms-core`, awaits it, and injects its own `admin.importMap.baseDir` so `payload generate:importmap` writes into the frontend, where those components live.
- **`buildConfig()` is async.** Payload 3's `buildConfig` returns `Promise<SanitizedConfig>`, not a plain object. Any consumer of `@dacho/cms-core`'s default export **must `await` it** before spreading or reading `collections`/`db`/`editor`.
- **Backend reads CMS data via Payload's API** — no direct table access; it consumes types from `@dacho/cms-core`.
- **Database schema separation** (target state): `cms.*` for Payload tables, `public.*` for backend tables.

## Deployment strategy

- **Phase 1 (current):** Docker Compose on a single VPS (Postgres, Redis, fused Front-end + CMS, Backend API behind Nginx/Caddy).
- **Aspirational:** full Kubernetes orchestration (Argo CD, canary, Higress gateway, observability) — see the design doc.
