# Authentication

How the system verifies **who** a caller is. For **what** they may do, see
[authorization.md](./authorization.md).

## Identity model (resolved)

- **One central `users` collection** is the single identity store for everyone —
  CMS editors and application users alike.
- **Users are the principals** — people authenticate, not organizations. A
  separate **`companies` collection** holds organizations; users belong to a
  company through a relationship. "Company login" means a user logging in who is
  a member of that company.
- Credentials are **progressive / optional**:

  | field | required | notes |
  |---|---|---|
  | `phone` | yes | unique; the OTP identifier |
  | `username` | no | unique when set; enables username/password login |
  | `email` | no* | real for CMS editors; OTP-only users get a synthetic `<phone>@dacho.local` placeholder (Payload requires email-or-username) |
  | `password` | no* | Payload's local auth requires one on create, so OTP-only users get a random placeholder they never use; editors + app users who opt in set a real password |

## Implemented

### CMS editors — Payload built-in auth (email + password)

The CMS editor path uses Payload's built-in auth on `users`
(`packages/cms-core/src/collections/Users/index.ts`, `auth: true`):

- email + password auth (hashing, lockout; reset/forgot-password flows unused).
- REST endpoints: `POST /api/users/login`, `POST /api/users/logout`,
  `GET /api/users/me`, `POST /api/users/refresh-token`.
- Editor sessions are JWTs signed with `PAYLOAD_SECRET` (a required env var).

**Note:** Payload 3.86 signs these editor tokens with **symmetric HS256** — its
built-in local auth hardcodes `alg: 'HS256'`. The backend-issued application
tokens (below) are **ES256** and verified by a separate custom strategy.

### Application auth — backend OTP-first + ES256 JWT

The backend (`apps/backend`, Express) owns application auth:

- `POST /auth/request-otp` — generates a code, stores it in Postgres
  (`otp_codes`), and delivers it via the `OtpDelivery` seam.
- `POST /auth/verify-otp` — verifies the code, find-or-creates the `users`
  record via Payload's REST API, and issues an **ES256 JWT**.
- `POST /auth/complete-profile` — updates `name`/`company` (authenticated by
  the JWT).
- `GET /.well-known/jwks.json` — publishes the public key (JWKS) so Payload
  can verify backend tokens.

Signing uses `jose` (ES256) with a persistent PKCS8 private key
(`JWT_PRIVATE_KEY`, fail-fast) and a configurable `JWT_KID`. Codes live in
Postgres (`PostgresCodeStore`; `ensureOtpCodesTable` creates the table at
boot). Required env is fail-fast: `DATABASE_URL`, `JWT_PRIVATE_KEY`,
`PAYLOAD_URL`, `PAYLOAD_API_KEY`.

### OTP delivery (seam)

The code reaches the user through a swappable **`OtpDelivery` interface**
(selected via `OTP_DELIVERY=console|kavenegar`):

- **`ConsoleOtpDelivery`** — dev/stub default: logs the code, zero external
  dependencies.
- **`KavenegarOtpDelivery`** — production SMS adapter using Kavenegar's
  `verify/lookup.json` (pre-registered `%token` template).

`request-otp` calls `delivery.send(phone, code)` and never knows which backend
is configured.

### Backend → Payload over REST (not the Local API)

`PayloadUserStore` talks to Payload's **REST API** with an API key, not the
Local API — no second Payload instance, no runtime coupling. The service
account (`backend@dacho.local`) is seeded by `apps/frontend`
`seed:service-account`. Because Payload's local auth requires an
email-or-username and a password on create, OTP-only users get a synthetic
`<phone>@dacho.local` email and a random password they never use.

### Payload verifies backend JWTs (custom strategy)

A custom `backend-jwt` strategy (`@dacho/cms-core/auth`) verifies
backend-issued ES256 tokens against `BACKEND_JWKS_URL` (`jose`
`createRemoteJWKSet`) and resolves `sub` → users doc. Wired into
`Users.auth.strategies`, so OTP users can call Payload-protected endpoints with
their backend token.

## Planned (not implemented)

### Optional username/password login

- `set username+password` → enables password login on later visits.
- `login` (username+password) → for returning users who set credentials.

### Key rotation

The JWKS endpoint and a persistent private key exist; **automatic key
rotation** is not implemented.

## Open questions (implementation detail)

- [x] ES256 vs RS256 — **ES256** (locked).
- [x] JWKS endpoint + private-key location — implemented (env var, fail-fast).
- [x] Payload asymmetric wiring — custom `backend-jwt` strategy (done).
- [ ] Key rotation — not implemented.
