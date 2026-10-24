# Staging deployment

All ongoing feature/fix PRs target `staging`. The temporary CI branch-policy
check rejects PRs with any other base. `main` deploys to production: merging,
pushing or releasing there requires an explicit release instruction from the
human user. That instruction must also explicitly retire or adjust the
temporary base-branch check before a production promotion can pass CI.

The repository's GitHub UI default branch currently remains `main`: the
available repository credential has Maintain, not Admin, permission and its
default-branch update was rejected. The current PR explicitly targets
`staging`; repository instructions and the CI check use that base regardless
of GitHub's UI default. A repository administrator can change the UI default
to `staging`. No branch protection or permission expansion is claimed here.

The `staging` branch runs the same CI checks as `main`. After all checks pass,
the reusable publish workflow builds the same frontend and backend Dockerfiles
used for production. It pushes `staging` and `staging-sha-<7-character commit>`
tags only. Production keeps `main`, `latest`, and `sha-<7-character commit>`.
The production VPS poller follows `main` and its `sha-` tags, so staging images
cannot satisfy a production deployment.

`docker-compose.staging.yml` is a standalone stack for prebuilt images, with
Compose project `dacho-staging`, its own Postgres, uploaded-media and private
document volumes, separate database user/name, separate secrets, and loopback
ports 3300 and 4400. The backend stores private documents under the dedicated
`staging_private_documents` volume
(`PRIVATE_DOCUMENTS_DIR=/data/private-documents`), never under public media. It
reuses the production image builds to keep the runtime equivalent. It does not
configure a public hostname or automatic staging deployment.

## Configure a staging host

Provision a host with Docker Compose v2 and GHCR read access. This may be the
production host if it has enough capacity, since the Compose projects and ports
are separate. Copy `docker-compose.staging.yml` to the staging deployment
directory. Create a gitignored `.env.staging.local` from
`deploy/staging.env.example` and fill in its staging-only values. Set
`STAGING_PUBLIC_URL` to the actual HTTPS origin assigned to staging; there is
no default domain. Use a URL-safe hex password for Postgres because it is
interpolated into the database URL. Keep the original password with the
database volume: changing the env variable does not change an initialized
Postgres user's password.

Create **new** staging secret files at `secrets/staging/payload-secret` and
`secrets/staging/jwt-private.pem` relative to the Compose file. Never copy the
production secrets or service-account key. The files must be readable by the
container user (UID 1001). For example, on a Linux host:

```bash
mkdir -p secrets/staging
openssl rand -hex 32 > secrets/staging/payload-secret
openssl ecparam -genkey -name prime256v1 -noout \
  | openssl pkcs8 -topk8 -nocrypt -out secrets/staging/jwt-private.pem
sudo chown 1001:1001 secrets/staging/payload-secret secrets/staging/jwt-private.pem
chmod 600 secrets/staging/payload-secret secrets/staging/jwt-private.pem
```

Set `STAGING_IMAGE_SUFFIX=-sha-<7-character commit>` to pin both services to a
tested staging commit. An empty suffix chooses the movable `staging` tag. The
Compose image references always prepend `staging`, so an env value cannot
select `latest`, `main`, or an unqualified production SHA image.

```bash
docker compose --env-file .env.staging.local -f docker-compose.staging.yml config --quiet
docker compose --env-file .env.staging.local -f docker-compose.staging.yml pull
docker compose --env-file .env.staging.local -f docker-compose.staging.yml up -d
docker compose --env-file .env.staging.local -f docker-compose.staging.yml ps
curl -fsS http://127.0.0.1:4400/health
```

The frontend is available locally at `127.0.0.1:3300`; configure a separate
HTTPS reverse-proxy hostname for it and use that exact origin as
`STAGING_PUBLIC_URL`. Backend port 4400 stays on loopback. The frontend
entrypoint applies database migrations on startup, as in production. Create a
staging-only Payload service account and set its key as
`STAGING_PAYLOAD_API_KEY`; use separate staging content and test accounts.

No staging server, domain, GHCR credentials, or secrets are provisioned by this
repository change. Images are published after CI passes on the `staging`
branch; the Compose stack is a manual deployment recipe until a staging host is
configured.
