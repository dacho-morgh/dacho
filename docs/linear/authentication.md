# Authentication

How the system verifies **who** a caller is. For **what** they may do, see
[authorization.md](./authorization.md).

## Status (2026-10-12)

The identity model is being re-modelled: the **Company is the account holder** (a first-class `companies` collection keyed by national id) and there are exactly **two kinds of user** — `company` (self-registered on `/register`) and `internal` (seeded) — replacing `applicant` / `staff`. Open tickets: `.scratch/company-identity/map.md`. Statements below that still use the old names describe the code as it stands today.

## Identity model (resolved)

- **One central `users` collection** is the single identity store for everyone —
  CMS editors and application users alike.
- **The Company is the account holder** *(decided 2026-10-12)* — the
  **`companies` collection** holds organizations, keyed by national id, and
  `users` carries a `company` relation. A person signs in on behalf of a
  company; the company owns the requests, letters and support tickets. *(This
  reverses the earlier reading that the people, not the organizations, own the
  data, and retires `applicant` as a role value in favour of `company`.)*
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

### Application auth — backend OTP + ES256 JWT (implemented; reached by no screen)

The backend (`apps/backend`, Express) implements application auth:

- `POST /auth/request-otp` — generates a code, stores it in Postgres
  (`otp_codes`), and delivers it via the `OtpDelivery` seam.
- `POST /auth/verify-otp` — verifies the code, find-or-creates the `users`
  record via Payload's REST API, and issues an **ES256 JWT**.
- `POST /auth/complete-profile` — updates `name`, and accepts a `companyId`
  that **nothing persists today** (there is no `companyId` field on `users` and
  no `companies` collection); the identity re-model replaces it with the real
  `users.company` relation.
- `GET /.well-known/jwks.json` — publishes the public key (JWKS) so Payload
  can verify backend tokens.

Signing uses `jose` (ES256) with a persistent PKCS8 private key
(`JWT_PRIVATE_KEY`, fail-fast) and a configurable `JWT_KID`. Codes live in
Postgres (`PostgresCodeStore`; `ensureOtpCodesTable` creates the table at
boot). Required env is fail-fast: `DATABASE_URL`, `JWT_PRIVATE_KEY`,
`PAYLOAD_URL`, `PAYLOAD_API_KEY`.

**No screen uses this path today.** The public login form posts a password to
Payload's `/api/users/login`, so the OTP flow is a built, tested, dormant
phone-first escape hatch rather than the live application path. Whether company
users should switch to it is open (`07-company-auth-mode` in
`.scratch/company-identity/map.md`).

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

### Company self-registration (public signup)

Companies register themselves through the public signup form
(`apps/frontend/src/components/auth/register-page.tsx`), a 3-step wizard
(company → representative → account security) that `POST`s to
**`/api/users/self-signup`** — a custom endpoint on the `users` collection, not
bare `/api/users`:

- Collects company fields (`companyName`, `companyNationalId`,
  `companyRegistrationNumber`, `companyType`, `companyProvince`, `companyCity`),
  representative fields (`name`, `position`, `phone`, `email`), and a password.
- Stores the registrant's unique phone as their Payload username so the public
  login form accepts either phone or email as advertised.
- `Users.access.create` is public; field-level access + a `beforeChange` hook
  force `role: 'applicant'` and `cmsRole: null` today, so a self-registering
  visitor cannot escalate (see [authorization.md](./authorization.md)). Under
  the identity re-model this becomes `role: 'company'` plus **create-or-claim a
  `companies` record**, attaching the registrant through `users.company` — the
  company fields the form collects move onto that record.
- On success the user is redirected to `/login?registered=1&returnUrl=…`; the
  return path is limited to the dashboard route tree.

This **password-based** path (phone/email + password via `/api/users/login`) is
what the running app uses; the backend OTP flow above is implemented but unused
by any screen. Password reset / forgot-password is not implemented on either
path.

## Planned (not implemented)

### Key rotation

The JWKS endpoint and a persistent private key exist; **automatic key
rotation** is not implemented.

### Phone-first (OTP) sign-in for company users

Open in `.scratch/company-identity/map.md` as `07-company-auth-mode`. If it
resolves toward OTP, the dashboard proxy must authenticate an OTP-issued JWT
instead of a Payload session cookie, and the register page's password step
changes shape.

## Open questions (implementation detail)

- [x] ES256 vs RS256 — **ES256** (locked).
- [x] JWKS endpoint + private-key location — implemented (env var, fail-fast).
- [x] Payload asymmetric wiring — custom `backend-jwt` strategy (done).
- [ ] Key rotation — not implemented.
