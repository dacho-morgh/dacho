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
  | `email` | no | used by CMS editors |
  | `password` | no | Payload hash; editors + app users who opt in |

## Implemented

### CMS editors — Payload built-in auth (email + password)

The only authentication live today is Payload's built-in auth on `users`
(`packages/cms-core/src/collections/Users/index.ts`, `auth: true`):

- email + password auth (hashing, lockout; reset/forgot-password flows unused).
- REST endpoints: `POST /api/users/login`, `POST /api/users/logout`,
  `GET /api/users/me`, `POST /api/users/refresh-token`.
- Sessions are JWTs signed with `PAYLOAD_SECRET` (a required env var).

**Note:** Payload 3.86 signs these JWTs with **symmetric HS256** —
`auth/jwt.js` hardcodes `alg: 'HS256'` and signs with
`TextEncoder().encode(PAYLOAD_SECRET)`. Asymmetric signing (below) requires
custom work.

## Planned (not implemented)

### Application auth — backend OTP-first + JWT

The backend (Express, currently a placeholder in `apps/backend`) owns
application auth:

1. `request-otp` (phone/email) → sends a one-time code.
2. `verify-otp` → create the `users` record if new, else fetch it → issue a JWT.
3. `complete-profile` → name, company, etc.
4. optional `set username+password` → enables password login on later visits.
5. `login` (username+password) → for returning users who set credentials.

### OTP delivery (decided)

The one-time code reaches the user through a swappable **`OtpDelivery` interface**:

- **`ConsoleOtpDelivery`** — dev/stub default: logs (or returns) the code so the
  flow is testable with zero external dependencies.
- **`KavenegarOtpDelivery`** — production SMS adapter using Kavenegar's
  `verify/lookup.json` (pre-registered `%token` template); selected via env
  (`OTP_DELIVERY=console|kavenegar`).

The interface is the seam: `request-otp` calls `delivery.send(phone, code)` and
never knows which backend is configured.

### Asymmetric authentication (both services)

Both the backend and Payload use **asymmetric JWT** (ES256 recommended): a
private key signs, a public key verifies — no shared secret to leak, and tokens
can be verified across services without distributing a secret.

- The backend owns the signing keypair and publishes its public key (JWKS).
- Payload verifies backend-issued tokens via a custom auth strategy, and signs
  its own editor tokens with its own keypair.
- **Constraint:** Payload's built-in local auth is HS256-only, so this needs a
  custom auth strategy (verify) + custom sign/login, or a small plugin. `jose`
  (already a Payload dependency) supports ES256/RS256.
- OTP reference (inspiration only, not production-ready):
  [payloadcms/plugin-otp](https://github.com/payloadcms/plugin-otp).

## Open questions (implementation detail)

- [x] ES256 vs RS256 — **ES256** (locked).
- [ ] Key management: JWKS endpoint, key rotation, where private keys live.
- [ ] Payload asymmetric wiring: custom strategy + custom login vs a dedicated
      auth plugin.
