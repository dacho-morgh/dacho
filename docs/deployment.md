# Deployment (VPS)

Current delivery rule: ongoing work targets `staging`; `main` is production
and must receive no push/merge/release without the user's explicit release
instruction. Use [the staging guide](staging.md) and
`docker-compose.staging.yml` for the separate staging stack. The instructions
below describe production operations and do not authorize executing them.

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

# The containers run as a non-root user (nodejs/nextjs, UID 1001). Compose
# bind-mounts these files preserving host ownership, so they must be readable
# by UID 1001 — otherwise startup fails with EACCES on /run/secrets/jwt_private_key.
# (As root, prefer chown 1001:1001 + chmod 600 for tighter perms; chmod 644
# works for any user on a single-user box.)
chmod 644 secrets/jwt-private.pem secrets/payload-secret
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

The operational scripts ship inside the frontend image under
`apps/frontend/scripts/` and run with Payload's TypeScript loader — **not** the
`pnpm <script>` shorthand, because `tsx` and `pnpm` are dev tooling that isn't in
the runtime image. `payload run` can't execute them either: it imports the
script but doesn't await its floating promise, so the seed exits before writing
anything.

```bash
# inside the running frontend container
docker compose -f docker-compose.prod.yml exec frontend sh -lc '
  cd apps/frontend
  NODE_OPTIONS=--no-deprecation ./node_modules/.bin/tsx scripts/seed-service-account.ts
  NODE_OPTIONS=--no-deprecation ./node_modules/.bin/tsx scripts/seed-landing.ts
  NODE_OPTIONS=--no-deprecation ./node_modules/.bin/tsx scripts/seed-dashboard.ts
  NODE_OPTIONS=--no-deprecation ./node_modules/.bin/tsx scripts/seed-forms.ts
  NODE_OPTIONS=--no-deprecation ./node_modules/.bin/tsx scripts/create-admin.ts
'
```

- `seed-service-account.ts` prints the `PAYLOAD_API_KEY` — put it in `.env`.
- `seed-landing.ts` populates the Persian landing-page content from the Figma
  design (home page, globals, services/news/FAQ).
- `seed-dashboard.ts` creates the dashboard's workflow `roles` and the five
  `services` with `key`/`icon`/`workflow`. The landing seed's services are
  marketing-only (no `key`, no `workflow`), so this is required for the
  dashboard quick-access grid and the backend workflow engine.
- `seed-forms.ts` creates the form-builder forms backing `/connect` and
  `/cooperation`.
- `create-admin.ts` bootstraps (or resets) an admin login; it reads
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` from the environment, defaulting to
  `admin@dacho.local`. It also grants the admin `role=staff` + `cmsRole=admin`
  (the roles from the roles/signup change; the identity re-model renames these
  values to `internal`/`company`, so this instruction keeps reading `staff`
  until those slices land — see `.scratch/company-identity/map.md`). **Re-run it after deploying that
  change** to backfill an existing admin that predates the roles migration
  (such an admin has `role=applicant` + `cmsRole=null` and is locked out of
  `/admin`). Leave `ADMIN_PASSWORD` unset on re-run so the existing password is
  preserved.


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
build — no toolchain or 5-minute build on a small box. Automatic deployment uses
a small Git checkout to identify the latest commit and track its deploy script. Use
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

<https://github.com/settings/tokens/new?scopes=read:packages>

```bash
# on the VPS
read -rsp 'PAT: ' PAT && echo
echo "$PAT" | docker login ghcr.io -u <github-username> --password-stdin
```

Credentials land in `~/.docker/config.json`.

> **A fine-grained token will not work here.** GHCR's documented auth path is a
> classic PAT; fine-grained tokens (`/settings/personal-access-tokens`) fail with
> a bare `denied` on `docker pull`, even though they authenticate fine against
> `api.github.com`. Check which kind you have:
>
> ```bash
> curl -sI -H "Authorization: token $PAT" https://api.github.com/user \
>   | grep -iE 'x-oauth-scopes|x-accepted-github-permissions'
> ```
>
> `x-oauth-scopes: read:packages` → classic, correct.
> `x-accepted-github-permissions: …` with **no** `x-oauth-scopes` → fine-grained,
> replace it with a classic token.

To isolate a registry refusal from a Docker-config problem, query GHCR directly:

```bash
T=$(curl -s -u "<github-username>:$PAT" \
  "https://ghcr.io/token?service=ghcr.io&scope=repository:dacho-morgh/dacho/frontend:pull" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -so /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $T" \
  https://ghcr.io/v2/dacho-morgh/dacho/frontend/manifests/<tag>
# 200 = token and tag are both good; 403 = token scope / package access
```

If pulls 403 with a correct classic token, check Package settings →
*Manage Actions access* — the repository must be linked to the package with at
least Read.

### Deploy

To start the images manually, the VPS needs `docker-compose.prod.yml`, `.env`,
and `secrets/` in one directory.

```bash
mkdir -p /srv/dacho/secrets && cd /srv/dacho
# copy docker-compose.prod.yml here, plus secrets/payload-secret and
# secrets/jwt-private.pem (generated per §2)

cat > .env <<'EOF'
IMAGE_TAG=sha-a805857
POSTGRES_PASSWORD=<strong-password>
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
PAYLOAD_API_KEY=<from seed:service-account>
INTERNAL_PROXY_SECRET=<shared-secret>
EOF

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Every one of those five variables is mandatory — compose aborts with
`required variable ... is missing a value` rather than starting with a default.
Migrations run automatically: the frontend entrypoint executes
`payload migrate` before `next start`, so no host-side `pnpm` is needed.

### Automatic deployment after CI

The production host polls `main` every two minutes. It deploys only after CI has
published **both** `sha-<commit>` images. It pulls those images from GHCR, updates
the server checkout and `.env`, and checks the frontend and backend before
reporting success. It never builds on the VPS and needs no GitHub Actions SSH
secret. The host's existing GitHub SSH access and GHCR Docker login are used.

Install the timer once on the VPS, from the production checkout:

```bash
bash scripts/install-maintenance.sh
mkdir -p ~/.local/bin
install -m 0755 scripts/deploy-production.sh ~/.local/bin/dacho-deploy-production
sudo install -m 0644 deploy/systemd/dacho-deploy.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/dacho-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dacho-deploy.timer
```

The timer updates its installed deploy script after a successful checkout
update. To inspect or trigger deployment:

```bash
systemctl list-timers dacho-deploy.timer
sudo systemctl start dacho-deploy.service
journalctl -u dacho-deploy.service -n 100 --no-pager
```

### Update page and protected logs

Install the independent Python update server before installing the deploy script
and service. It does not use a Docker image, so it remains available while the
frontend is removed or its replacement image is pulled:

```bash
bash scripts/install-maintenance.sh
install -m 0755 scripts/deploy-production.sh ~/.local/bin/dacho-deploy-production
sudo install -m 0644 deploy/systemd/dacho-deploy.service /etc/systemd/system/
sudo systemctl daemon-reload
```

The installer preserves the existing Caddy configuration, validates the new
configuration, and adds the maintenance snippet to the existing frontend proxy.
The Python server listens only on `127.0.0.1:9080`; Caddy serves it over the site's
existing HTTPS connection. A backup is saved at
`/etc/caddy/Caddyfile.before-maintenance`.

- `/update` previews the Persian/English “We'll be back soon” page.
- `/update/logs` requires HTTP Basic authentication with the credentials defined
  in `deploy/maintenance/server.py`. Its log refreshes every three seconds.
- `/update/status` reports only whether the update is active and the app is ready.

Deployment creates `/var/lib/dacho-maintenance/active` before image pulls and
container changes, making Caddy show the update page for normal app requests.
The old frontend image is removed before its replacement is pulled, after
checking that the old immutable image remains available for rollback. Deployment
output is captured in `/var/lib/dacho-maintenance/deploy.log`; image builds still
run in GitHub Actions, linked from the protected log viewer.

The active marker is removed only when both frontend and backend HTTP checks
pass, including after rollback. If rollback cannot restore the app, the update
page stays visible. Visitors' pages check every eight seconds and reload when
the app is ready. Caddy also shows the update page if the frontend is unreachable.

Re-run the installer after changing the Python server, HTML pages, or Caddy
snippet. An installed maintenance-enabled deploy script retains itself until
the server's Git checkout also contains the maintenance hooks.

The VPS has limited disk space, so the deploy script stops and removes the
old frontend image before pulling the new one. The update page remains available
during that release. If deployment fails, the script attempts to restore the
previous SHA image and checkout. Database migrations may require a separate
rollback plan when they change stored data.

For a manual rollback, first stop the timer with
`sudo systemctl disable --now dacho-deploy.timer`, then pin a previous immutable
SHA tag in `.env`, pull both images, and recreate the services. Re-enable the
timer after the cause is fixed; otherwise it will deploy the latest `main`
again. Uploaded media remains in the `media` volume.

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
