# Authorization

How the system decides **what** a caller may do. For **who** they are, see
[authentication.md](./authentication.md).

## Implemented

Four access-control functions in `packages/cms-core/src/access/`:

| Function | Rule |
|---|---|
| `anyone` | always `true` |
| `authenticated` | `Boolean(req.user)` — any logged-in user |
| `authenticatedOrPublished` | logged-in user, or `_status === 'published'` |
| `hasCmsRole` | `Boolean(req.user?.cmsRole)` — users with a CMS role (`admin`/`editor`) |

Per collection: `users` is `authenticated` for read/update/delete and **public**
(`create: () => true`) for self-registration; content (`posts`, `pages`, …) is
`authenticatedOrPublished` for read and `authenticated` for create/update/delete.
Drafts (`versions.drafts`) make `_status` the public/private boundary. Author
names surface through a sanitized `populatedAuthors` array (id + name), not the
raw user doc.

### Roles (v1 — two orthogonal fields)

The `users` collection carries **two role fields** that separate the two systems
they gate. *(`role`'s values are renamed to `company` | `internal` by the
identity re-model decided 2026-10-12; the code still carries `applicant` |
`staff` until those slices land — `.scratch/company-identity/map.md`.)*

| Field | Values | Meaning |
|---|---|---|
| `role` | `company` \| `internal` (was `applicant` \| `staff`) | dashboard side: a person acting for a company vs the دبیرخانه / operations team |
| `cmsRole` | `admin` \| `editor` \| null | CMS side: who may reach `/admin` |

- `Users.access.admin` is `hasCmsRole`, so only `cmsRole` holders reach the
  Payload admin panel.
- `role`/`cmsRole` are `saveToJWT: true`.
- **Escalation is blocked three ways:** field-level access on `role`/`cmsRole`
  (`create`/`update` admin-only), `defaultValue: 'company'` (was `'applicant'`)
  on `role`, and a `beforeChange` hook that forces `role: 'company'` +
  `cmsRole: null` whenever the requesting user is not a CMS admin. A
  self-registering visitor can only ever become `company`.

## Planned (not implemented)

### Dynamic `Role` collection — implemented later than this section

This was written as a future refinement and is **already implemented**: the
dynamic `roles` collection exists (`packages/cms-core/src/collections/Roles.ts`),
`users.roles` is the many-to-many, `users.role`/`cmsRole` remain as the flat pair
above, and the backend's workflow engine queries role membership to gate a step.
Whether the step-gating consumer survives is open — the dynamic message-flow
routing was dropped by the client (`CONTEXT.md` → **Workflow**, *under revision*).

### Role-specific panels

- Company panel, reviewer panel, admin panel, secretariat — each panel is scoped
  to one or more roles. (The staff/دبیرخانه dashboard is a separate, deferred
  effort.)

## Open questions (implementation detail)

- [x] Where role membership is enforced — v1 enforces in Payload access
      functions (`hasCmsRole`, field-level access, the `beforeChange` hook).
      Backend-side enforcement of `role`/`cmsRole` arrives with the staff
      dashboard, which is deferred.
- [x] Company-level scoping: how "a company user sees only their company's data"
      is expressed. **Decided 2026-10-12** — the Company becomes a first-class
      `companies` record, and the instances (requests, letters, support tickets)
      become company-owned with the acting user recorded; the flattened
      `company*` fields on `users` are retired. Implementation slices:
      `.scratch/company-identity/map.md`.
