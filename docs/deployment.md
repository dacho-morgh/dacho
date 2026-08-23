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

## 9. Alternative: run prebuilt GHCR images (no build on the VPS)

CI publishes both services to GHCR on every push, so the VPS can pull instead of
build — no source checkout, no toolchain, no 5-minute build on a small box. Use
`docker-compose.prod.yml`, which is **standalone** (do not combine it with
`docker-compose.yml`; that one builds from source).

Images:

```
ghcr.io/dacho-morgh/dacho/frontend:<tag>
ghcr.io/dacho-morgh/dacho/backend:<tag>
```

Tags come from `docker/metadata-action`: `sha-<short>` for every build,
`pr-<n>` on pull requests, the branch name on branch pushes, and `latest` only
on pushes to `main`. **Pin `sha-<short>` in production** — it is immutable, so a
redeploy can never silently pick up different code, and rolling back is just
changing one line.

### One-time: authenticate to GHCR

The repository is private, so its packages are private too. `GITHUB_TOKEN`
exists only inside Actions — the VPS needs its own credential. Create a
**classic PAT with only the `read:packages` scope** (ideally on a dedicated
machine account, so revoking it doesn't disturb anyone's personal access):

```bash
# on the VPS
echo "<PAT>" | docker login ghcr.io -u <github-username> --password-stdin
```

Credentials land in `~/.docker/config.json`. If pulls 403 after this, check
Package settings → *Manage Actions access* — the repository must be linked to
the package with at least Read.

### Deploy

The VPS needs only three things in a directory: `docker-compose.prod.yml`,
`.env`, and `secrets/`.

```bash
mkdir -p /srv/dacho/secrets && cd /srv/dacho
# copy docker-compose.prod.yml here, plus secrets/payload-secret and
# secrets/jwt-private.pem (generated per §2)

cat > .env <<'EOF'
IMAGE_TAG=sha-a805857
POSTGRES_PASSWORD=<strong-password>
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
PAYLOAD_API_KEY=<from seed:service-account>
EOF

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Every one of those four variables is mandatory — compose aborts with
`required variable ... is missing a value` rather than starting with a default.
Migrations run automatically: the frontend entrypoint executes
`payload migrate` before `next start`, so no host-side `pnpm` is needed.

### Update / roll back

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<new>/' .env
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d      # migrations run on boot
```

Rolling back is the same command with the previous sha. Uploaded media lives in
the `media` volume rather than the image, so it survives both directions.

### Caveats

- Images are **linux/amd64 only** — the publish workflow sets no `platforms`. An
  arm64 VPS (Ampere, Graviton, Apple-silicon-like hosts) cannot run them; add
  `platforms: linux/amd64,linux/arm64` to `docker/build-push-action` first.
- `latest` exists only after a push to `main`. Before the first merge, pin
  `sha-<short>` or `pr-<n>`.
- The frontend binds to `127.0.0.1:3000` here, so Caddy (§6) is required to serve
  it publicly.

## Notes

- The frontend runs via `next start` against a complete prod `node_modules` — **not** Next's `output: standalone` tracer, which only partially copies symlinked pnpm deps (e.g. `@swc/helpers/esm`) and crashed on boot.
- `payload migrate` at container startup is a catch-up no-op; the entrypoint auto-answers Payload's "dev mode → data loss?" prompt with "no" so it can't hang a non-interactive boot.
