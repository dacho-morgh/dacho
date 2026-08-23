# Deployment (VPS)

How to run the full stack — Postgres, fused frontend/CMS, and the OTP-auth backend — on a single Linux VPS with Docker Compose.

## 1. Prerequisites

- Ubuntu/Debian VPS, ≥ 2 GB RAM (4 GB recommended — Payload + Next.js are heavy).
- Docker + Docker Compose v2.
- Node.js 22 + pnpm — only for the one-time migrate/seed step.
- A domain pointing at the VPS (for TLS).

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Node 22 + pnpm (for the payload CLI)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
npm install -g pnpm@11.21.0
```

## 2. Clone + generate secrets

```bash
git clone <repo-url> dacho && cd dacho

# JWT signing key — generate ONCE and back it up. Losing it invalidates every
# issued token (OTP JWTs, service-account tokens).
mkdir -p secrets
openssl ecparam -genkey -name prime256v1 -noout | openssl pkcs8 -topk8 -nocrypt -out secrets/jwt-private.pem

# Payload secret (≥ 32 bytes recommended)
openssl rand -hex 32 > secrets/payload-secret
```

Both files are gitignored. Compose mounts them as Docker secrets and the apps read them via `JWT_PRIVATE_KEY_FILE` / `PAYLOAD_SECRET_FILE` — they are **not** passed as plain env vars.

## 3. Configure `.env`

Create `.env` (gitignored). `PAYLOAD_SECRET` is **not** set here — it comes from `secrets/payload-secret`.

```env
# backend → Payload REST. Seed this key first (§5), then paste it here.
PORT=4000
DATABASE_URL=postgres://dacho:dacho@localhost:5432/dacho-cms
PAYLOAD_API_KEY=<seed:service-account output>

# OTP delivery
OTP_DELIVERY=kavenegar
KAVENEGAR_API_KEY=<key>
KAVENEGAR_TEMPLATE=<template>

# Public origin (must match the reverse-proxy domain)
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
```

Production hardening before the first build:

- Change the Postgres credentials in `docker-compose.yml` (`POSTGRES_PASSWORD` **and** both `DATABASE_URL` values — the frontend build arg and the runtime values). They must match.
- Drop or keep `swagger` loopback-only (it already binds `127.0.0.1:8080`).
- Change the backend port mapping `4000:4000` → `127.0.0.1:4000:4000` (only the frontend should be public).

## 4. Build order

The image build is self-contained — it does **not** need a reachable database
(build-time Payload queries are guarded by `buildSafe`, and the config's
required env vars fall back to build-time placeholders). Migrate before the
first `up` so the schema exists when the app starts serving.

```bash
docker compose build                              # no database needed
docker compose up -d postgres
pnpm install --frozen-lockfile                    # payload CLI on the host (one-time)
pnpm --filter @dacho/frontend payload migrate     # create the schema
docker compose up -d
```

## 5. Seed (first deploy)

```bash
pnpm --filter @dacho/frontend seed:service-account   # prints PAYLOAD_API_KEY
# then seed content: POST /next/seed (or the "Seed" button on the admin dashboard)
```

## 6. Reverse proxy + TLS (Caddy)

Only the frontend (`:3000`) is public; the backend (`:4000`) and Postgres stay internal on the compose network.

```caddy
your-domain.com {
  reverse_proxy localhost:3000
}
```

## 7. Verify

```bash
docker compose ps                                 # all Up/healthy
curl https://your-domain.com/api/users/me         # Payload API — 401 means alive
curl -s http://localhost:4000/health              # backend
# admin: https://your-domain.com/admin
```

## 8. Operations

- **Backups:** `secrets/jwt-private.pem`, `secrets/payload-secret`, and the `pgdata` volume. Restoring the JWT key is critical.
- **Updates:** `git pull` → `docker compose build` → `docker compose up -d`.
- **Fresh DB:** `docker compose down -v`, then repeat §4 (build → up postgres → migrate → up).

## Notes

- The frontend runs via `next start` against a complete prod `node_modules` — **not** Next's `output: standalone` tracer, which only partially copies symlinked pnpm deps (e.g. `@swc/helpers/esm`) and crashed on boot.
- `payload migrate` at container startup is a catch-up no-op; the entrypoint auto-answers Payload's "dev mode → data loss?" prompt with "no" so it can't hang a non-interactive boot.
